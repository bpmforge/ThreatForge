"use client";

/**
 * Shared setup-wizard controls: Back/Continue navigation and a numeric
 * option select used by the configuration steps.
 */
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useSetupStore } from "../store";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function StepNavigation() {
  const { nextStep, prevStep } = useSetupStore();

  return (
    <div className="flex justify-between">
      <Button
        variant="outline"
        onClick={prevStep}
        className="gap-2 border-border"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </Button>
      <Button onClick={nextStep} className="gap-2">
        Continue
        <ArrowRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

interface NumericOption {
  value: number;
  label: string;
}

export function NumericOptionSelect({
  value,
  options,
  onChange,
}: {
  value: number;
  options: NumericOption[];
  onChange: (value: number) => void;
}) {
  return (
    <Select
      value={value.toString()}
      onValueChange={(v) => onChange(parseInt(v, 10))}
    >
      <SelectTrigger className="bg-background border-border text-foreground w-48">
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="bg-card border-border">
        {options.map((option) => (
          <SelectItem
            key={option.value}
            value={option.value.toString()}
            className="text-foreground focus:bg-muted focus:text-foreground"
          >
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
