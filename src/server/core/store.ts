/**
 * Redis persistence layer for Guess the Subreddit.
 *
 * Keys:
 * - play:{userId}:{date}  JSON PlayRecord (answers so far, finish state)
 * - lb:{date}             sorted set userId -> composite score (see below)
 * - lbmeta:{date}         hash userId -> JSON LeaderboardMeta
 * - streak:{userId}       JSON StreakRecord (persists, no TTL)
 * - stats:{userId}        JSON StatsRecord (persists, no TTL)
 * - streaklb              sorted set userId -> best streak (all time)
 * - streakmeta            hash userId -> username
 * - posted:{date}         marker set by the scheduler once the daily post exists
 *
 * Daily keys expire after 48h. Streak/stats keys persist indefinitely.
 *
 * Leaderboard ordering is score desc, finish time asc. The sorted-set score
 * is a composite: `score * 1e13 - finishedAtMs`. The scale (1e13) exceeds any
 * realistic finish timestamp in ms (~1.8e12 in 2026), so the game score
 * always dominates the ordering and the earlier finisher wins ties. The
 * composite stays below 2^53 (max 850 * 1e13 = 8.5e15), so it is exact in a
 * double. The true score is also stored in lbmeta and is authoritative; the
 * composite is only ever decoded as a fallback if the meta entry is missing.
 */
import { redis } from '@devvit/web/server';
import type { PlayerStats, RoundResult } from '../../shared/api';

/** A player's in-progress or finished game for one day. */
export type PlayRecord = {
  answers: RoundResult[];
  finished: boolean;
  /** Running total while playing; final total (incl. perfect bonus) once finished. */
  score: number;
  finishedAt: number | undefined;
  correctCount: number;
  /** Streak after this game — stored at finish so /today can rebuild the result exactly. */
  streak: number;
  flairEarned: string | undefined;
  flairAwarded: boolean;
};

export type StreakRecord = {
  current: number;
  best: number;
  /** UTC date (YYYY-MM-DD) of the last finished game, if any. */
  lastPlayed: string | undefined;
};

export type StatsRecord = {
  games: number;
  correct: number;
  answered: number;
  totalScore: number;
  perfectDays: number;
};

export type LeaderboardMeta = {
  username: string;
  finishedAt: number;
  correctCount: number;
  score: number;
};

export type TopEntry = {
  userId: string;
  score: number;
  username: string;
  finishedAt: number;
  correctCount: number;
};

export type StreakTopEntry = {
  userId: string;
  username: string;
  bestStreak: number;
};

/** Daily keys live 48h — long enough for the next day's "yesterday" view. */
export const DAY_TTL_SECONDS = 48 * 60 * 60;

/** Composite-score scale for lb:{date}. See the header comment. */
const LEADERBOARD_SCALE = 10_000_000_000_000;

export const STREAK_LEADERBOARD_KEY = 'streaklb';
export const STREAK_META_KEY = 'streakmeta';

export const playKey = (userId: string, date: string): string =>
  `play:${userId}:${date}`;

export const leaderboardKey = (date: string): string => `lb:${date}`;

export const leaderboardMetaKey = (date: string): string => `lbmeta:${date}`;

export const streakKey = (userId: string): string => `streak:${userId}`;

export const statsKey = (userId: string): string => `stats:${userId}`;

export const postedKey = (date: string): string => `posted:${date}`;

// ---------------------------------------------------------------------------
// Stored-JSON parsing (defensive: corrupt data logs and falls back, never throws)
// ---------------------------------------------------------------------------

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const parseStoredJson = (raw: string | undefined, label: string): unknown => {
  if (raw === undefined) {
    return undefined;
  }
  try {
    // JSON.parse returns any; the declared unknown return type keeps it
    // untrusted until the per-type validators below narrow it.
    return JSON.parse(raw);
  } catch (error) {
    console.error(`Corrupt stored JSON for ${label}:`, error);
    return undefined;
  }
};

const parseRoundResult = (value: unknown): RoundResult | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }
  const { questionId, answer, correct, correctAnswer, points } = value;
  if (
    typeof questionId !== 'string' ||
    typeof answer !== 'string' ||
    typeof correct !== 'boolean' ||
    typeof correctAnswer !== 'string' ||
    typeof points !== 'number'
  ) {
    return undefined;
  }
  return { questionId, answer, correct, correctAnswer, points };
};

