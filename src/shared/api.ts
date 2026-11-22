/**
 * Shared API contract between the Devvit server (Hono routes) and the
 * React client. The server owns the question bank and all scoring; the
 * client never sees correct answers until the server reveals them.
 */

export type Difficulty = 'easy' | 'medium' | 'hard';

/** One question as the client sees it — no answer included. */
export type Question = {
  id: string;
  title: string;
  body: string | undefined;
  options: string[];
  difficulty: Difficulty;
};

/** One bank entry (server-side only). `note` explains why the post fits its
 * subreddit; shown in the "Yesterday's answers" panel when present. */
export type BankEntry = {
  id: string;
  title: string;
  body: string | undefined;
  subreddit: string;
  options: string[];
  difficulty: Difficulty;
  category: string;
  note: string | undefined;
};

export type RoundResult = {
  questionId: string;
  answer: string;
  correct: boolean;
  correctAnswer: string;
  points: number;
};

export type GameResult = {
  score: number;
  correctCount: number;
  /** true = correct (🟩), false = wrong (🟥), in round order. */
  grid: boolean[];
  rank: number | undefined;
  totalPlayers: number;
  streak: number;
  bestStreak: number;
  /** Flair text earned by this game's streak milestone, if any. */
  flairEarned: string | undefined;
  /** True only when the Reddit flair API call actually succeeded. */
  flairAwarded: boolean;
  shareText: string;
};

export type PlayerStats = {
  gamesPlayed: number;
  totalCorrect: number;
  totalAnswered: number;
  avgScore: number;
  bestStreak: number;
  currentStreak: number;
  perfectDays: number;
};

export type LeaderboardEntry = {
  rank: number;
  username: string;
  score: number;
  correctCount: number;
  snoovatar: string | undefined;
};

export type YesterdayQuestion = {
  title: string;
  body: string | undefined;
  subreddit: string;
  options: string[];
  difficulty: Difficulty;
  note: string | undefined;
};

export type TodayResponse = {
  type: 'today';
  date: string;
  gameNumber: number;
  questions: Question[];
  alreadyPlayed: boolean;
  previousResult: GameResult | undefined;
  /** Rounds already answered today (resume after closing mid-game). */
  progress: RoundResult[];
  username: string | undefined;
  anonymous: boolean;
  streak: number;
  stats: PlayerStats;
};

export type AnswerRequest = {
  questionId: string;
  answer: string;
  /** Milliseconds from the question being shown to the answer tap. */
  elapsedMs: number;
};

export type AnswerResponse = {
  type: 'answer';
  correct: boolean;
  correctAnswer: string;
  points: number;
  totalScore: number;
  roundsAnswered: number;
  finished: boolean;
  result: GameResult | undefined;
};

export type LeaderboardResponse = {
  type: 'leaderboard';
  date: string;
  entries: LeaderboardEntry[];
  me: LeaderboardEntry | undefined;
  totalPlayers: number;
};

export type StreakLeaderboardEntry = {
  rank: number;
  username: string;
  bestStreak: number;
  snoovatar: string | undefined;
};

export type StreakLeaderboardResponse = {
  type: 'streak-leaderboard';
  entries: StreakLeaderboardEntry[];
};

export type StatsResponse = {
  type: 'stats';
  stats: PlayerStats;
};

export type YesterdayResponse = {
  type: 'yesterday';
  date: string;
  gameNumber: number;
  questions: YesterdayQuestion[];
};

export type ShareCommentRequest = {
  text: string;
};

export type ShareCommentResponse = {
  type: 'share-comment';
  ok: boolean;
  reason: string | undefined;
};

export type SplashResponse = {
  type: 'splash';
  date: string;
  gameNumber: number;
  played: boolean;
  score: number | undefined;
  topScore: number | undefined;
  totalPlayers: number;
};

export type ErrorResponse = {
  status: 'error';
  message: string;
};
