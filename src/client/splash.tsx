import './index.css';

import { useEffect, useState } from 'react';
import { requestExpandedMode } from '@devvit/web/client';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import type { SplashResponse } from '../shared/api';
import { MAX_DAILY_SCORE } from '../shared/game';
import { fetchSplash } from './lib/api';
import { formatDate } from './lib/format';
import { SnooMark } from './components/SnooMark';

/**
 * Inline feed view — kept deliberately light: one small fetch, no game
 * logic. The play button always works, even if the fetch fails.
 */
export const Splash = () => {
  const [data, setData] = useState<SplashResponse | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    void fetchSplash()
      .then((response) => {
        if (!cancelled) {
          setData(response);
        }
      })
      .catch(() => {
        // The play button still works without splash data.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const played = data?.played ?? false;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-paper px-6 py-8 text-center dark:bg-night">
      <div className="relative">
        <div className="absolute inset-0 -z-0 scale-125 rounded-full bg-brand-soft blur-2xl dark:bg-brand-soft-dark" />
        <img
          className="relative z-10 mx-auto h-28 w-28 animate-float object-contain"
          src="/snoo.png"
          alt="Snoo the Reddit alien, ready to sleuth"
        />
      </div>

      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-ink dark:text-white">
          Guess the <span className="text-brand">Subreddit</span>
        </h1>
        <p className="mt-1.5 text-sm text-gray-500 dark:text-gray-400">
          Five posts. Five subreddits. One daily puzzle.
        </p>
      </div>

      {data !== undefined ? (
        <p className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-1.5 text-xs font-bold text-gray-600 shadow-sm dark:bg-night-card dark:text-gray-300">
          <SnooMark className="h-3.5 w-3.5" />
          Game #{data.gameNumber} · {formatDate(data.date)}
        </p>
      ) : undefined}

      {played ? (
        <div className="flex flex-col items-center gap-1 animate-fade-in">
          <p className="text-lg font-extrabold text-ink dark:text-white">
            {data?.score !== undefined
              ? `You scored ${data.score}/${MAX_DAILY_SCORE} today! 🎉`
              : 'You already played today! 🎉'}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Come back tomorrow for five fresh rounds.
          </p>
        </div>
      ) : (
        <p className="max-w-xs text-sm leading-relaxed text-gray-600 dark:text-gray-300">
          Read the post, guess which subreddit it came from. Faster answers earn
          more points — and every day you play grows your streak. 🔥
        </p>
      )}

      <button
        type="button"
        onClick={(e) => requestExpandedMode(e.nativeEvent, 'game')}
        className="cursor-pointer rounded-full bg-brand px-8 py-3.5 text-base font-bold text-white shadow-lg shadow-brand/30 transition hover:bg-brand-hover active:scale-95"
      >
        {played ? "See today's results" : "Play today's game"}
      </button>

      {data !== undefined &&
      !played &&
      data.topScore !== undefined &&
      data.totalPlayers > 0 ? (
        <p className="text-xs font-semibold text-gray-400">
          Today&apos;s top score: {data.topScore} · {data.totalPlayers}{' '}
          {data.totalPlayers === 1 ? 'player' : 'players'} so far
        </p>
      ) : undefined}
    </div>
  );
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Splash />
  </StrictMode>
);