const parsePlayRecord = (raw: string | undefined): PlayRecord | undefined => {
  const parsed = parseStoredJson(raw, 'play record');
  if (parsed === undefined || !isRecord(parsed)) {
    return undefined;
  }
  const { answers, finished, score, finishedAt, correctCount, streak } = parsed;
  if (
    !Array.isArray(answers) ||
    typeof finished !== 'boolean' ||
    typeof score !== 'number' ||
    typeof correctCount !== 'number' ||
    typeof streak !== 'number'
  ) {
    return undefined;
  }
  if (
    finishedAt !== undefined &&
    typeof finishedAt !== 'number'
  ) {
    return undefined;
  }
  const validAnswers: RoundResult[] = [];
  for (const answer of answers) {
    const round = parseRoundResult(answer);
    if (!round) {
      return undefined;
    }
    validAnswers.push(round);
  }
  const flairEarned =
    typeof parsed.flairEarned === 'string' ? parsed.flairEarned : undefined;
  return {
    answers: validAnswers,
    finished,
    score,
    finishedAt: typeof finishedAt === 'number' ? finishedAt : undefined,
    correctCount,
    streak,
    flairEarned,
    flairAwarded: parsed.flairAwarded === true,
  };
};

const parseStreakRecord = (raw: string | undefined): StreakRecord => {
  const parsed = parseStoredJson(raw, 'streak record');
  if (!isRecord(parsed)) {
    return emptyStreakRecord();
  }
  const { current, best, lastPlayed } = parsed;
  if (typeof current !== 'number' || typeof best !== 'number') {
    return emptyStreakRecord();
  }
  return {
    current,
    best,
    lastPlayed: typeof lastPlayed === 'string' ? lastPlayed : undefined,
  };
};

const parseStatsRecord = (raw: string | undefined): StatsRecord => {
  const parsed = parseStoredJson(raw, 'stats record');
  if (!isRecord(parsed)) {
    return emptyStatsRecord();
  }
  const { games, correct, answered, totalScore, perfectDays } = parsed;
  if (
    typeof games !== 'number' ||
    typeof correct !== 'number' ||
    typeof answered !== 'number' ||
    typeof totalScore !== 'number' ||
    typeof perfectDays !== 'number'
  ) {
    return emptyStatsRecord();
  }
  return { games, correct, answered, totalScore, perfectDays };
};

const parseLeaderboardMeta = (
  raw: string | undefined
): LeaderboardMeta | undefined => {
  const parsed = parseStoredJson(raw, 'leaderboard meta');
  if (!isRecord(parsed)) {
    return undefined;
  }
  const { username, finishedAt, correctCount, score } = parsed;
  if (
    typeof username !== 'string' ||
    typeof finishedAt !== 'number' ||
    typeof correctCount !== 'number' ||
    typeof score !== 'number'
  ) {
    return undefined;
  }
  return { username, finishedAt, correctCount, score };
};

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

export const newPlayRecord = (): PlayRecord => ({
  answers: [],
  finished: false,
  score: 0,
  finishedAt: undefined,
  correctCount: 0,
  streak: 0,
  flairEarned: undefined,
  flairAwarded: false,
});

export const emptyStreakRecord = (): StreakRecord => ({
  current: 0,
  best: 0,
  lastPlayed: undefined,
});

export const emptyStatsRecord = (): StatsRecord => ({
  games: 0,
  correct: 0,
  answered: 0,
  totalScore: 0,
  perfectDays: 0,
});

export const emptyPlayerStats: PlayerStats = {
  gamesPlayed: 0,
  totalCorrect: 0,
  totalAnswered: 0,
  avgScore: 0,
  bestStreak: 0,
  currentStreak: 0,
  perfectDays: 0,
};

export const toPlayerStats = (
  streak: StreakRecord,
  stats: StatsRecord
): PlayerStats => ({
  gamesPlayed: stats.games,
  totalCorrect: stats.correct,
  totalAnswered: stats.answered,
  avgScore:
    stats.games > 0
      ? Math.round((stats.totalScore / stats.games) * 10) / 10
      : 0,
  bestStreak: streak.best,
  currentStreak: streak.current,
  perfectDays: stats.perfectDays,
});

// ---------------------------------------------------------------------------
// Play records
// ---------------------------------------------------------------------------

export const getPlay = async (
  userId: string,
  date: string
): Promise<PlayRecord | undefined> =>
  parsePlayRecord(await redis.get(playKey(userId, date)));

export const savePlay = async (
  userId: string,
  date: string,
  record: PlayRecord
): Promise<void> => {
  const key = playKey(userId, date);
  await redis.set(key, JSON.stringify(record));
  await redis.expire(key, DAY_TTL_SECONDS);
};

// ---------------------------------------------------------------------------
// Streaks and stats (persist, no TTL)
// ---------------------------------------------------------------------------

export const getStreak = async (userId: string): Promise<StreakRecord> =>
  parseStreakRecord(await redis.get(streakKey(userId)));

