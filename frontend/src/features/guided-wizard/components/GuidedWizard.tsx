"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Shield,
  AlertTriangle,
  Eye,
  Undo2,
  Ban,
  ArrowUpCircle,
} from "lucide-react";
import { useGuidedWizard } from "../hooks/useGuidedWizard";
import { WizardProgress } from "./WizardProgress";
import { SystemTypeStep } from "./steps/SystemTypeStep";
import { ComponentsStep } from "./steps/ComponentsStep";

interface GuidedWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: (components: { name: string; type: string }[]) => void;
}

export function GuidedWizard({
  open,
  onOpenChange,
  onComplete,
}: GuidedWizardProps) {
  const {
    state,
    setAnswers,
    nextStep,
    prevStep,
    generateSuggestions,
    toggleComponent,
    reset,
    totalSteps,
  } = useGuidedWizard();

  useEffect(() => {
    if (state.step === 3 && state.suggestedComponents.length === 0) {
      generateSuggestions();
    }
  }, [state.step, state.suggestedComponents.length, generateSuggestions]);

  const handleComplete = () => {
    const selected = state.suggestedComponents
      .filter((c) => c.selected)
      .map((c) => ({ name: c.name, type: c.type }));
    onComplete(selected);
    onOpenChange(false);
    reset();
  };

  const canProceed =
    state.step === 1
      ? !!state.answers.systemType && !!state.answers.systemName
      : state.step === 3
        ? state.suggestedComponents.some((c) => c.selected)
        : true;

  const strideCategories = [
    {
      letter: "S",
      name: "Spoofing",
      desc: "Pretending to be someone or something else",
      icon: Shield,
      color: "text-red-500",
    },
    {
      letter: "T",
      name: "Tampering",
      desc: "Modifying data or code without authorization",
      icon: AlertTriangle,
      color: "text-orange-500",
    },
    {
      letter: "R",
      name: "Repudiation",
      desc: "Denying having performed an action",
      icon: Undo2,
      color: "text-yellow-600",
    },
    {
      letter: "I",
      name: "Info Disclosure",
      desc: "Exposing data to unauthorized users",
      icon: Eye,
      color: "text-blue-500",
    },
    {
      letter: "D",
      name: "Denial of Service",
      desc: "Making a system unavailable to legitimate users",
      icon: Ban,
      color: "text-purple-500",
    },
    {
      letter: "E",
      name: "Elevation of Privilege",
      desc: "Gaining access beyond what is authorized",
      icon: ArrowUpCircle,
      color: "text-emerald-600",
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Guided Threat Model Setup</DialogTitle>
        </DialogHeader>

        <WizardProgress currentStep={state.step} totalSteps={totalSteps} />

        {state.step === 1 && (
          <SystemTypeStep answers={state.answers} onUpdate={setAnswers} />
        )}

        {state.step === 2 && (
          <div className="space-y-4 py-2">
            <div>
              <h3 className="text-base font-semibold mb-1">
                How STRIDE Threat Modeling Works
              </h3>
              <p className="text-sm text-muted-foreground">
                STRIDE is a framework for identifying security threats. Each
                letter represents a category of attack. After you add
                components, ThreatForge will analyze each one against these six
                categories.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {strideCategories.map((cat) => (
                <div
                  key={cat.letter}
                  className="flex items-start gap-2.5 rounded-lg border p-3"
                >
                  <div
                    className={`flex h-7 w-7 items-center justify-center rounded-md bg-muted shrink-0 ${cat.color}`}
                  >
                    <cat.icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium">
                      <span className="font-bold">{cat.letter}</span> —{" "}
                      {cat.name}
                    </div>
                    <p className="text-xs text-muted-foreground leading-snug">
                      {cat.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              You do not need to memorize these — AI will suggest relevant
              threats for each component automatically.
            </p>
          </div>
        )}

        {state.step === 3 && (
          <ComponentsStep
            components={state.suggestedComponents}
            onToggle={toggleComponent}
          />
        )}

        {state.step === 4 && (
          <div className="py-8 text-center">
            <h3 className="text-lg font-semibold mb-2">
              Ready to create your model
            </h3>
            <p className="text-muted-foreground">
              Click Create Model to generate your threat model with the selected
              components.
            </p>
          </div>
        )}

        <div className="flex justify-between pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Skip Wizard
          </Button>
          <div className="flex items-center gap-2">
            {/* On the informational STRIDE step, offer a quick skip to components */}
            {state.step === 2 && (
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground text-xs"
                onClick={() => {
                  nextStep();
                  nextStep();
                }}
              >
                Skip to Components →
              </Button>
            )}
            {state.step > 1 && (
              <Button variant="outline" onClick={prevStep}>
                Back
              </Button>
            )}
            {state.step < 4 ? (
              <Button onClick={nextStep} disabled={!canProceed}>
                Next
              </Button>
            ) : (
              <Button onClick={handleComplete}>Create Model</Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
