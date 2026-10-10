"use client";

import { CheckCircle2 } from "lucide-react";
import type { WizardStep } from "./useGitHubSetupWizard";

const STEPS: WizardStep[] = ["credentials", "repository", "labels", "confirm"];

interface GitHubWizardStepIndicatorProps {
  step: WizardStep;
  tokenValid: boolean;
  selectedRepo: { full_name: string } | null;
}

export function GitHubWizardStepIndicator({
  step,
  tokenValid,
  selectedRepo,
}: GitHubWizardStepIndicatorProps) {
  const isComplete = (s: WizardStep) => {
    if (s === "credentials") return tokenValid;
    if (s === "repository") return !!selectedRepo && step !== "repository";
    if (s === "labels") return step === "confirm";
    return false;
  };

  return (
    <div className="flex items-center justify-center gap-2 py-2">
      {STEPS.map((s, i) => (
        <div key={s} className="flex items-center">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
              step === s
                ? "bg-primary text-primary-foreground"
                : isComplete(s)
                  ? "bg-green-500 text-white"
                  : "bg-muted text-muted-foreground"
            }`}
          >
            {isComplete(s) ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
          </div>
          {i < STEPS.length - 1 && <div className="w-8 h-px bg-border mx-1" />}
        </div>
      ))}
    </div>
  );
}
