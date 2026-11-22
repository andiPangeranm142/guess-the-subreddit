import { useState } from 'react';
import { useGame } from '../hooks/useGame';
import { formatDate } from '../lib/format';
import { GameScreen } from './GameScreen';
import { LeaderboardPanel } from './LeaderboardPanel';
import { OnboardingModal } from './OnboardingModal';
import { ResultScreen } from './ResultScreen';
import { ErrorState, GameSkeleton } from './States';
import { StatsPanel } from './StatsPanel';
import { YesterdayPanel } from './YesterdayPanel';

type Tab = 'play' | 'leaderboard' | 'stats' | 'yesterday';

const ONBOARDED_KEY = 'gts-onboarded';

const TABS: ReadonlyArray<{ id: Tab; label: string; icon: string }> = [
  { id: 'play', label: 'Play', icon: '🎮' },
  { id: 'leaderboard', label: 'Leaders', icon: '🏆' },
  { id: 'stats', label: 'Stats', icon: '📊' },
  { id: 'yesterday', label: 'Yesterday', icon: '🕰️' },
];

export const App = () => {
  const game = useGame();
  const [tab, setTab] = useState<Tab>('play');
  // Lazily read the flag once at mount — no effect needed.
  const [showOnboarding, setShowOnboarding] = useState(() => {
    try {
      return window.localStorage.getItem(ONBOARDED_KEY) !== '1';
    } catch {
      // Private mode / unavailable storage — skip onboarding silently.
      return false;
    }
  });

  const closeOnboarding = () => {
    try {
      window.localStorage.setItem(ONBOARDED_KEY, '1');
    } catch {
      // Ignore storage failures.
    }
    setShowOnboarding(false);
  };

  const today = game.today;
  const streak = today === undefined ? 0 : today.streak;

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-lg flex-col bg-paper dark:bg-night">
      <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/95 backdrop-blur dark:border-gray-800 dark:bg-night-card/95">
        <div className="flex items-center gap-3 px-4 py-3">
          <img
            src="/snoo.png"
            alt="Snoo"
            className="h-10 w-10 rounded-full bg-brand-soft object-contain p-0.5 dark:bg-brand-soft-dark"
          />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg leading-tight font-extrabold tracking-tight text-ink dark:text-white">
              Guess the Subreddit
            </h1>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
              {today === undefined
                ? 'Daily puzzle'
                : `Game #${today.gameNumber} · ${formatDate(today.date)}`}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setTab('stats')}
            aria-label="My stats"
            className="flex shrink-0 cursor-pointer items-center gap-1 rounded-full bg-brand-soft px-3 py-1.5 text-sm font-extrabold text-brand-dark transition hover:bg-brand-soft dark:bg-brand-soft-dark dark:text-orange-300"
            title="Your streak — tap for stats"
          >
            🔥 {streak}
          </button>
        </div>
      </header>

      <main className="flex-1 pb-24">
        {tab === 'play' ? (
          game.phase === 'loading' ? (
            <GameSkeleton />
          ) : game.phase === 'error' ? (
            <div className="px-4 py-4">
              <ErrorState
                message={game.error ?? 'Something went wrong.'}
                onRetry={game.retry}
              />
            </div>
          ) : game.phase === 'already-played' &&
            game.result !== undefined &&
            today !== undefined ? (
            <ResultScreen
              result={game.result}
              gameNumber={today.gameNumber}
              stats={today.stats}
              anonymous={today.anonymous}
              alreadyPlayed
              onViewLeaderboard={() => setTab('leaderboard')}
              onViewStats={() => setTab('stats')}
              onViewYesterday={() => setTab('yesterday')}
            />
          ) : game.phase === 'result' &&
            game.result !== undefined &&
            today !== undefined ? (
            <ResultScreen
              result={game.result}
              gameNumber={today.gameNumber}
              stats={today.stats}
              anonymous={today.anonymous}
              alreadyPlayed={false}
              onViewLeaderboard={() => setTab('leaderboard')}
              onViewStats={() => setTab('stats')}
              onViewYesterday={() => setTab('yesterday')}
            />
          ) : game.question !== undefined ? (
            <GameScreen
              question={game.question}
              roundIndex={game.roundIndex}
              totalRounds={game.totalRounds}
              elapsedMs={game.elapsedMs}
              feedback={game.feedback}
              answering={game.answering}
              totalScore={game.totalScore}
              resumedRound={game.resumedRound}
              onAnswer={(option) => void game.answer(option)}
              onNext={game.next}
              onDismissResume={game.dismissResume}
            />
          ) : (
            <div className="px-4 py-4">
              <ErrorState
                message="Today's puzzle isn't available right now."
                onRetry={game.retry}
              />
            </div>
          )
        ) : tab === 'leaderboard' ? (
          <LeaderboardPanel />
        ) : tab === 'stats' ? (
          <StatsPanel />
        ) : (
          <YesterdayPanel />
        )}
      </main>

      <nav
        className="fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-lg border-t border-gray-200 bg-white/95 backdrop-blur dark:border-gray-800 dark:bg-night-card/95"
        aria-label="Game sections"
      >
        <div className="grid grid-cols-4">
          {TABS.map((item) => {
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                aria-current={active ? 'page' : undefined}
                className={`flex cursor-pointer flex-col items-center gap-0.5 py-2.5 text-xs font-bold transition ${
                  active
                    ? 'text-brand'
                    : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'
                }`}
              >
                <span className="text-xl leading-none">{item.icon}</span>
                {item.label}
              </button>
            );
          })}
        </div>
        <p className="pb-2 text-center text-[10px] font-medium text-gray-300 dark:text-gray-600">
          A new puzzle every day at midnight UTC
        </p>
      </nav>

      {showOnboarding ? (
        <OnboardingModal onClose={closeOnboarding} />
      ) : undefined}
    </div>
  );
};
