import { useEffect, useState } from 'react';
import type {
  LeaderboardResponse,
  StreakLeaderboardResponse,
} from '../../shared/api';
import {
  fetchLeaderboard,
  fetchStreakLeaderboard,
  toErrorMessage,
} from '../lib/api';
import { formatDate, rankLabel } from '../lib/format';
import { EmptyState, ErrorState, PanelSkeleton } from './States';

type BoardTab = 'daily' | 'streaks';

type BoardState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'daily'; data: LeaderboardResponse }
  | { status: 'streaks'; data: StreakLeaderboardResponse };

export const LeaderboardPanel = () => {
  const [tab, setTab] = useState<BoardTab>('daily');
  const [state, setState] = useState<BoardState>({ status: 'loading' });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    if (tab === 'daily') {
      void fetchLeaderboard()
        .then((data) => {
          if (!cancelled) {
            setState({ status: 'daily', data });
          }
        })
        .catch((err: unknown) => {
          if (!cancelled) {
            setState({ status: 'error', message: toErrorMessage(err) });
          }
        });
    } else {
      void fetchStreakLeaderboard()
        .then((data) => {
          if (!cancelled) {
            setState({ status: 'streaks', data });
          }
        })
        .catch((err: unknown) => {
          if (!cancelled) {
            setState({ status: 'error', message: toErrorMessage(err) });
          }
        });
    }
    return () => {
      cancelled = true;
    };
  }, [tab, reloadKey]);

  const switchTab = (nextTab: BoardTab) => {
    if (nextTab !== tab) {
      setState({ status: 'loading' });
      setTab(nextTab);
    }
  };

  const handleRetry = () => {
    setState({ status: 'loading' });
    setReloadKey((key) => key + 1);
  };

  return (
    <div className="flex flex-col gap-4 px-4 py-4">
      <div>
        <h2 className="text-xl font-extrabold text-ink dark:text-white">
          Leaderboard
        </h2>
        <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
          {state.status === 'daily'
            ? `${formatDate(state.data.date)} · ${state.data.totalPlayers} player${state.data.totalPlayers === 1 ? '' : 's'} today`
            : 'The best guessers on Reddit'}
        </p>
      </div>

      <div
        className="flex rounded-full bg-gray-200 p-1 dark:bg-gray-800"
        role="tablist"
        aria-label="Leaderboard type"
      >
        {(
          [
            { id: 'daily', label: '🏆 Today' },
            { id: 'streaks', label: '🔥 All-time streaks' },
          ] as const
        ).map((option) => (
          <button
            key={option.id}
            type="button"
            role="tab"
            aria-selected={tab === option.id}
            onClick={() => switchTab(option.id)}
            className={`flex-1 cursor-pointer rounded-full py-2 text-sm font-bold transition ${
              tab === option.id
                ? 'bg-white text-ink shadow-sm dark:bg-night-card dark:text-white'
                : 'text-gray-500 hover:text-ink dark:text-gray-400 dark:hover:text-white'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {state.status === 'loading' ? (
        <PanelSkeleton />
      ) : state.status === 'error' ? (
        <ErrorState message={state.message} onRetry={handleRetry} />
      ) : state.status === 'daily' ? (
        state.data.entries.length === 0 ? (
          <EmptyState
            emoji="🏆"
            title="No scores yet today"
            body="Be the first to play today's puzzle and claim the top spot."
          />
        ) : (
          <ol className="flex flex-col gap-2">
            {state.data.entries.map((entry) => {
              const isMe =
                state.data.me !== undefined &&
                entry.username === state.data.me.username;
              return (
                <li
                  key={entry.username}
                  className={`flex items-center gap-3 rounded-2xl border px-4 py-3 ${
                    isMe
                      ? 'border-brand bg-brand-soft dark:bg-brand-soft-dark'
                      : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-night-card'
                  }`}
                >
                  <span className="w-8 shrink-0 text-center text-lg font-bold">
                    {rankLabel(entry.rank)}
                  </span>
                  {entry.snoovatar !== undefined ? (
                    <img
                      src={entry.snoovatar}
                      alt=""
                      aria-hidden="true"
                      className="h-8 w-8 shrink-0 rounded-full bg-gray-100 object-cover dark:bg-gray-800"
                    />
                  ) : (
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-sm font-bold text-gray-500 dark:bg-gray-800 dark:text-gray-300">
                      {entry.username.charAt(0).toUpperCase()}
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold text-ink dark:text-white">
                      u/{entry.username}
                      {isMe ? ' (you)' : ''}
                    </span>
                    <span className="block text-xs text-gray-400">
                      {entry.correctCount}/5 correct
                    </span>
                  </span>
                  <span className="text-base font-extrabold text-ink tabular-nums dark:text-white">
                    {entry.score}
                  </span>
                </li>
              );
            })}
            {state.data.me !== undefined &&
            !state.data.entries.some(
              (entry) => entry.username === state.data.me?.username
            ) ? (
              <li className="flex items-center gap-3 rounded-2xl border border-brand bg-brand-soft px-4 py-3 dark:bg-brand-soft-dark">
                <span className="w-8 shrink-0 text-center text-lg font-bold">
                  {rankLabel(state.data.me.rank)}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-bold text-ink dark:text-white">
                  u/{state.data.me.username} (you)
                </span>
                <span className="text-base font-extrabold text-ink tabular-nums dark:text-white">
                  {state.data.me.score}
                </span>
              </li>
            ) : undefined}
          </ol>
        )
      ) : state.data.entries.length === 0 ? (
        <EmptyState
          emoji="🔥"
          title="No streaks yet"
          body="Play two days in a row to start a streak — the longest streaks live here."
        />
      ) : (
        <ol className="flex flex-col gap-2">
          {state.data.entries.map((entry) => (
            <li
              key={entry.username}
              className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-night-card"
            >
              <span className="w-8 shrink-0 text-center text-lg font-bold">
                {rankLabel(entry.rank)}
              </span>
              {entry.snoovatar !== undefined ? (
                <img
                  src={entry.snoovatar}
                  alt=""
                  aria-hidden="true"
                  className="h-8 w-8 shrink-0 rounded-full bg-gray-100 object-cover dark:bg-gray-800"
                />
              ) : (
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-sm font-bold text-gray-500 dark:bg-gray-800 dark:text-gray-300">
                  {entry.username.charAt(0).toUpperCase()}
                </span>
              )}
              <span className="min-w-0 flex-1 truncate text-sm font-bold text-ink dark:text-white">
                u/{entry.username}
              </span>
              <span className="text-base font-extrabold text-ink tabular-nums dark:text-white">
                🔥 {entry.bestStreak}
                <span className="ml-1 text-xs font-semibold text-gray-400">
                  {entry.bestStreak === 1 ? 'day' : 'days'}
                </span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
};
