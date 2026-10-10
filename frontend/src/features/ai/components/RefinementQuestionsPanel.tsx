"use client";

/**
 * RefinementQuestionsPanel — Shows model completeness score and
 * categorized questions to improve the threat model.
 */
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Lightbulb, Loader2, RefreshCw } from "lucide-react";
import { useRefinementQuestions } from "../hooks/useRefinementQuestions";

const CATEGORY_COLORS: Record<string, string> = {
  authentication: "bg-purple-500/10 text-purple-700",
  data: "bg-blue-500/10 text-blue-700",
  network: "bg-green-500/10 text-green-700",
  encryption: "bg-yellow-500/10 text-yellow-700",
  integration: "bg-orange-500/10 text-orange-700",
  deployment: "bg-red-500/10 text-red-700",
};

interface RefinementQuestionsPanelProps {
  modelId: string | null;
}

export function RefinementQuestionsPanel({
  modelId,
}: RefinementQuestionsPanelProps) {
  const { data, loading, fetchQuestions } = useRefinementQuestions(modelId);

  if (!data && !loading) {
    return (
      <div className="p-4 text-center space-y-3">
        <Lightbulb className="h-8 w-8 mx-auto text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Get AI-powered suggestions to improve your threat model.
        </p>
        <Button
          size="sm"
          onClick={fetchQuestions}
          disabled={!modelId}
          aria-label="Generate refinement questions"
        >
          <Lightbulb className="h-4 w-4 mr-2" />
          Analyze Completeness
        </Button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
        <p className="text-sm">Analyzing model completeness...</p>
      </div>
    );
  }

  if (!data) return null;

  return (
    <ScrollArea className="h-full">
      <div className="p-3 space-y-3">
        {/* Completeness score */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Model Completeness</span>
            <span className="text-sm font-bold">{data.completeness}%</span>
          </div>
          <Progress value={data.completeness} className="h-2" />
          <p className="text-xs text-muted-foreground">{data.summary}</p>
        </div>

        {/* Refresh button */}
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={fetchQuestions}
          aria-label="Refresh refinement questions"
        >
          <RefreshCw className="h-3.5 w-3.5 mr-2" />
          Refresh
        </Button>

        {/* Questions grouped by category */}
        <div className="space-y-2">
          {data.questions.map((q, i) => (
            <div key={i} className="p-3 border rounded-lg space-y-1.5">
              <div className="flex items-start gap-2">
                <Badge
                  variant="secondary"
                  className={CATEGORY_COLORS[q.category] ?? ""}
                >
                  {q.category}
                </Badge>
              </div>
              <p className="text-sm">{q.question}</p>
              <p className="text-xs text-muted-foreground">
                <strong>Impact:</strong> {q.impact}
              </p>
            </div>
          ))}
        </div>
      </div>
    </ScrollArea>
  );
}
