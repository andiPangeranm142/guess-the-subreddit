/**
 * Game API (plain Hono REST + shared types from ../../shared/api).
 *
 * The server owns the question bank and all scoring — the client never sees
 * correct answers until the server reveals them.
 *
 * Logged-in users (context.userId set) get persistence: in-progress games
 * resume, finished games land on the leaderboard, streaks and stats update.
 * Anonymous users can play but nothing persists: /answer is stateless for
 * them (the client accumulates rounds locally and builds the final result
 * itself from the shared game.ts helpers, with rank undefined and streak 0),
 * and /stats returns zeros.
 */
import { Hono } from 'hono';
import { context, reddit } from '@devvit/web/server';
import type {
  AnswerRequest,
  AnswerResponse,
  ErrorResponse,
  GameResult,
  LeaderboardEntry,
  LeaderboardResponse,
  RoundResult,
  ShareCommentResponse,
  SplashResponse,
  StatsResponse,
  StreakLeaderboardResponse,
  TodayResponse,
  YesterdayResponse,
} from '../../shared/api';
import {
  addDays,
  buildShareText,
  fallbackNote,
  gameNumberForDate,
  getDailySet,
  QUESTIONS_PER_DAY,
  scoreAnswer,
  toClientQuestion,
  totalScore,
  utcDateString,
} from '../../shared/game';
import { questionBank } from '../core/bank';
import { awardStreakFlair } from '../core/flair';
import {
  addLeaderboardEntry,
  emptyPlayerStats,
  getLeaderboardMeta,
  getLeaderboardRank,
  getLeaderboardSize,
  getPlay,
  getStats,
  getStreak,
  getTopEntries,
  getTopScore,
  getTopStreaks,
  newPlayRecord,
  savePlay,
  saveStats,
  saveStreak,
  toPlayerStats,
  updateStreakLeaderboard,
  type PlayRecord,
  type StatsRecord,
  type StreakRecord,
} from '../core/store';

export const api = new Hono();

api.onError((error, c) => {
  console.error('API error:', error);
  return c.json<ErrorResponse>(
    { status: 'error', message: 'Internal server error' },
    500
  );
});

