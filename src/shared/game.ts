/**
 * Pure game logic — no Devvit imports, so it runs in unit tests.
 * Daily set selection is deterministic per UTC date: every player gets the
 * same 5 questions (2 easy + 2 medium + 1 hard) on a given day.
 */
import type {
  BankEntry,
  Difficulty,
  PlayerStats,
  Question,
  TodayResponse,
} from './api';

/** Day 1 of the game. Game numbers count up from here. */
export const GAME_EPOCH = '2026-11-23';

export const QUESTIONS_PER_DAY = 5;
export const POINTS_PER_CORRECT = 100;
export const MAX_SPEED_BONUS = 50;
export const SPEED_BONUS_DECAY_PER_SECOND = 5;
export const PERFECT_BONUS = 100;
export const MAX_DAILY_SCORE =
  QUESTIONS_PER_DAY * (POINTS_PER_CORRECT + MAX_SPEED_BONUS) + PERFECT_BONUS;

/** Streak milestones and the flair text they earn. */
export const FLAIR_MILESTONES: ReadonlyArray<{
  days: number;
  text: string;
}> = [
  { days: 3, text: '🔥 3-Day Sleuth' },
  { days: 7, text: '🕵️ Week Sleuth' },
  { days: 30, text: '🏆 Subreddit Sage' },
];

/** FNV-1a 32-bit hash — stable across runtimes. */
export const hashSeed = (value: string): number => {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
};

/** Deterministic PRNG (mulberry32). */
export const mulberry32 = (seed: number): (() => number) => {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export const shuffle = <T>(items: ReadonlyArray<T>, rand: () => number): T[] => {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = copy[i];
    copy[i] = copy[j] as T;
    copy[j] = tmp as T;
  }
  return copy;
};

/** Today's date as a UTC `YYYY-MM-DD` string. */
export const utcDateString = (when: Date = new Date()): string =>
  when.toISOString().slice(0, 10);

