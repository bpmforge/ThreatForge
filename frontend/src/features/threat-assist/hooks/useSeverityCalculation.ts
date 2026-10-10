"use client";

import { useState, useCallback, useMemo } from "react";
import {
  SEVERITY_QUESTIONS,
  calculateSeverity,
} from "../data/severity-questions";
import type { SeverityCalculationResult } from "../types";

interface UseSeverityCalculationReturn {
  /** Current answers */
  answers: Record<string, number>;
  /** Set an answer */
  setAnswer: (questionId: string, score: number) => void;
  /** Reset all answers */
  reset: () => void;
  /** Calculate result from current answers */
  result: SeverityCalculationResult | null;
  /** Whether all questions have been answered */
  isComplete: boolean;
  /** Questions data */
  questions: typeof SEVERITY_QUESTIONS;
  /** Progress (0-100) */
  progress: number;
}

export function useSeverityCalculation(): UseSeverityCalculationReturn {
  const [answers, setAnswers] = useState<Record<string, number>>({});

  const setAnswer = useCallback((questionId: string, score: number) => {
    setAnswers((prev) => ({ ...prev, [questionId]: score }));
  }, []);

  const reset = useCallback(() => {
    setAnswers({});
  }, []);

  const answeredCount = Object.keys(answers).length;
  const totalQuestions = SEVERITY_QUESTIONS.length;
  const isComplete = answeredCount === totalQuestions;
  const progress = Math.round((answeredCount / totalQuestions) * 100);

  const result = useMemo(() => {
    if (answeredCount === 0) return null;
    return calculateSeverity(answers);
  }, [answers, answeredCount]);

  return {
    answers,
    setAnswer,
    reset,
    result,
    isComplete,
    questions: SEVERITY_QUESTIONS,
    progress,
  };
}
