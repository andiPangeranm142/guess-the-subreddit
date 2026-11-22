import { useCallback, useEffect, useRef, useState } from 'react';
import { showToast } from '@devvit/web/client';
import type {
  GameResult,
  Question,
  RoundResult,
  TodayResponse,
} from '../../shared/api';
import {
  buildShareText,
  PERFECT_BONUS,
  QUESTIONS_PER_DAY,
} from '../../shared/game';
import { fetchToday, submitAnswer, toErrorMessage } from '../lib/api';

export type GamePhase =
  'loading' | 'playing' | 'result' | 'already-played' | 'error';

export type FeedbackState = {
  selected: string;
  correct: boolean;
  correctAnswer: string;
  points: number;
};

/** Milliseconds the feedback stays on screen before auto-advancing. */
const FEEDBACK_MS = 1200;

export type UseGame = {
  phase: GamePhase;
  today: TodayResponse | undefined;
  question: Question | undefined;
  roundIndex: number;
  totalRounds: number;
  results: ReadonlyArray<RoundResult>;
  totalScore: number;
  feedback: FeedbackState | undefined;
  result: GameResult | undefined;
  elapsedMs: number;
  answering: boolean;
  error: string | undefined;
  /** Round number (1-based) the player resumed on, when resuming mid-game. */
  resumedRound: number | undefined;
  answer: (option: string) => Promise<void>;
  next: () => void;
  retry: () => void;
  dismissResume: () => void;
};

/**
 * Fallback result built from local rounds, used only if the server finishes
 * a game without returning a result (defensive — the contract says it does).
 */
const buildLocalResult = (
  rounds: ReadonlyArray<RoundResult>,
  streak: number,
  bestStreak: number,
  gameNumber: number
): GameResult => {
  const correctCount = rounds.filter((r) => r.correct).length;
  const sum = rounds.reduce((acc, r) => acc + r.points, 0);
  const score = sum + (correctCount === QUESTIONS_PER_DAY ? PERFECT_BONUS : 0);
  const grid = rounds.map((r) => r.correct);
  return {
    score,
    correctCount,
    grid,
    rank: undefined,
    totalPlayers: 0,
    streak,
    bestStreak,
    flairEarned: undefined,
    flairAwarded: false,
    shareText: buildShareText({
      gameNumber,
      score,
      correctCount,
      grid,
      streak,
    }),
  };
};

