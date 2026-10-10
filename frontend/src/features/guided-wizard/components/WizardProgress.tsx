interface WizardProgressProps {
  currentStep: number;
  totalSteps: number;
}

export function WizardProgress({
  currentStep,
  totalSteps,
}: WizardProgressProps) {
  return (
    <div className="flex items-center gap-2 mb-6">
      {Array.from({ length: totalSteps }, (_, i) => (
        <div
          key={i}
          className={`h-2 flex-1 rounded-full ${
            i < currentStep ? "bg-primary" : "bg-muted"
          }`}
        />
      ))}
      <span className="text-sm text-muted-foreground ml-2">
        Step {currentStep} of {totalSteps}
      </span>
    </div>
  );
}
