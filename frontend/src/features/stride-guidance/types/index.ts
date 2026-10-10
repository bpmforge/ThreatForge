import type { StrideCategory } from "@/types/canvas";

export interface TutorialProgress {
  started: boolean;
  completed: boolean;
  currentCategory: number;
  quizAnswers: Record<string, StrideCategory>;
  correctCount: number;
}

export interface StrideTutorialContent {
  category: StrideCategory;
  name: string;
  letter: string;
  definition: string;
  realWorldExample: string;
  commonMistakes: string[];
  quiz: TutorialQuizQuestion;
}

interface TutorialQuizQuestion {
  scenario: string;
  correctAnswer: StrideCategory;
  explanation: string;
}

export interface ReadinessCheck {
  id: string;
  name: string;
  description: string;
  severity: "blocker" | "warning" | "suggestion";
  passed: boolean;
  message: string;
  fixAction?: {
    label: string;
    action: "navigate" | "dialog" | "auto-fix";
    target?: string;
  };
}

export interface ReadinessResult {
  score: number;
  maxScore: number;
  percentage: number;
  status: "not-ready" | "needs-work" | "almost-ready" | "ready";
  blockers: ReadinessCheck[];
  warnings: ReadinessCheck[];
  suggestions: ReadinessCheck[];
}
