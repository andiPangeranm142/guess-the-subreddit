import { useEffect, useState } from 'react';
import type { PlayerStats } from '../../shared/api';
import { FLAIR_MILESTONES, MAX_DAILY_SCORE } from '../../shared/game';
import { fetchStats, toErrorMessage } from '../lib/api';
import { ErrorState, PanelSkeleton } from './States';

type StatsState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; stats: PlayerStats };

export const StatsPanel = () => {
  const [state, setState] = useState<StatsState>({ status: 'loading' });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void fetchStats()
      .then((data) => {
        if (!cancelled) {
          setState({ status: 'ready', stats: data.stats });
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setState({ status: 'error', message: toErrorMessage(err) });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const handleRetry = () => {
    setState({ status: 'loading' });
    setReloadKey((key) => key + 1);
  };

  if (state.status === 'loading') {
    return (
      <div>
        <h2 className="px-4 pt-4 text-xl font-extrabold text-ink dark:text-white">
          My stats
        </h2>
        <PanelSkeleton />
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="px-4 py-4">
        <h2 className="text-xl font-extrabold text-ink dark:text-white">
          My stats
        </h2>
        <ErrorState message={state.message} onRetry={handleRetry} />
      </div>
    );
  }

  const { stats } = state;
  const accuracy =
    stats.totalAnswered === 0
      ? 0
      : Math.round((stats.totalCorrect / stats.totalAnswered) * 100);
  const nextMilestone = FLAIR_MILESTONES.find(
    (milestone) => milestone.days > stats.bestStreak
  );

  const cards: ReadonlyArray<{
    label: string;
    value: string;
    sub: string;
  }> = [
    {
      label: 'Games played',
      value: String(stats.gamesPlayed),
      sub: 'daily puzzles finished',
    },
    {
      label: 'Accuracy',
      value: `${accuracy}%`,
      sub: `${stats.totalCorrect}/${stats.totalAnswered} answers right`,
    },
    {
      label: 'Average score',
      value: String(Math.round(stats.avgScore)),
      sub: `out of ${MAX_DAILY_SCORE} max`,
    },
    {
      label: 'Perfect days',
      value: String(stats.perfectDays),
      sub: 'all 5 rounds correct',
    },
    {
      label: 'Current streak',
      value: `🔥 ${stats.currentStreak}`,
      sub:
        stats.currentStreak === 1
          ? 'day in a row — keep it going'
          : 'days in a row — keep it going',
    },
    {
      label: 'Best streak',
      value: `🏆 ${stats.bestStreak}`,
      sub:
        stats.bestStreak === 1 ? 'day — personal best' : 'days — personal best',
    },
  ];

  return (
    <div className="flex flex-col gap-4 px-4 py-4">
      <div>
        <h2 className="text-xl font-extrabold text-ink dark:text-white">
          My stats
        </h2>
        <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
          Your sleuthing record, all in one place.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {cards.map((card) => (
          <div
            key={card.label}
            className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-night-card"
          >
            <p className="text-2xl font-extrabold text-ink tabular-nums dark:text-white">
              {card.value}
            </p>
            <p className="mt-1 text-sm font-bold text-ink dark:text-white">
              {card.label}
            </p>
            <p className="mt-0.5 text-xs text-gray-400">{card.sub}</p>
          </div>
        ))}
      </div>

      <section className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-night-card">
        <h3 className="text-base font-extrabold text-ink dark:text-white">
          Streak flair
        </h3>
        <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
          Play daily to unlock flair in the subreddit.
        </p>
        <ul className="mt-3 flex flex-col gap-2">
          {FLAIR_MILESTONES.map((milestone) => {
            const earned = stats.bestStreak >= milestone.days;
            return (
              <li
                key={milestone.days}
                className={`flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-bold ${
                  earned
                    ? 'bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200'
                    : 'bg-gray-50 text-gray-400 dark:bg-gray-800 dark:text-gray-500'
                }`}
              >
                <span>
                  {milestone.text} · {milestone.days}-day streak
                </span>
                <span>{earned ? '✓ Earned' : 'Locked'}</span>
              </li>
            );
          })}
        </ul>
        {nextMilestone !== undefined ? (
          <p className="mt-3 text-center text-sm text-gray-500 dark:text-gray-400">
            {nextMilestone.days - stats.bestStreak === 1
              ? 'One more day to unlock'
              : `${nextMilestone.days - stats.bestStreak} more days to unlock`}{' '}
            <span className="font-bold text-ink dark:text-white">
              {nextMilestone.text}
            </span>
          </p>
        ) : (
          <p className="mt-3 text-center text-sm font-bold text-amber-700 dark:text-amber-300">
            Every flair unlocked — you&apos;re a true Subreddit Sage! 🏆
          </p>
        )}
      </section>
    </div>
  );
};