export const useGame = (): UseGame => {
  const [phase, setPhase] = useState<GamePhase>('loading');
  const [today, setToday] = useState<TodayResponse | undefined>(undefined);
  const [results, setResults] = useState<ReadonlyArray<RoundResult>>([]);
  const [roundIndex, setRoundIndex] = useState(0);
  const [totalScore, setTotalScore] = useState(0);
  const [feedback, setFeedback] = useState<FeedbackState | undefined>(
    undefined
  );
  const [result, setResult] = useState<GameResult | undefined>(undefined);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [answering, setAnswering] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const [resumedRound, setResumedRound] = useState<number | undefined>(
    undefined
  );
  const [reloadKey, setReloadKey] = useState(0);

  // Set to Date.now() by load()/advance() before any round is played.
  const questionStartedAt = useRef<number>(0);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  );
  const pendingResult = useRef<GameResult | undefined>(undefined);

  const clearAdvanceTimer = useCallback(() => {
    if (advanceTimer.current !== undefined) {
      clearTimeout(advanceTimer.current);
      advanceTimer.current = undefined;
    }
  }, []);

  useEffect(() => clearAdvanceTimer, [clearAdvanceTimer]);

  /** Apply a fetched /api/today payload to the game state machine. */
  const applyToday = useCallback((data: TodayResponse) => {
    setToday(data);
    if (data.alreadyPlayed && data.previousResult !== undefined) {
      setResult(data.previousResult);
      setResults([]);
      setTotalScore(data.previousResult.score);
      setPhase('already-played');
      return;
    }
    const answered = data.progress.length;
    const progressScore = data.progress.reduce((acc, r) => acc + r.points, 0);
    setResults(data.progress);
    setTotalScore(progressScore);
    if (answered >= data.questions.length && data.questions.length > 0) {
      // All rounds answered but the server did not flag the game as
      // played — treat it as finished with a locally built result.
      setResult(
        buildLocalResult(
          data.progress,
          data.streak,
          data.stats.bestStreak,
          data.gameNumber
        )
      );
      setPhase('result');
      return;
    }
    setRoundIndex(answered);
    if (answered > 0) {
      setResumedRound(answered + 1);
    }
    questionStartedAt.current = Date.now();
    setElapsedMs(0);
    setPhase('playing');
  }, []);

  useEffect(() => {
    let cancelled = false;
    void fetchToday()
      .then((data) => {
        if (!cancelled) {
          applyToday(data);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(toErrorMessage(err));
          setPhase('error');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [applyToday, reloadKey]);

  // Tick the speed-bonus clock while a question is on screen and unanswered.
  useEffect(() => {
    if (phase !== 'playing' || feedback !== undefined) {
      return undefined;
    }
    const timer = setInterval(() => {
      setElapsedMs(Date.now() - questionStartedAt.current);
    }, 100);
    return () => clearInterval(timer);
  }, [phase, feedback, roundIndex]);

  const advance = useCallback(() => {
    clearAdvanceTimer();
    setFeedback(undefined);
    const finished = pendingResult.current;
    if (finished !== undefined) {
      pendingResult.current = undefined;
      setResult(finished);
      setTotalScore(finished.score);
      setPhase('result');
      return;
    }
    setRoundIndex((prev) => prev + 1);
    questionStartedAt.current = Date.now();
    setElapsedMs(0);
  }, [clearAdvanceTimer]);

  const answer = useCallback(
    async (option: string) => {
      if (
        phase !== 'playing' ||
        feedback !== undefined ||
        answering ||
        today === undefined
      ) {
        return;
      }
      const question = today.questions[roundIndex];
      if (question === undefined) {
        return;
      }
      const elapsed = Date.now() - questionStartedAt.current;
      setAnswering(true);
      try {
        const response = await submitAnswer({
          questionId: question.id,
          answer: option,
          elapsedMs: elapsed,
        });
        const round: RoundResult = {
          questionId: question.id,
          answer: option,
          correct: response.correct,
          correctAnswer: response.correctAnswer,
          points: response.points,
        };
        const nextResults = [...results, round];
        setResults(nextResults);
        // Anonymous players have no server-side running total (the server is
        // stateless for them), so accumulate the score locally instead.
        const runningTotal = today.anonymous
          ? nextResults.reduce((acc, r) => acc + r.points, 0)
          : response.totalScore;
        setTotalScore(runningTotal);
        setFeedback({
          selected: option,
          correct: response.correct,
          correctAnswer: response.correctAnswer,
          points: response.points,
        });
        // The server finishes logged-in games. Anonymous games finish locally
        // once all rounds are answered — the server cannot track their
        // progress, so it never returns finished:true for them.
        const allAnswered = nextResults.length >= today.questions.length;
        if (response.finished || (today.anonymous && allAnswered)) {
          pendingResult.current =
            response.result ??
            buildLocalResult(
              nextResults,
              today.streak,
              today.stats.bestStreak,
              today.gameNumber
            );
        }
        advanceTimer.current = setTimeout(() => advance(), FEEDBACK_MS);
      } catch {
        showToast('Something went wrong — please try again.');
      } finally {
        setAnswering(false);
      }
    },
    [phase, feedback, answering, today, roundIndex, results, advance]
  );

  const retry = useCallback(() => {
    setPhase('loading');
    setError(undefined);
    setFeedback(undefined);
    setResult(undefined);
    pendingResult.current = undefined;
    clearAdvanceTimer();
    setReloadKey((key) => key + 1);
  }, [clearAdvanceTimer]);

  const dismissResume = useCallback(() => {
    setResumedRound(undefined);
  }, []);

  const question =
    today === undefined ? undefined : today.questions[roundIndex];

  return {
    phase,
    today,
    question,
    roundIndex,
    totalRounds:
      today === undefined ? QUESTIONS_PER_DAY : today.questions.length,
    results,
    totalScore,
    feedback,
    result,
    elapsedMs,
    answering,
    error,
    resumedRound,
    answer,
    next: advance,
    retry,
    dismissResume,
  };
};