type CurrentUser = {
  userId: string;
  username: string | undefined;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Logged-in user, or undefined for anonymous (logged-out) visitors. */
const getCurrentUser = async (): Promise<CurrentUser | undefined> => {
  const userId = context.userId;
  if (!userId) {
    return undefined;
  }
  let username = context.username;
  if (!username) {
    try {
      username = await reddit.getCurrentUsername();
    } catch (error) {
      console.error('Failed to resolve current username:', error);
      username = undefined;
    }
  }
  return { userId, username };
};

/** Snoovatar URL, best-effort — falls back to undefined on any failure. */
const getSnoovatar = async (
  username: string
): Promise<string | undefined> => {
  try {
    return await reddit.getSnoovatarUrl(username);
  } catch (error) {
    console.error(`Failed to fetch snoovatar for u/${username}:`, error);
    return undefined;
  }
};

/** Rebuild a full GameResult from a finished play record + live standings. */
const buildResult = (args: {
  record: PlayRecord;
  date: string;
  rank: number | undefined;
  totalPlayers: number;
  bestStreak: number;
}): GameResult => {
  const grid = args.record.answers.map((round) => round.correct);
  return {
    score: args.record.score,
    correctCount: args.record.correctCount,
    grid,
    rank: args.rank,
    totalPlayers: args.totalPlayers,
    streak: args.record.streak,
    bestStreak: args.bestStreak,
    flairEarned: args.record.flairEarned,
    flairAwarded: args.record.flairAwarded,
    shareText: buildShareText({
      gameNumber: gameNumberForDate(args.date),
      score: args.record.score,
      correctCount: args.record.correctCount,
      grid,
      streak: args.record.streak,
    }),
  };
};

const parseAnswerRequest = (body: unknown): AnswerRequest | undefined => {
  if (!isRecord(body)) {
    return undefined;
  }
  const { questionId, answer, elapsedMs } = body;
  if (typeof questionId !== 'string' || questionId.length === 0) {
    return undefined;
  }
  if (typeof answer !== 'string' || answer.length === 0) {
    return undefined;
  }
  if (typeof elapsedMs !== 'number' || !Number.isFinite(elapsedMs)) {
    return undefined;
  }
  return { questionId, answer, elapsedMs };
};

const badRequest = (message: string): ErrorResponse => ({
  status: 'error',
  message,
});

// ---------------------------------------------------------------------------
// GET /api/today — today's set, resume state, and player snapshot
// ---------------------------------------------------------------------------

api.get('/today', async (c) => {
  const date = utcDateString();
  const gameNumber = gameNumberForDate(date);
  const questions = getDailySet(questionBank, date).map(toClientQuestion);
  const user = await getCurrentUser();
  if (!user) {
    return c.json<TodayResponse>({
      type: 'today',
      date,
      gameNumber,
      questions,
      alreadyPlayed: false,
      previousResult: undefined,
      progress: [],
      username: undefined,
      anonymous: true,
      streak: 0,
      stats: emptyPlayerStats,
    });
  }
  const [record, streak, stats] = await Promise.all([
    getPlay(user.userId, date),
    getStreak(user.userId),
    getStats(user.userId),
  ]);
  const playerStats = toPlayerStats(streak, stats);
  if (!record || !record.finished) {
    return c.json<TodayResponse>({
      type: 'today',
      date,
      gameNumber,
      questions,
      alreadyPlayed: false,
      previousResult: undefined,
      progress: record?.answers ?? [],
      username: user.username,
      anonymous: false,
      streak: streak.current,
      stats: playerStats,
    });
  }
  const [rank, totalPlayers] = await Promise.all([
    getLeaderboardRank(date, user.userId),
    getLeaderboardSize(date),
  ]);
  return c.json<TodayResponse>({
    type: 'today',
    date,
    gameNumber,
    questions,
    alreadyPlayed: true,
    previousResult: buildResult({
      record,
      date,
      rank,
      totalPlayers,
      bestStreak: streak.best,
    }),
    progress: record.answers,
    username: user.username,
    anonymous: false,
    streak: streak.current,
    stats: playerStats,
  });
});

// ---------------------------------------------------------------------------
// POST /api/answer — validate + score one round; finalize on the 5th
// ---------------------------------------------------------------------------

api.post('/answer', async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json<ErrorResponse>(
      badRequest('Request body must be valid JSON'),
      400
    );
  }
  const parsed = parseAnswerRequest(body);
  if (!parsed) {
    return c.json<ErrorResponse>(
      badRequest(
        'Invalid answer request: expected {questionId, answer, elapsedMs}'
      ),
      400
    );
  }
  const date = utcDateString();
  const entry = getDailySet(questionBank, date).find(
    (question) => question.id === parsed.questionId
  );
  if (!entry) {
    return c.json<ErrorResponse>(
      badRequest("Question is not part of today's set"),
      400
    );
  }
  if (!entry.options.includes(parsed.answer)) {
    return c.json<ErrorResponse>(
      badRequest('Answer must be one of the question options'),
      400
    );
  }
  const correct = parsed.answer === entry.subreddit;
  const points = scoreAnswer(correct, parsed.elapsedMs);
  const round: RoundResult = {
    questionId: entry.id,
    answer: parsed.answer,
    correct,
    correctAnswer: entry.subreddit,
    points,
  };

  const user = await getCurrentUser();
  if (!user) {
    // Anonymous: stateless by design — the server keeps no record of which
    // rounds an anonymous player has answered, so it cannot know when their
    // game finishes. The client accumulates rounds locally and builds the
    // final result itself (rank undefined, streak 0).
    return c.json<AnswerResponse>({
      type: 'answer',
      correct,
      correctAnswer: entry.subreddit,
      points,
      totalScore: points,
      roundsAnswered: 1,
      finished: false,
      result: undefined,
    });
  }

  const record = (await getPlay(user.userId, date)) ?? newPlayRecord();
  if (record.finished) {
    return c.json<ErrorResponse>(
      badRequest("You have already finished today's game"),
      400
    );
  }
  if (record.answers.some((answer) => answer.questionId === entry.id)) {
    return c.json<ErrorResponse>(
      badRequest('Question already answered'),
      400
    );
  }
  record.answers.push(round);
  record.correctCount += correct ? 1 : 0;
  const roundsAnswered = record.answers.length;
  const runningTotal = record.answers.reduce(
    (sum, answer) => sum + answer.points,
    0
  );
  if (roundsAnswered < QUESTIONS_PER_DAY) {
    record.score = runningTotal;
    await savePlay(user.userId, date, record);
    return c.json<AnswerResponse>({
      type: 'answer',
      correct,
      correctAnswer: entry.subreddit,
      points,
      totalScore: runningTotal,
      roundsAnswered,
      finished: false,
      result: undefined,
    });
  }

  // 5th round: finalize the game.
  const finalScore = totalScore(
    record.answers.map((answer) => answer.points),
    record.correctCount
  );
  const finishedAt = Date.now();
  const yesterday = addDays(date, -1);
  const [streak, stats] = await Promise.all([
    getStreak(user.userId),
    getStats(user.userId),
  ]);
  // Finished yesterday -> extend; finished today already -> unchanged (only
  // reachable if today's play record was lost, since a finished game blocks
  // replay); otherwise the streak restarts at 1.
  const newCurrent =
    streak.lastPlayed === yesterday
      ? streak.current + 1
      : streak.lastPlayed === date
        ? streak.current
        : 1;
  const newBest = Math.max(streak.best, newCurrent);
  const newStreak: StreakRecord = {
    current: newCurrent,
    best: newBest,
    lastPlayed: date,
  };
  const newStats: StatsRecord = {
    games: stats.games + 1,
    correct: stats.correct + record.correctCount,
    answered: stats.answered + QUESTIONS_PER_DAY,
    totalScore: stats.totalScore + finalScore,
    perfectDays:
      stats.perfectDays + (record.correctCount === QUESTIONS_PER_DAY ? 1 : 0),
  };
  const username = user.username ?? 'unknown';
  const flair = await awardStreakFlair({
    subredditName: context.subredditName,
    username: user.username,
    streak: newCurrent,
  });
  record.finished = true;
  record.score = finalScore;
  record.finishedAt = finishedAt;
  record.streak = newCurrent;
  record.flairEarned = flair.flairEarned;
  record.flairAwarded = flair.flairAwarded;
  await Promise.all([
    savePlay(user.userId, date, record),
    saveStreak(user.userId, newStreak),
    saveStats(user.userId, newStats),
    addLeaderboardEntry(
      date,
      user.userId,
      finalScore,
      finishedAt,
      username,
      record.correctCount
    ),
    updateStreakLeaderboard(user.userId, newBest, username),
  ]);
  const [rank, totalPlayers] = await Promise.all([
    getLeaderboardRank(date, user.userId),
    getLeaderboardSize(date),
  ]);
  return c.json<AnswerResponse>({
    type: 'answer',
    correct,
    correctAnswer: entry.subreddit,
    points,
    totalScore: finalScore,
    roundsAnswered,
    finished: true,
    result: buildResult({
      record,
      date,
      rank,
      totalPlayers,
      bestStreak: newBest,
    }),
  });
});

