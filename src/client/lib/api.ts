/**
 * Typed fetch wrappers for the game API. Every call returns the parsed JSON
 * body typed to the matching contract in `src/shared/api.ts`, and throws a
 * user-facing Error when the request fails.
 */
import type {
  AnswerRequest,
  AnswerResponse,
  LeaderboardResponse,
  ShareCommentRequest,
  ShareCommentResponse,
  SplashResponse,
  StatsResponse,
  StreakLeaderboardResponse,
  TodayResponse,
  YesterdayResponse,
} from '../../shared/api';

/** User-facing message for a caught fetch error. */
export const toErrorMessage = (err: unknown): string =>
  err instanceof Error ? err.message : 'Something went wrong.';

const readErrorMessage = async (res: Response): Promise<string> => {
  try {
    const body: unknown = await res.json();
    if (
      typeof body === 'object' &&
      body !== null &&
      'message' in body &&
      typeof body.message === 'string' &&
      body.message.length > 0
    ) {
      return body.message;
    }
  } catch {
    // Fall through to the generic message below.
  }
  return `Request failed (${res.status})`;
};

const requestJson = async <T>(path: string, init?: RequestInit): Promise<T> => {
  let res: Response;
  try {
    res = await fetch(path, init);
  } catch {
    throw new Error(
      'Could not reach the server. Check your connection and try again.'
    );
  }
  if (!res.ok) {
    throw new Error(await readErrorMessage(res));
  }
  return res.json();
};

const postJson = <T>(path: string, body: unknown): Promise<T> =>
  requestJson<T>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

export const fetchToday = (): Promise<TodayResponse> =>
  requestJson<TodayResponse>('/api/today');

export const submitAnswer = (body: AnswerRequest): Promise<AnswerResponse> =>
  postJson<AnswerResponse>('/api/answer', body);

export const fetchLeaderboard = (): Promise<LeaderboardResponse> =>
  requestJson<LeaderboardResponse>('/api/leaderboard');

export const fetchStreakLeaderboard = (): Promise<StreakLeaderboardResponse> =>
  requestJson<StreakLeaderboardResponse>('/api/leaderboard/streaks');

export const fetchStats = (): Promise<StatsResponse> =>
  requestJson<StatsResponse>('/api/stats');

export const fetchYesterday = (): Promise<YesterdayResponse> =>
  requestJson<YesterdayResponse>('/api/yesterday');

export const postShareComment = (
  body: ShareCommentRequest
): Promise<ShareCommentResponse> =>
  postJson<ShareCommentResponse>('/api/share-comment', body);

export const fetchSplash = (): Promise<SplashResponse> =>
  requestJson<SplashResponse>('/api/splash');
