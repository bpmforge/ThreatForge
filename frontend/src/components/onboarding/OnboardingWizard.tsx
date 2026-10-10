"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, ArrowRight, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { ONBOARDING_STEPS } from "./onboarding-steps";

interface OnboardingWizardProps {
  onComplete: () => void;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function OnboardingWizard({
  onComplete,
  isOpen,
  onOpenChange,
}: OnboardingWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);

  const step = ONBOARDING_STEPS[currentStep];
  const progress = ((currentStep + 1) / ONBOARDING_STEPS.length) * 100;
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === ONBOARDING_STEPS.length - 1;

  const handleNext = () => {
    if (isLastStep) {
      onComplete();
      onOpenChange(false);
    } else {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (!isFirstStep) setCurrentStep((prev) => prev - 1);
  };

  const handleSkip = () => {
    onComplete();
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] p-0 gap-0">
        <Progress value={progress} className="h-1 rounded-none" />

        <div className="flex justify-center gap-2 pt-4 px-6">
          {ONBOARDING_STEPS.map((s, index) => (
            <button
              key={s.id}
              onClick={() => setCurrentStep(index)}
              className={cn(
                "h-2 rounded-full transition-all",
                index === currentStep
                  ? "w-8 bg-primary"
                  : index < currentStep
                    ? "w-2 bg-primary/60"
                    : "w-2 bg-muted-foreground/20",
              )}
              aria-label={`Go to step ${index + 1}: ${s.title}`}
            />
          ))}
        </div>

        <DialogHeader className="p-6 pb-2">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <step.icon className="h-6 w-6 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-xl">{step.title}</DialogTitle>
              <p className="text-sm text-muted-foreground">
                {step.description}
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="px-6 pb-2">{step.content}</div>

        <div className="flex items-center justify-between p-6 pt-4 border-t">
          <div>
            {!isFirstStep ? (
              <Button variant="ghost" onClick={handlePrevious}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Previous
              </Button>
            ) : (
              <Button variant="ghost" onClick={handleSkip}>
                Skip tutorial
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {currentStep + 1} of {ONBOARDING_STEPS.length}
            </span>
            <Button onClick={handleNext}>
              {isLastStep ? (
                <>
                  Get Started
                  <CheckCircle2 className="h-4 w-4 ml-2" />
                </>
              ) : (
                <>
                  Next
                  <ArrowRight className="h-4 w-4 ml-2" />
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
