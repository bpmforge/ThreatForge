"use client";

import { useState, useEffect } from "react";
import {
  GraduationCap,
  ChevronRight,
  ChevronLeft,
  Check,
  X,
  Trophy,
  Lightbulb,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { STRIDE_TUTORIAL } from "../data/stride-tutorial";
import { useTutorialProgress } from "../hooks/useTutorialProgress";
import type { StrideCategory } from "@/types/canvas";

interface StrideTutorialDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete?: () => void;
}

type TutorialPhase = "learn" | "quiz" | "result";

export function StrideTutorialDialog({
  open,
  onOpenChange,
  onComplete,
}: StrideTutorialDialogProps): React.ReactElement {
  const {
    progress: tutorialProgress,
    markTutorialCompleted,
    saveProgress,
  } = useTutorialProgress();

  const [currentIndex, setCurrentIndex] = useState(
    tutorialProgress.currentCategory || 0,
  );
  const [phase, setPhase] = useState<TutorialPhase>("learn");
  const [selectedAnswer, setSelectedAnswer] = useState<StrideCategory | null>(
    null,
  );
  const [showExplanation, setShowExplanation] = useState(false);
  const [correctAnswers, setCorrectAnswers] = useState(
    tutorialProgress.correctCount || 0,
  );

  // Restore progress when dialog opens
  useEffect(() => {
    if (open && tutorialProgress.started && !tutorialProgress.completed) {
      setCurrentIndex(tutorialProgress.currentCategory || 0);
      setCorrectAnswers(tutorialProgress.correctCount || 0);
    }
  }, [open, tutorialProgress]);

  const currentItem = STRIDE_TUTORIAL[currentIndex];
  const progress = ((currentIndex + 1) / STRIDE_TUTORIAL.length) * 100;
  const isLastItem = currentIndex === STRIDE_TUTORIAL.length - 1;

  const handleNext = () => {
    if (phase === "learn") {
      setPhase("quiz");
      setSelectedAnswer(null);
      setShowExplanation(false);
      // Save progress when starting quiz for this category
      saveProgress({ started: true, currentCategory: currentIndex });
    } else if (phase === "quiz" && showExplanation) {
      if (isLastItem) {
        setPhase("result");
      } else {
        const nextIndex = currentIndex + 1;
        setCurrentIndex(nextIndex);
        setPhase("learn");
        setSelectedAnswer(null);
        setShowExplanation(false);
        // Save progress after completing a category
        saveProgress({
          currentCategory: nextIndex,
          correctCount: correctAnswers,
        });
      }
    }
  };

  const handlePrevious = () => {
    if (phase === "quiz" && !showExplanation) {
      setPhase("learn");
    } else if (currentIndex > 0) {
      setCurrentIndex((i) => i - 1);
      setPhase("learn");
      setSelectedAnswer(null);
      setShowExplanation(false);
    }
  };

  const handleAnswerSelect = (answer: StrideCategory) => {
    if (showExplanation) return;
    setSelectedAnswer(answer);
  };

  const handleCheckAnswer = () => {
    if (!selectedAnswer) return;
    setShowExplanation(true);
    if (selectedAnswer === currentItem.quiz.correctAnswer) {
      setCorrectAnswers((c) => c + 1);
    }
  };

  const handleComplete = () => {
    // Save final completion to backend
    markTutorialCompleted(correctAnswers);
    onComplete?.();
    onOpenChange(false);
    // Reset local state
    setCurrentIndex(0);
    setPhase("learn");
    setSelectedAnswer(null);
    setShowExplanation(false);
    setCorrectAnswers(0);
  };

  const isCorrect = selectedAnswer === currentItem.quiz.correctAnswer;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-blue-600" />
            STRIDE Tutorial
          </DialogTitle>
          <DialogDescription>
            Learn the STRIDE threat modeling methodology
          </DialogDescription>
        </DialogHeader>

        {/* Progress bar */}
        {phase !== "result" && (
          <div className="space-y-1">
            <Progress value={progress} className="h-2" />
            <p className="text-xs text-muted-foreground text-right">
              {currentIndex + 1} of {STRIDE_TUTORIAL.length}
            </p>
          </div>
        )}

        {/* Content area */}
        <div className="flex-1 overflow-auto py-4">
          {phase === "result" ? (
            // Final results
            <div className="text-center py-8">
              <Trophy className="h-16 w-16 mx-auto mb-4 text-yellow-500" />
              <h3 className="text-xl font-bold mb-2">Tutorial Complete!</h3>
              <p className="text-muted-foreground mb-4">
                You got {correctAnswers} out of {STRIDE_TUTORIAL.length}{" "}
                questions correct.
              </p>
              <Badge
                className={cn(
                  "text-sm px-3 py-1",
                  correctAnswers === STRIDE_TUTORIAL.length
                    ? "bg-green-500"
                    : correctAnswers >= 4
                      ? "bg-blue-500"
                      : "bg-orange-500",
                )}
              >
                {correctAnswers === STRIDE_TUTORIAL.length
                  ? "Perfect Score!"
                  : correctAnswers >= 4
                    ? "Great Job!"
                    : "Keep Learning!"}
              </Badge>
            </div>
          ) : phase === "learn" ? (
            // Learning content
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Badge className="text-lg px-3 py-1 bg-blue-600">
                  {currentItem.letter}
                </Badge>
                <h3 className="text-xl font-bold">{currentItem.name}</h3>
              </div>

              <div className="p-4 bg-muted/50 rounded-lg">
                <p className="text-sm">{currentItem.definition}</p>
              </div>

              <div>
                <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                  <Lightbulb className="h-4 w-4 text-yellow-500" />
                  Real-World Example
                </h4>
                <p className="text-sm text-muted-foreground">
                  {currentItem.realWorldExample}
                </p>
              </div>

              <div>
                <h4 className="text-sm font-medium mb-2">Common Mistakes</h4>
                <ul className="space-y-1">
                  {currentItem.commonMistakes.map((mistake, i) => (
                    <li
                      key={i}
                      className="text-sm text-muted-foreground flex items-start gap-2"
                    >
                      <X className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                      {mistake}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            // Quiz
            <div className="space-y-4">
              <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                <h4 className="text-sm font-medium mb-2">Quick Check</h4>
                <p className="text-sm">{currentItem.quiz.scenario}</p>
              </div>

              <p className="text-sm font-medium">
                Which STRIDE category best describes this?
              </p>

              <div className="grid grid-cols-2 gap-2">
                {STRIDE_TUTORIAL.map((item) => (
                  <button
                    key={item.category}
                    onClick={() => handleAnswerSelect(item.category)}
                    disabled={showExplanation}
                    className={cn(
                      "p-3 rounded-lg border text-left transition-colors",
                      "focus:outline-none focus:ring-2 focus:ring-blue-500",
                      selectedAnswer === item.category
                        ? showExplanation
                          ? isCorrect
                            ? "border-green-500 bg-green-50"
                            : "border-red-500 bg-red-50"
                          : "border-blue-500 bg-blue-50"
                        : showExplanation &&
                            item.category === currentItem.quiz.correctAnswer
                          ? "border-green-500 bg-green-50"
                          : "hover:bg-muted/50",
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        {item.letter}
                      </Badge>
                      <span className="text-sm font-medium">{item.name}</span>
                    </div>
                  </button>
                ))}
              </div>

              {showExplanation && (
                <div
                  className={cn(
                    "p-4 rounded-lg border",
                    isCorrect
                      ? "bg-green-50 border-green-200"
                      : "bg-red-50 border-red-200",
                  )}
                >
                  <div className="flex items-center gap-2 mb-2">
                    {isCorrect ? (
                      <Check className="h-5 w-5 text-green-600" />
                    ) : (
                      <X className="h-5 w-5 text-red-600" />
                    )}
                    <span
                      className={cn(
                        "font-medium",
                        isCorrect ? "text-green-700" : "text-red-700",
                      )}
                    >
                      {isCorrect ? "Correct!" : "Not quite"}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {currentItem.quiz.explanation}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer navigation */}
        <div className="flex justify-between pt-4 border-t">
          {phase === "result" ? (
            <Button onClick={handleComplete} className="w-full">
              <Check className="h-4 w-4 mr-2" />
              Complete Tutorial
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={handlePrevious}
                disabled={currentIndex === 0 && phase === "learn"}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back
              </Button>

              {phase === "quiz" && !showExplanation ? (
                <Button onClick={handleCheckAnswer} disabled={!selectedAnswer}>
                  Check Answer
                </Button>
              ) : (
                <Button onClick={handleNext}>
                  {phase === "learn"
                    ? "Take Quiz"
                    : isLastItem
                      ? "See Results"
                      : "Next"}
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
