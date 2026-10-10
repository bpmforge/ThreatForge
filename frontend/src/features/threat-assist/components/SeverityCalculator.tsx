"use client";

import { Calculator, ChevronRight, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useSeverityCalculation } from "../hooks/useSeverityCalculation";

interface SeverityCalculatorProps {
  onSeveritySelect: (severity: "low" | "medium" | "high" | "critical") => void;
  initialSeverity?: "low" | "medium" | "high" | "critical";
  className?: string;
}

const severityColors = {
  critical: "bg-red-500",
  high: "bg-orange-500",
  medium: "bg-yellow-500",
  low: "bg-blue-500",
};

export function SeverityCalculator({
  onSeveritySelect,
  className,
}: SeverityCalculatorProps) {
  const { answers, setAnswer, reset, result, questions, progress } =
    useSeverityCalculation();

  const handleUseRecommended = () => {
    if (result) {
      onSeveritySelect(result.severity);
    }
  };

  return (
    <div className={cn("border rounded-lg overflow-hidden", className)}>
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 border-b">
        <Calculator className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">Severity Calculator</span>
        <span className="text-xs text-muted-foreground">(Optional)</span>
        {Object.keys(answers).length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 ml-auto"
            onClick={reset}
          >
            <RotateCcw className="h-3 w-3 mr-1" />
            <span className="text-xs">Reset</span>
          </Button>
        )}
      </div>

      {/* Progress bar */}
      <div className="px-3 py-2 border-b">
        <Progress value={progress} className="h-1" />
        <span className="text-xs text-muted-foreground">
          {progress}% complete
        </span>
      </div>

      {/* Questions */}
      <div className="max-h-64 overflow-y-auto">
        {questions.map((question, index) => (
          <div key={question.id} className="px-3 py-2 border-b last:border-b-0">
            <p className="text-sm font-medium mb-2">
              {index + 1}. {question.question}
            </p>
            <div className="space-y-1">
              {question.options.map((option) => (
                <button
                  key={option.score}
                  type="button"
                  onClick={() => setAnswer(question.id, option.score)}
                  className={cn(
                    "w-full text-left px-2 py-1.5 rounded text-sm transition-colors",
                    "hover:bg-muted/50 focus:outline-none focus:ring-1 focus:ring-blue-500",
                    answers[question.id] === option.score &&
                      "bg-blue-100 text-blue-900",
                  )}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className={cn(
                        "w-3 h-3 rounded-full border-2 flex-shrink-0",
                        answers[question.id] === option.score
                          ? "border-blue-500 bg-blue-500"
                          : "border-gray-300",
                      )}
                    />
                    <span>{option.label}</span>
                  </div>
                  {option.description && (
                    <p className="text-xs text-muted-foreground ml-5">
                      {option.description}
                    </p>
                  )}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Result */}
      {result && (
        <div className="px-3 py-3 bg-muted/30 border-t">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Recommended Severity:</span>
            <Badge
              className={cn(
                "uppercase text-white",
                severityColors[result.severity],
              )}
            >
              {result.severity}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            {result.explanation}
          </p>
          <div className="flex gap-2">
            <Button size="sm" className="flex-1" onClick={handleUseRecommended}>
              Use Recommended
              <ChevronRight className="h-3 w-3 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
