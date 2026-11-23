import { useEffect, useState } from 'react';
import { showToast } from '@devvit/web/client';
import type {
  GameResult,
  LeaderboardResponse,
  PlayerStats,
} from '../../shared/api';
import {
  emojiGrid,
  MAX_DAILY_SCORE,
  QUESTIONS_PER_DAY,
} from '../../shared/game';
import { fetchLeaderboard, postShareComment } from '../lib/api';
import { copyText } from '../lib/clipboard';
import { rankLabel } from '../lib/format';
import { Confetti } from './Confetti';
import { Countdown } from './Countdown';
import { SnooMark } from './SnooMark';

export type ResultScreenProps = {
  result: GameResult;
  gameNumber: number;
  stats: PlayerStats;
  anonymous: boolean;
  /** True when the player already finished earlier today. */
  alreadyPlayed: boolean;
  onViewLeaderboard: () => void;
  onViewStats: () => void;
  onViewYesterday: () => void;
};

export const ResultScreen = ({
  result,
  gameNumber,
  stats,
  anonymous,
  alreadyPlayed,
  onViewLeaderboard,
  onViewStats,
  onViewYesterday,
}: ResultScreenProps) => {
  const [sharing, setSharing] = useState(false);
  const [miniBoard, setMiniBoard] = useState<LeaderboardResponse | undefined>(
    undefined
  );

  useEffect(() => {
    let cancelled = false;
    void fetchLeaderboard()
      .then((data) => {
        if (!cancelled) {
          setMiniBoard(data);
        }
      })
      .catch(() => {
        // Mini leaderboard is a bonus — the result screen works without it.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const isPerfect = result.correctCount === QUESTIONS_PER_DAY;
  const grid = emojiGrid(result.grid);
  const accuracy =
    stats.totalAnswered === 0
      ? 0
      : Math.round((stats.totalCorrect / stats.totalAnswered) * 100);
  const topFive = miniBoard === undefined ? [] : miniBoard.entries.slice(0, 5);
  const meOutsideTopFive =
    miniBoard !== undefined &&
    miniBoard.me !== undefined &&
    !topFive.some((entry) => entry.username === miniBoard.me?.username);

  const handleCopy = async () => {
    const ok = await copyText(result.shareText);
    showToast(
      ok
        ? 'Result copied! Paste it anywhere.'
        : "Couldn't copy — long-press the result text to select it."
    );
  };

  const handleShareToComments = async () => {
    if (sharing) {
      return;
    }
    setSharing(true);
    try {
      const response = await postShareComment({ text: result.shareText });
      if (response.ok) {
        showToast('Posted to the comments! 🎉');
      } else {
        await copyText(result.shareText);
        showToast("Couldn't post the comment — result copied instead");
      }
    } catch {
      await copyText(result.shareText);
      showToast("Couldn't post the comment — result copied instead");
    } finally {
      setSharing(false);
    }
  };

  return (
    <div className="flex flex-col gap-5 px-4 py-5">
      {isPerfect ? <Confetti /> : undefined}
      <div className="text-center animate-slide-up">
        <p className="text-xs font-bold tracking-widest text-gray-500 uppercase dark:text-gray-400">
          <span className="inline-flex items-center gap-1.5">
            <SnooMark className="h-4 w-4" />
            Guess the Subreddit #{gameNumber}
          </span>
        </p>
        {isPerfect ? (
          <div className="mt-3 animate-confetti-pop">
            <SnooMark className="mx-auto h-16 w-16 animate-float drop-shadow-sm" />
            <p className="mt-1 text-2xl font-extrabold text-ink dark:text-white">
              Perfect game!
            </p>
            <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
              All {QUESTIONS_PER_DAY} correct — including the +100 perfect bonus
            </p>
          </div>
        ) : (
          <p className="mt-2 text-2xl font-extrabold text-ink dark:text-white">
            {alreadyPlayed ? 'Your result today' : "Today's result"}
          </p>
        )}

        <p className="mt-3 text-5xl font-extrabold tracking-tight text-ink tabular-nums dark:text-white">
          {result.score}
          <span className="text-xl font-bold text-gray-400">
            {' '}
            / {MAX_DAILY_SCORE}
          </span>
        </p>
        <p className="mt-1 text-sm font-semibold text-gray-500 dark:text-gray-400">
          {result.correctCount}/{QUESTIONS_PER_DAY} correct
        </p>
        <p
          className="mt-3 text-2xl tracking-[0.2em]"
          aria-label={`${result.correctCount} of ${QUESTIONS_PER_DAY} correct`}
        >
          {grid}
        </p>
      </div>

      <div className="flex items-center justify-center gap-2 text-center">
        {result.streak > 0 ? (
          <span className="rounded-full bg-brand-soft px-3.5 py-1.5 text-sm font-bold text-brand-dark dark:bg-brand-soft-dark dark:text-orange-300">
            <span className="inline-block animate-flame" aria-hidden="true">
              🔥
            </span>{' '}
            {result.streak}-day streak
          </span>
        ) : undefined}
        {result.rank !== undefined ? (
          <span className="rounded-full bg-ink px-3.5 py-1.5 text-sm font-bold text-white dark:bg-white dark:text-ink">
            #{result.rank} of {result.totalPlayers} today
          </span>
        ) : result.totalPlayers > 0 ? (
          <span className="rounded-full bg-gray-200 px-3.5 py-1.5 text-sm font-bold text-gray-700 dark:bg-gray-700 dark:text-gray-200">
            {result.totalPlayers} played today
          </span>
        ) : undefined}
      </div>

      {result.flairEarned !== undefined ? (
        <div className="rounded-2xl border-2 border-amber-400 bg-amber-50 px-4 py-4 text-center animate-pop dark:border-amber-500/60 dark:bg-amber-900/20">
          <p className="text-2xl">🏅</p>
          <p className="mt-1 text-base font-extrabold text-amber-800 dark:text-amber-200">
            You earned the {result.flairEarned} flair!
          </p>
          <p className="mt-0.5 text-sm text-amber-700/90 dark:text-amber-300/90">
            {result.flairAwarded
              ? 'It has been applied to your profile in the subreddit.'
              : 'It will be applied to your profile shortly.'}
          </p>
        </div>
      ) : undefined}

      <div className="flex flex-col gap-2.5">
        <button
          type="button"
          onClick={() => void handleCopy()}
          className="w-full cursor-pointer rounded-full bg-brand py-3.5 text-base font-bold text-white shadow-lg shadow-brand/30 transition hover:bg-brand-hover active:scale-[0.98]"
        >
          📋 Copy result
        </button>
        <button
          type="button"
          onClick={() => void handleShareToComments()}
          disabled={sharing}
          className="w-full cursor-pointer rounded-full border-2 border-brand py-3 text-base font-bold text-brand transition hover:bg-brand-soft active:scale-[0.98] disabled:cursor-wait disabled:opacity-60 dark:hover:bg-brand-soft-dark"
        >
          {sharing ? 'Posting…' : '💬 Share to comments'}
        </button>
      </div>

      <p className="text-center text-xs text-gray-400">
        Enjoyed today&apos;s puzzle? An upvote on the daily post helps more
        sleuths find the game.
      </p>

      {anonymous ? (
        <p className="rounded-2xl bg-gray-100 px-4 py-3 text-center text-sm text-gray-600 dark:bg-gray-800 dark:text-gray-300">
          🔒 Log in to Reddit to save your streak &amp; leaderboard rank — the
          game itself is free for everyone.
        </p>
      ) : undefined}

      {alreadyPlayed ? (
        <div className="rounded-2xl border border-gray-200 bg-white px-4 py-4 dark:border-gray-700 dark:bg-night-card">
          <Countdown />
          <p className="mt-2 text-center text-sm text-gray-500 dark:text-gray-400">
            Come back tomorrow for five fresh rounds.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={onViewLeaderboard}
              className="cursor-pointer rounded-full bg-gray-100 px-4 py-2 text-sm font-bold text-ink transition hover:bg-gray-200 dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700"
            >
              🏆 Leaderboard
            </button>
            <button
              type="button"
              onClick={onViewStats}
              className="cursor-pointer rounded-full bg-gray-100 px-4 py-2 text-sm font-bold text-ink transition hover:bg-gray-200 dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700"
            >
              📊 My stats
            </button>
            <button
              type="button"
              onClick={onViewYesterday}
              className="cursor-pointer rounded-full bg-gray-100 px-4 py-2 text-sm font-bold text-ink transition hover:bg-gray-200 dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700"
            >
              🕰️ Yesterday&apos;s answers
            </button>
          </div>
        </div>
      ) : undefined}

      <section className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-night-card">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-extrabold text-ink dark:text-white">
            Today&apos;s leaderboard
          </h3>
          <button
            type="button"
            onClick={onViewLeaderboard}
            className="cursor-pointer text-sm font-bold text-brand hover:underline"
          >
            See all →
          </button>
        </div>
        {miniBoard === undefined ? (
          <div className="mt-3 flex flex-col gap-2">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-10 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800"
              />
            ))}
          </div>
        ) : topFive.length === 0 ? (
          <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
            No scores yet today — you&apos;re among the first!
          </p>
        ) : (
          <ol className="mt-2 flex flex-col">
            {topFive.map((entry) => (
              <li
                key={entry.username}
                className="flex items-center gap-3 border-b border-gray-100 py-2.5 last:border-0 dark:border-gray-800"
              >
                <span className="w-8 text-center text-base font-bold">
                  {rankLabel(entry.rank)}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-bold text-ink dark:text-white">
                  u/{entry.username}
                </span>
                <span className="text-sm font-bold text-gray-500 tabular-nums dark:text-gray-400">
                  {entry.score}
                </span>
              </li>
            ))}
            {meOutsideTopFive && miniBoard.me !== undefined ? (
              <li className="mt-1 flex items-center gap-3 rounded-xl bg-brand-soft px-1 py-2.5 dark:bg-brand-soft-dark">
                <span className="w-8 text-center text-base font-bold">
                  {rankLabel(miniBoard.me.rank)}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-bold text-ink dark:text-white">
                  u/{miniBoard.me.username} (you)
                </span>
                <span className="text-sm font-bold text-gray-500 tabular-nums dark:text-gray-400">
                  {miniBoard.me.score}
                </span>
              </li>
            ) : undefined}
          </ol>
        )}
      </section>

      <section className="grid grid-cols-4 gap-2">
        {[
          { label: 'Games', value: String(stats.gamesPlayed) },
          { label: 'Accuracy', value: `${accuracy}%` },
          { label: 'Avg score', value: String(Math.round(stats.avgScore)) },
          {
            label: 'Best streak',
            value: (
              <>
                <span
                  className={
                    stats.bestStreak >= 1
                      ? 'inline-block animate-flame'
                      : 'inline-block'
                  }
                  aria-hidden="true"
                >
                  🔥
                </span>{' '}
                {stats.bestStreak}
              </>
            ),
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-2xl border border-gray-200 bg-white px-2 py-3 text-center dark:border-gray-700 dark:bg-night-card"
          >
            <p className="truncate text-base font-extrabold text-ink tabular-nums dark:text-white">
              {stat.value}
            </p>
            <p className="mt-0.5 text-[11px] font-semibold tracking-wide text-gray-400 uppercase">
              {stat.label}
            </p>
          </div>
        ))}
      </section>
    </div>
  );
};
