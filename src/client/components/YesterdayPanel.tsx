import { useEffect, useState } from 'react';
import type { Difficulty, YesterdayResponse } from '../../shared/api';
import { fallbackNote } from '../../shared/game';
import { fetchYesterday, toErrorMessage } from '../lib/api';
import { formatDate } from '../lib/format';
import { EmptyState, ErrorState, PanelSkeleton } from './States';

type YesterdayState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: YesterdayResponse };

const DIFFICULTY_STYLE: Record<Difficulty, string> = {
  easy: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300',
  medium:
    'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300',
  hard: 'bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300',
};

export const YesterdayPanel = () => {
  const [state, setState] = useState<YesterdayState>({ status: 'loading' });
  const [expanded, setExpanded] = useState<number | undefined>(undefined);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void fetchYesterday()
      .then((data) => {
        if (!cancelled) {
          setState({ status: 'ready', data });
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

  return (
    <div className="flex flex-col gap-4 px-4 py-4">
      <div>
        <h2 className="text-xl font-extrabold text-ink dark:text-white">
          Yesterday&apos;s answers
        </h2>
        <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
          {state.status === 'ready'
            ? `Game #${state.data.gameNumber} · ${formatDate(state.data.date)} — tap a round to see why it fits.`
            : 'Yesterday’s puzzle, fully revealed.'}
        </p>
      </div>

      {state.status === 'loading' ? (
        <PanelSkeleton />
      ) : state.status === 'error' ? (
        <ErrorState message={state.message} onRetry={handleRetry} />
      ) : state.data.questions.length === 0 ? (
        <EmptyState
          emoji="🕰️"
          title="No puzzle yesterday"
          body="There was no game yesterday — check back tomorrow for today's answers."
        />
      ) : (
        <ol className="flex flex-col gap-3">
          {state.data.questions.map((question, index) => {
            const isOpen = expanded === index;
            return (
              <li
                key={`${question.title}-${index}`}
                className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-night-card"
              >
                <button
                  type="button"
                  onClick={() => setExpanded(isOpen ? undefined : index)}
                  aria-expanded={isOpen}
                  className="flex w-full cursor-pointer items-center gap-3 px-4 py-3.5 text-left"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-sm font-extrabold text-brand-dark dark:bg-brand-soft-dark dark:text-orange-300">
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold text-ink dark:text-white">
                      {question.title}
                    </span>
                    <span className="mt-0.5 block text-sm font-bold text-brand">
                      r/{question.subreddit}
                    </span>
                  </span>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${DIFFICULTY_STYLE[question.difficulty]}`}
                  >
                    {question.difficulty}
                  </span>
                  <span className="shrink-0 text-gray-400 transition-transform duration-200">
                    {isOpen ? '▲' : '▼'}
                  </span>
                </button>
                {isOpen ? (
                  <div className="border-t border-gray-100 px-4 py-3.5 animate-fade-in dark:border-gray-800">
                    {question.body !== undefined && question.body.length > 0 ? (
                      <p className="text-sm leading-relaxed whitespace-pre-line text-gray-600 dark:text-gray-300">
                        {question.body}
                      </p>
                    ) : undefined}
                    <p className="mt-3 rounded-xl bg-gray-50 px-3 py-2.5 text-sm leading-relaxed text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                      <span className="font-bold text-ink dark:text-white">
                        Why it fits:{' '}
                      </span>
                      {question.note ?? fallbackNote(question.subreddit)}
                    </p>
                    <p className="mt-2.5 text-xs text-gray-400">
                      Other options:{' '}
                      {question.options
                        .filter((option) => option !== question.subreddit)
                        .map((option) => `r/${option}`)
                        .join(' · ')}
                    </p>
                  </div>
                ) : undefined}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
};