export const saveStreak = async (
  userId: string,
  record: StreakRecord
): Promise<void> => {
  await redis.set(streakKey(userId), JSON.stringify(record));
};

export const getStats = async (userId: string): Promise<StatsRecord> =>
  parseStatsRecord(await redis.get(statsKey(userId)));

export const saveStats = async (
  userId: string,
  record: StatsRecord
): Promise<void> => {
  await redis.set(statsKey(userId), JSON.stringify(record));
};

// ---------------------------------------------------------------------------
// Daily leaderboard
// ---------------------------------------------------------------------------

export const addLeaderboardEntry = async (
  date: string,
  userId: string,
  score: number,
  finishedAt: number,
  username: string,
  correctCount: number
): Promise<void> => {
  const composite = score * LEADERBOARD_SCALE - finishedAt;
  const key = leaderboardKey(date);
  const metaKey = leaderboardMetaKey(date);
  await redis.zAdd(key, { member: userId, score: composite });
  await redis.hSet(metaKey, {
    [userId]: JSON.stringify({
      username,
      finishedAt,
      correctCount,
      score,
    } satisfies LeaderboardMeta),
  });
  await redis.expire(key, DAY_TTL_SECONDS);
  await redis.expire(metaKey, DAY_TTL_SECONDS);
};

/** Top N entries for a day, ordered score desc, finish time asc. */
export const getTopEntries = async (
  date: string,
  limit: number
): Promise<TopEntry[]> => {
  const rows = await redis.zRange(leaderboardKey(date), 0, limit - 1, {
    reverse: true,
    by: 'rank',
  });
  if (rows.length === 0) {
    return [];
  }
  const meta = await redis.hGetAll(leaderboardMetaKey(date));
  const entries: TopEntry[] = [];
  for (const row of rows) {
    const parsed = parseLeaderboardMeta(meta[row.member]);
    entries.push({
      userId: row.member,
      // Meta holds the authoritative score; the composite decode is only a
      // fallback for entries whose meta row is missing.
      score: parsed?.score ?? Math.round(row.score / LEADERBOARD_SCALE),
      username: parsed?.username ?? 'unknown',
      finishedAt: parsed?.finishedAt ?? 0,
      correctCount: parsed?.correctCount ?? 0,
    });
  }
  return entries;
};

/** 1-based rank for a day (score desc, finish time asc), if the user finished. */
export const getLeaderboardRank = async (
  date: string,
  userId: string
): Promise<number | undefined> => {
  const [ascendingRank, total] = await Promise.all([
    redis.zRank(leaderboardKey(date), userId),
    redis.zCard(leaderboardKey(date)),
  ]);
  if (ascendingRank === undefined) {
    return undefined;
  }
  return total - ascendingRank;
};

export const getLeaderboardSize = async (date: string): Promise<number> =>
  redis.zCard(leaderboardKey(date));

export const getTopScore = async (
  date: string
): Promise<number | undefined> => {
  const top = await getTopEntries(date, 1);
  return top[0]?.score;
};

export const getLeaderboardMeta = async (
  date: string,
  userId: string
): Promise<LeaderboardMeta | undefined> =>
  parseLeaderboardMeta(
    await redis.hGet(leaderboardMetaKey(date), userId)
  );

// ---------------------------------------------------------------------------
// All-time streak leaderboard
// ---------------------------------------------------------------------------

export const updateStreakLeaderboard = async (
  userId: string,
  bestStreak: number,
  username: string
): Promise<void> => {
  await redis.zAdd(STREAK_LEADERBOARD_KEY, {
    member: userId,
    score: bestStreak,
  });
  await redis.hSet(STREAK_META_KEY, { [userId]: username });
};

export const getTopStreaks = async (
  limit: number
): Promise<StreakTopEntry[]> => {
  const rows = await redis.zRange(STREAK_LEADERBOARD_KEY, 0, limit - 1, {
    reverse: true,
    by: 'rank',
  });
  if (rows.length === 0) {
    return [];
  }
  const meta = await redis.hGetAll(STREAK_META_KEY);
  return rows.map((row) => ({
    userId: row.member,
    username: meta[row.member] ?? 'unknown',
    bestStreak: row.score,
  }));
};

// ---------------------------------------------------------------------------
// Scheduler marker
// ---------------------------------------------------------------------------

export const isPosted = async (date: string): Promise<boolean> =>
  (await redis.get(postedKey(date))) !== undefined;

export const markPosted = async (date: string): Promise<void> => {
  const key = postedKey(date);
  await redis.set(key, '1');
  await redis.expire(key, DAY_TTL_SECONDS);
};