// ---------------------------------------------------------------------------
// GET /api/leaderboard — today's top 10 + the caller's own entry
// ---------------------------------------------------------------------------

api.get('/leaderboard', async (c) => {
  const date = utcDateString();
  const [top, totalPlayers, user] = await Promise.all([
    getTopEntries(date, 10),
    getLeaderboardSize(date),
    getCurrentUser(),
  ]);
  const entries: LeaderboardEntry[] = await Promise.all(
    top.map(async (entry, index) => ({
      rank: index + 1,
      username: entry.username,
      score: entry.score,
      correctCount: entry.correctCount,
      snoovatar: await getSnoovatar(entry.username),
    }))
  );
  let me: LeaderboardEntry | undefined;
  if (user && !top.some((entry) => entry.userId === user.userId)) {
    const [meta, rank] = await Promise.all([
      getLeaderboardMeta(date, user.userId),
      getLeaderboardRank(date, user.userId),
    ]);
    if (meta && rank !== undefined) {
      me = {
        rank,
        username: meta.username,
        score: meta.score,
        correctCount: meta.correctCount,
        snoovatar: await getSnoovatar(meta.username),
      };
    }
  }
  return c.json<LeaderboardResponse>({
    type: 'leaderboard',
    date,
    entries,
    me,
    totalPlayers,
  });
});