/** Add (or subtract) whole days to a `YYYY-MM-DD` date, in UTC. */
export const addDays = (date: string, days: number): string => {
  const d = new Date(`${date}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

/** Game number for a date: 1 on the epoch day, counting up daily. */
export const gameNumberForDate = (date: string): number => {
  const epoch = new Date(`${GAME_EPOCH}T00:00:00.000Z`).getTime();
  const day = new Date(`${date}T00:00:00.000Z`).getTime();
  return Math.floor((day - epoch) / 86_400_000) + 1;
};

/**
 * Days in one no-repeat rotation cycle, derived from the bank size: each day
 * needs 2 easy + 2 medium + 1 hard, so the cycle is limited by the smallest
 * pool (easy and medium count double). With the 150-question bank (50/50/50)
 * the cycle is 25 days.
 */
export const rotationCycleDays = (
  bank: ReadonlyArray<BankEntry>
): number => {
  const count = (difficulty: Difficulty): number =>
    bank.filter((q) => q.difficulty === difficulty).length;
  return Math.max(
    1,
    Math.min(
      Math.floor(count('easy') / 2),
      Math.floor(count('medium') / 2),
      count('hard')
    )
  );
};

/**
 * The daily set for a date: 2 easy + 2 medium + 1 hard, shuffled.
 * Deterministic — the same date always yields the same set, in the same
 * order, for every player.
 *
 * Selection is a rotation, not a fresh random draw: each difficulty pool is
 * shuffled once with a fixed seed, and each day takes the next slice of that
 * order. Within one rotation cycle (25 days with the 150-question bank) no
 * question repeats. The hard pool rotates across cycles (cycle 2 uses the
 * second half of the hard order), so every question eventually appears. The
 * 5 picked questions are shuffled with the date seed, so the in-day order
 * varies even when a cycle repeats. Throws if the bank is too small.
 */
export const getDailySet = (
  bank: ReadonlyArray<BankEntry>,
  date: string
): BankEntry[] => {
  const easyPool = bank.filter((q) => q.difficulty === 'easy');
  const mediumPool = bank.filter((q) => q.difficulty === 'medium');
  const hardPool = bank.filter((q) => q.difficulty === 'hard');
  if (easyPool.length < 2 || mediumPool.length < 2 || hardPool.length < 1) {
    throw new Error(
      `Question bank too small for a daily set (easy=${easyPool.length}, medium=${mediumPool.length}, hard=${hardPool.length})`
    );
  }
  // Fixed rotation order per difficulty — stable across days.
  const rotationRand = mulberry32(hashSeed('guess-the-sub:rotation'));
  const easyOrder = shuffle(easyPool, rotationRand);
  const mediumOrder = shuffle(mediumPool, rotationRand);
  const hardOrder = shuffle(hardPool, rotationRand);
  const cycleDays = rotationCycleDays(bank);
  const gameNumber = gameNumberForDate(date);
  const dayInCycle =
    (((gameNumber - 1) % cycleDays) + cycleDays) % cycleDays;
  const cycleNumber = Math.floor((gameNumber - 1) / cycleDays);
  const pick = (pool: ReadonlyArray<BankEntry>, index: number): BankEntry => {
    const entry =
      pool[((index % pool.length) + pool.length) % pool.length];
    if (entry === undefined) {
      throw new Error('Rotation pick out of bounds');
    }
    return entry;
  };
  const picked = [
    pick(easyOrder, 2 * dayInCycle),
    pick(easyOrder, 2 * dayInCycle + 1),
    pick(mediumOrder, 2 * dayInCycle),
    pick(mediumOrder, 2 * dayInCycle + 1),
    pick(hardOrder, dayInCycle + cycleDays * cycleNumber),
  ];
  const dayRand = mulberry32(hashSeed(`guess-the-sub:${date}`));
  return shuffle(picked, dayRand);
};

/** Strip the answer before sending a question to the client. */
export const toClientQuestion = (entry: BankEntry): Question => ({
  id: entry.id,
  title: entry.title,
  body: entry.body,
  options: [...entry.options],
  difficulty: entry.difficulty,
});

/** Speed bonus for a correct answer: +50 instantly, −5 per second, floor 0. */
export const speedBonus = (elapsedMs: number): number => {
  const clamped = Math.max(0, Math.min(30_000, elapsedMs));
  return Math.max(0, MAX_SPEED_BONUS - SPEED_BONUS_DECAY_PER_SECOND * Math.floor(clamped / 1000));
};

/** Points for one answer: 0 when wrong, 100 + speed bonus when right. */
export const scoreAnswer = (correct: boolean, elapsedMs: number): number =>
  correct ? POINTS_PER_CORRECT + speedBonus(elapsedMs) : 0;

/** Total for a finished game, including the +100 perfect bonus. */
export const totalScore = (roundPoints: ReadonlyArray<number>, correctCount: number): number => {
  const sum = roundPoints.reduce((acc, p) => acc + p, 0);
  return sum + (correctCount === QUESTIONS_PER_DAY ? PERFECT_BONUS : 0);
};

/** Emoji grid for sharing, Wordle-style. */
export const emojiGrid = (correct: ReadonlyArray<boolean>): string =>
  correct.map((c) => (c ? '🟩' : '🟥')).join('');

/** Shareable result text for copy-to-clipboard / comments. */
export const buildShareText = (args: {
  gameNumber: number;
  score: number;
  correctCount: number;
  grid: ReadonlyArray<boolean>;
  streak: number;
}): string => {
  const lines = [
    `🕵️ Guess the Subreddit #${args.gameNumber} — ${args.score}/${MAX_DAILY_SCORE}`,
    emojiGrid(args.grid),
    `${args.correctCount}/${QUESTIONS_PER_DAY} correct${args.streak > 1 ? ` · 🔥 ${args.streak}-day streak` : ''}`,
  ];
  return lines.join('\n');
};

/** Fallback "why it fits" line when a bank entry has no note. */
export const fallbackNote = (subreddit: string): string =>
  `A classic r/${subreddit} post — the tone, topic, and community in-jokes all point there.`;

/**
 * Refresh a /today snapshot with the post-game stats from a finished
 * /answer response. The snapshot is taken at mount, before the game is
 * played — for a first game its stats are all zeros. The result screen
 * reads stats from that snapshot, so the snapshot must be updated when the
 * game finishes or the stats row shows 0 games / 0% accuracy even though
 * the score, streak, and rank (which come from the fresh GameResult) are
 * correct. The header streak comes from the same snapshot, so it refreshes
 * too.
 */
export const applyFinishedStats = (
  today: TodayResponse,
  stats: PlayerStats
): TodayResponse => ({
  ...today,
  stats,
  streak: stats.currentStreak,
});
