import type { Question } from '../../shared/api';
import { POINTS_PER_CORRECT } from '../../shared/game';
import type { FeedbackState } from '../hooks/useGame';
import { QuestionCard } from './QuestionCard';
import { SpeedMeter } from './SpeedMeter';

export type GameScreenProps = {
  question: Question;
  roundIndex: number;
  totalRounds: number;
  elapsedMs: number;
  feedback: FeedbackState | undefined;
  answering: boolean;
  totalScore: number;
  resumedRound: number | undefined;
  onAnswer: (option: string) => void;
  onNext: () => void;
  onDismissResume: () => void;
};

type AnswerState = 'default' | 'correct' | 'wrong' | 'dimmed';

const answerStateFor = (
  option: string,
  feedback: FeedbackState | undefined
): AnswerState => {
  if (feedback === undefined) {
    return 'default';
  }
  if (option === feedback.correctAnswer) {
    return 'correct';
  }
  if (option === feedback.selected) {
    return 'wrong';
  }
  return 'dimmed';
};

const ANSWER_CLASSES: Record<AnswerState, string> = {
  default:
    'border-gray-200 bg-white text-ink hover:border-brand hover:bg-brand-soft hover:shadow-md dark:border-gray-700 dark:bg-night-card dark:text-white dark:hover:border-brand dark:hover:bg-brand-soft-dark',
  correct:
    'border-emerald-500 bg-emerald-50 text-emerald-800 shadow-lg shadow-emerald-500/20 animate-glow-pulse dark:bg-emerald-900/40 dark:text-emerald-200',
  wrong:
    'border-rose-500 bg-rose-50 text-rose-800 animate-shake-flash dark:bg-rose-900/40 dark:text-rose-200',
  dimmed:
    'border-gray-200 bg-white text-gray-400 opacity-50 dark:border-gray-700 dark:bg-night-card dark:text-gray-500',
};

export const GameScreen = ({
  question,
  roundIndex,
  totalRounds,
  elapsedMs,
  feedback,
  answering,
  totalScore,
  resumedRound,
  onAnswer,
  onNext,
  onDismissResume,
}: GameScreenProps) => {
  const progress = totalRounds === 0 ? 0 : (roundIndex / totalRounds) * 100;
  const isLastRound = roundIndex === totalRounds - 1;
  const speedEarned =
    feedback !== undefined && feedback.correct
      ? feedback.points - POINTS_PER_CORRECT
      : 0;

  return (
    <div className="flex flex-col gap-4 px-4 py-4">
      {resumedRound !== undefined ? (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-brand/30 bg-brand-soft px-4 py-3 animate-fade-in dark:border-brand/40 dark:bg-brand-soft-dark">
          <p className="text-sm font-semibold text-ink dark:text-white">
            👋 Welcome back — you&apos;re on round {resumedRound} of{' '}
            {totalRounds}.
          </p>
          <button
            type="button"
            onClick={onDismissResume}
            aria-label="Dismiss"
            className="shrink-0 cursor-pointer rounded-full px-2 py-1 text-lg leading-none text-gray-500 hover:text-ink dark:text-gray-400 dark:hover:text-white"
          >
            ×
          </button>
        </div>
      ) : undefined}

      <div className="flex items-center justify-between text-sm">
        <span className="font-bold text-ink dark:text-white">
          Round {roundIndex + 1}
          <span className="font-medium text-gray-400"> / {totalRounds}</span>
        </span>
        <span className="rounded-full bg-ink px-3 py-1 text-xs font-extrabold text-white tabular-nums dark:bg-white dark:text-ink">
          {totalScore} pts
        </span>
      </div>

      <div
        className="h-2.5 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700"
        role="progressbar"
        aria-valuenow={roundIndex}
        aria-valuemin={0}
        aria-valuemax={totalRounds}
      >
        <div
          className="h-full rounded-full bg-brand transition-[width] duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      <QuestionCard question={question} />

      <SpeedMeter elapsedMs={elapsedMs} />

      <div className="relative flex flex-col gap-2.5">
        {feedback !== undefined && feedback.correct ? (
          <div className="pointer-events-none absolute -top-3 right-3 z-10 animate-rise">
            <span className="text-xl font-extrabold text-emerald-600 drop-shadow-sm dark:text-emerald-400">
              +{feedback.points}
            </span>
          </div>
        ) : undefined}

        {question.options.map((option) => {
          const state = answerStateFor(option, feedback);
          const disabled = feedback !== undefined || answering;
          return (
            <button
              key={option}
              type="button"
              disabled={disabled}
              onClick={() => onAnswer(option)}
              className={`relative flex w-full cursor-pointer items-center justify-between rounded-2xl border-2 px-4 py-3.5 text-left text-base font-bold transition-all duration-200 active:scale-[0.98] disabled:cursor-default ${ANSWER_CLASSES[state]}`}
            >
              <span>r/{option}</span>
              {state === 'correct' ? (
                <span className="text-lg">✓</span>
              ) : state === 'wrong' ? (
                <span className="text-lg">✗</span>
              ) : undefined}
              {state === 'correct' && feedback?.correct ? (
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute top-1/2 right-11 -mt-3 animate-rise"
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="h-6 w-6 drop-shadow-sm"
                    fill="#FF4500"
                  >
                    <path d="M12 2.5 21 13h-5.25v8.5H8.25V13H3L12 2.5Z" />
                  </svg>
                </span>
              ) : undefined}
            </button>
          );
        })}
      </div>

      {feedback !== undefined ? (
        <div className="animate-pop">
          {feedback.correct ? (
            <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-center dark:bg-emerald-900/30">
              <p className="text-base font-extrabold text-emerald-700 dark:text-emerald-300">
                Correct! +{feedback.points} points
              </p>
              <p className="mt-0.5 text-xs font-medium text-emerald-600/80 dark:text-emerald-400/80">
                {POINTS_PER_CORRECT} base + {speedEarned} speed bonus
              </p>
            </div>
          ) : (
            <div className="rounded-2xl bg-rose-50 px-4 py-3 text-center dark:bg-rose-900/30">
              <p className="text-base font-extrabold text-rose-700 dark:text-rose-300">
                Not quite!
              </p>
              <p className="mt-0.5 text-sm font-medium text-rose-600/90 dark:text-rose-400/90">
                It was r/{feedback.correctAnswer}
              </p>
            </div>
          )}
          <button
            type="button"
            onClick={onNext}
            className="mt-3 w-full cursor-pointer rounded-full bg-brand py-3 text-base font-bold text-white shadow-lg shadow-brand/30 transition hover:bg-brand-hover active:scale-[0.98]"
          >
            {isLastRound ? 'See my results →' : 'Next round →'}
          </button>
          <p className="mt-2 text-center text-xs text-gray-400">
            Auto-advancing…
          </p>
        </div>
      ) : undefined}
    </div>
  );
};
