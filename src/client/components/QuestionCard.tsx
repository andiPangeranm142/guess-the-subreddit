import type { Difficulty, Question } from '../../shared/api';

export type QuestionCardProps = {
  question: Question;
};

const DIFFICULTY_STYLE: Record<Difficulty, string> = {
  easy: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300',
  medium:
    'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300',
  hard: 'bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300',
};

const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
};

/** The question, styled like a Reddit post card — with no fake author. */
export const QuestionCard = ({ question }: QuestionCardProps) => (
  <article className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm animate-slide-up dark:border-gray-700 dark:bg-night-card">
    <div className="flex items-center gap-2.5">
      <img
        src="/snoo.png"
        alt=""
        aria-hidden="true"
        className="h-9 w-9 rounded-full bg-brand-soft object-contain p-0.5 dark:bg-brand-soft-dark"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-bold tracking-wide text-gray-500 uppercase dark:text-gray-400">
          Guess the subreddit
        </p>
        <p className="text-xs text-gray-400 dark:text-gray-500">
          A post from somewhere on Reddit…
        </p>
      </div>
      <span
        className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${DIFFICULTY_STYLE[question.difficulty]}`}
      >
        {DIFFICULTY_LABEL[question.difficulty]}
      </span>
    </div>

    <h2 className="mt-4 text-lg leading-snug font-bold text-ink dark:text-white">
      {question.title}
    </h2>
    {question.body !== undefined && question.body.length > 0 ? (
      <p className="mt-3 text-sm leading-relaxed whitespace-pre-line text-gray-600 dark:text-gray-300">
        {question.body}
      </p>
    ) : undefined}
  </article>
);
