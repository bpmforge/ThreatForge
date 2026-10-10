"use client";

/**
 * Setup Wizard Page
 * First-time configuration wizard for ThreatForge.
 */
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { apiGet } from "@/lib/api-client";
import {
  useSetupStore,
  SETUP_STEPS,
  STEP_LABELS,
  type SetupStep,
} from "./store";
import { Card, CardContent } from "@/components/ui/card";
import { WelcomeStep } from "./components/WelcomeStep";
import { AdminStep } from "./components/AdminStep";
import { OrganizationStep } from "./components/OrganizationStep";
import { AIConfigStep } from "./components/AIConfigStep";
import { AuthStep } from "./components/AuthStep";
import { SecurityStep } from "./components/SecurityStep";
import { CompleteStep } from "./components/CompleteStep";
import { Check, Circle } from "lucide-react";
import { cn } from "@/lib/utils";

/** Step indicator component */
function StepIndicator({
  step,
  currentStep,
  isValid,
}: {
  step: SetupStep;
  currentStep: SetupStep;
  isValid: boolean;
}) {
  const currentIndex = SETUP_STEPS.indexOf(currentStep);
  const stepIndex = SETUP_STEPS.indexOf(step);
  const isActive = step === currentStep;
  const isCompleted = stepIndex < currentIndex;

  return (
    <div className="flex items-center gap-2">
      <div
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-full border-2 text-sm font-medium transition-colors",
          isActive && "border-blue-500 bg-blue-500 text-foreground",
          isCompleted &&
            isValid &&
            "border-green-500 bg-green-500 text-foreground",
          isCompleted &&
            !isValid &&
            "border-yellow-500 bg-yellow-500 text-foreground",
          !isActive &&
            !isCompleted &&
            "border-border bg-card text-muted-foreground",
        )}
      >
        {isCompleted && isValid ? (
          <Check className="h-4 w-4" />
        ) : (
          <span>{stepIndex + 1}</span>
        )}
      </div>
      <span
        className={cn(
          "hidden text-sm font-medium md:block",
          isActive && "text-foreground",
          !isActive && "text-muted-foreground",
        )}
      >
        {STEP_LABELS[step]}
      </span>
    </div>
  );
}

/** Progress bar between steps */
function StepConnector({ isCompleted }: { isCompleted: boolean }) {
  return (
    <div
      className={cn(
        "mx-2 h-0.5 w-8 transition-colors",
        isCompleted ? "bg-green-500" : "bg-muted",
      )}
    />
  );
}

/** Render the current step content */
function StepContent({ step }: { step: SetupStep }) {
  switch (step) {
    case "welcome":
      return <WelcomeStep />;
    case "admin":
      return <AdminStep />;
    case "organization":
      return <OrganizationStep />;
    case "ai":
      return <AIConfigStep />;
    case "auth":
      return <AuthStep />;
    case "security":
      return <SecurityStep />;
    case "complete":
      return <CompleteStep />;
    default:
      return null;
  }
}

export default function SetupPage() {
  const router = useRouter();
  const { currentStep, stepValidation, submitSuccess, setSetupToken } =
    useSetupStore();

  // Check if setup is already complete on mount
  useEffect(() => {
    async function checkSetup() {
      try {
        const data = await apiGet<{
          setupComplete?: boolean;
          setupTokenRequired?: boolean;
        }>("/api/setup/status", { sameOrigin: true });
        if (data.setupTokenRequired) setSetupToken("", true);
        if (data.setupComplete) {
          // Setup already complete, redirect to login
          router.replace("/login");
        }
      } catch {
        // Ignore errors - we'll show the setup wizard
      }
    }
    checkSetup();
  }, [router, setSetupToken]);

  // Redirect to login after successful setup
  useEffect(() => {
    if (submitSuccess) {
      // Set cookie to mark setup as complete
      document.cookie = "setup_complete=true; path=/; max-age=86400";
      // Redirect to login after short delay
      const timer = setTimeout(() => {
        router.replace("/login");
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [submitSuccess, router]);

  return (
    <div className="w-full max-w-4xl">
      {/* Header */}
      <div className="mb-8 text-center">
        <div className="mb-2 flex items-center justify-center gap-2">
          <Circle className="h-8 w-8 text-blue-500" fill="currentColor" />
          <h1 className="text-2xl font-bold text-foreground">ThreatForge</h1>
        </div>
        <p className="text-muted-foreground">First-time setup wizard</p>
      </div>

      {/* Step indicators */}
      <div className="mb-8 flex items-center justify-center">
        {SETUP_STEPS.map((step, index) => (
          <div key={step} className="flex items-center">
            <StepIndicator
              step={step}
              currentStep={currentStep}
              isValid={stepValidation[step]}
            />
            {index < SETUP_STEPS.length - 1 && (
              <StepConnector
                isCompleted={
                  SETUP_STEPS.indexOf(currentStep) > index &&
                  stepValidation[step]
                }
              />
            )}
          </div>
        ))}
      </div>

      {/* Main content card */}
      <Card className="border-border bg-card backdrop-blur">
        <CardContent className="p-6">
          <StepContent step={currentStep} />
        </CardContent>
      </Card>

      {/* Footer */}
      <div className="mt-8 text-center text-sm text-muted-foreground">
        <p>
          Need help? See the{" "}
          <a
            href="https://github.com/bpmforge/ThreatForge/tree/main/docs"
            className="underline"
            target="_blank"
            rel="noreferrer"
          >
            ThreatForge documentation
          </a>
          .
        </p>
      </div>
    </div>
  );
}