// ---------------------------------------------------------------------------
// GET /api/leaderboard/streaks — all-time top 10 by best streak
// ---------------------------------------------------------------------------

api.get('/leaderboard/streaks', async (c) => {
  const top = await getTopStreaks(10);
  const entries = await Promise.all(
    top.map(async (entry, index) => ({
      rank: index + 1,
      username: entry.username,
      bestStreak: entry.bestStreak,
      snoovatar: await getSnoovatar(entry.username),
    }))
  );
  return c.json<StreakLeaderboardResponse>({
    type: 'streak-leaderboard',
    entries,
  });
});

// ---------------------------------------------------------------------------
// GET /api/stats — the caller's stats (zeros for anonymous users)
// ---------------------------------------------------------------------------

api.get('/stats', async (c) => {
  const user = await getCurrentUser();
  if (!user) {
    return c.json<StatsResponse>({ type: 'stats', stats: emptyPlayerStats });
  }
  const [streak, stats] = await Promise.all([
    getStreak(user.userId),
    getStats(user.userId),
  ]);
  return c.json<StatsResponse>({
    type: 'stats',
    stats: toPlayerStats(streak, stats),
  });
});

// ---------------------------------------------------------------------------
// GET /api/yesterday — yesterday's set, with answers + notes revealed
// ---------------------------------------------------------------------------

api.get('/yesterday', async (c) => {
  const date = addDays(utcDateString(), -1);
  const set = getDailySet(questionBank, date);
  return c.json<YesterdayResponse>({
    type: 'yesterday',
    date,
    gameNumber: gameNumberForDate(date),
    questions: set.map((entry) => ({
      title: entry.title,
      body: entry.body,
      subreddit: entry.subreddit,
      options: [...entry.options],
      difficulty: entry.difficulty,
      note: entry.note ?? fallbackNote(entry.subreddit),
    })),
  });
});

// ---------------------------------------------------------------------------
// POST /api/share-comment — post the result as a comment on the current post
// ---------------------------------------------------------------------------

api.post('/share-comment', async (c) => {
  const postId = context.postId;
  if (!postId) {
    return c.json<ErrorResponse>(
      badRequest('This action requires opening the game from a post'),
      400
    );
  }
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json<ErrorResponse>(
      badRequest('Request body must be valid JSON'),
      400
    );
  }
  if (
    !isRecord(body) ||
    typeof body.text !== 'string' ||
    body.text.trim().length === 0
  ) {
    return c.json<ErrorResponse>(
      badRequest('Share text must be a non-empty string'),
      400
    );
  }
  const text = body.text.trim();
  if (!context.userId) {
    return c.json<ShareCommentResponse>({
      type: 'share-comment',
      ok: false,
      reason: 'Log in to Reddit to share your result as a comment.',
    });
  }
  try {
    await reddit.submitComment({ id: postId, text, runAs: 'USER' });
    return c.json<ShareCommentResponse>({
      type: 'share-comment',
      ok: true,
      reason: undefined,
    });
  } catch (error) {
    // Never a 500: the client falls back to clipboard copy on ok:false.
    console.error('Failed to post share comment:', error);
    const reason =
      error instanceof Error
        ? error.message
        : 'Could not post the comment.';
    return c.json<ShareCommentResponse>({
      type: 'share-comment',
      ok: false,
      reason,
    });
  }
});

// ---------------------------------------------------------------------------
// GET /api/splash — light payload for the inline (feed) view
// ---------------------------------------------------------------------------

api.get('/splash', async (c) => {
  const date = utcDateString();
  const user = await getCurrentUser();
  const [topScore, totalPlayers] = await Promise.all([
    getTopScore(date),
    getLeaderboardSize(date),
  ]);
  if (!user) {
    return c.json<SplashResponse>({
      type: 'splash',
      date,
      gameNumber: gameNumberForDate(date),
      played: false,
      score: undefined,
      topScore,
      totalPlayers,
    });
  }
  const record = await getPlay(user.userId, date);
  const played = record?.finished ?? false;
  return c.json<SplashResponse>({
    type: 'splash',
    date,
    gameNumber: gameNumberForDate(date),
    played,
    score: played ? record?.score : undefined,
    topScore,
    totalPlayers,
  });
});
