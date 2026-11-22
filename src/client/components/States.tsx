export type ErrorStateProps = {
  message: string;
  onRetry: () => void;
};

export const ErrorState = ({ message, onRetry }: ErrorStateProps) => (
  <div className="flex flex-col items-center gap-4 px-6 py-14 text-center animate-fade-in">
    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-soft text-3xl dark:bg-brand-soft-dark">
      😿
    </div>
    <div>
      <p className="text-lg font-bold text-ink dark:text-white">
        Couldn&apos;t load the game
      </p>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{message}</p>
    </div>
    <button
      type="button"
      onClick={onRetry}
      className="cursor-pointer rounded-full bg-brand px-6 py-2.5 text-sm font-bold text-white shadow-md transition hover:bg-brand-hover active:scale-95"
    >
      Try again
    </button>
  </div>
);

export const GameSkeleton = () => (
  <div className="flex flex-col gap-4 px-4 py-4 animate-fade-in">
    <div className="h-2.5 w-full animate-pulse rounded-full bg-gray-200 dark:bg-gray-700" />
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-night-card">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 animate-pulse rounded-full bg-gray-200 dark:bg-gray-700" />
        <div className="h-4 w-32 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
      </div>
      <div className="mt-4 h-6 w-full animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
      <div className="mt-2 h-6 w-3/4 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
      <div className="mt-4 h-4 w-full animate-pulse rounded bg-gray-100 dark:bg-gray-800" />
      <div className="mt-2 h-4 w-5/6 animate-pulse rounded bg-gray-100 dark:bg-gray-800" />
    </div>
    <div className="h-8 animate-pulse rounded-full bg-gray-200 dark:bg-gray-700" />
    {[0, 1, 2, 3].map((i) => (
      <div
        key={i}
        className="h-14 animate-pulse rounded-2xl bg-gray-200 dark:bg-gray-700"
      />
    ))}
  </div>
);

export const PanelSkeleton = () => (
  <div className="flex flex-col gap-3 px-4 py-4 animate-fade-in">
    {[0, 1, 2, 3, 4].map((i) => (
      <div
        key={i}
        className="h-16 animate-pulse rounded-2xl bg-gray-200 dark:bg-gray-700"
      />
    ))}
  </div>
);

export type EmptyStateProps = {
  emoji: string;
  title: string;
  body: string;
};

export const EmptyState = ({ emoji, title, body }: EmptyStateProps) => (
  <div className="flex flex-col items-center gap-3 px-6 py-12 text-center animate-fade-in">
    <span className="text-4xl">{emoji}</span>
    <p className="text-base font-bold text-ink dark:text-white">{title}</p>
    <p className="max-w-xs text-sm text-gray-500 dark:text-gray-400">{body}</p>
  </div>
);
