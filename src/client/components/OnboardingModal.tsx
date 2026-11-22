export type OnboardingModalProps = {
  onClose: () => void;
};

const STEPS: ReadonlyArray<{ emoji: string; title: string; body: string }> = [
  {
    emoji: '📝',
    title: 'Read the post',
    body: 'Each round shows a real-style Reddit post — title, text, and all.',
  },
  {
    emoji: '🕵️',
    title: 'Guess the subreddit',
    body: 'Pick which of the four subreddits it came from. Faster answers earn up to +50 bonus points.',
  },
  {
    emoji: '🔥',
    title: 'Play every day',
    body: 'Five fresh rounds daily. Keep your streak alive to earn exclusive sleuth flair.',
  },
];

export const OnboardingModal = ({ onClose }: OnboardingModalProps) => (
  <div
    className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm animate-fade-in sm:items-center"
    role="dialog"
    aria-modal="true"
    aria-label="How to play"
  >
    <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl animate-slide-up dark:bg-night-card">
      <div className="flex flex-col items-center text-center">
        <img
          src="/snoo.png"
          alt="Snoo the Reddit alien"
          className="h-20 w-20 animate-float object-contain"
        />
        <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-ink dark:text-white">
          How to play
        </h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Five posts. Five subreddits. One daily puzzle.
        </p>
      </div>

      <ol className="mt-6 flex flex-col gap-4">
        {STEPS.map((step, index) => (
          <li key={step.title} className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-lg dark:bg-brand-soft-dark">
              {step.emoji}
            </span>
            <div>
              <p className="text-sm font-bold text-ink dark:text-white">
                <span className="mr-1.5 text-brand">{index + 1}.</span>
                {step.title}
              </p>
              <p className="mt-0.5 text-sm leading-snug text-gray-500 dark:text-gray-400">
                {step.body}
              </p>
            </div>
          </li>
        ))}
      </ol>

      <button
        type="button"
        onClick={onClose}
        className="mt-7 w-full cursor-pointer rounded-full bg-brand py-3.5 text-base font-bold text-white shadow-lg shadow-brand/30 transition hover:bg-brand-hover active:scale-[0.98]"
      >
        Start playing
      </button>
      <button
        type="button"
        onClick={onClose}
        className="mt-2 w-full cursor-pointer py-2 text-sm font-semibold text-gray-500 transition hover:text-ink dark:text-gray-400 dark:hover:text-white"
      >
        Skip
      </button>
    </div>
  </div>
);
