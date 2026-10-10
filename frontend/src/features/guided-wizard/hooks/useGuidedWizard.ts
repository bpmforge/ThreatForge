import { useState, useCallback, useRef, useEffect } from "react";
import type { WizardState, WizardAnswers, SuggestedComponent } from "../types";
import { SYSTEM_TEMPLATES } from "../data/system-types";
import {
  trackStepStarted,
  trackStepCompleted,
} from "@/features/settings/services/onboarding-analytics";

const TOTAL_STEPS = 4;

const initialState: WizardState = {
  step: 1,
  answers: {},
  suggestedComponents: [],
  isGenerating: false,
};

const STEP_NAMES: Record<number, string> = {
  1: "system-type",
  2: "methodology",
  3: "components",
  4: "review",
};

export function useGuidedWizard() {
  const [state, setState] = useState<WizardState>(initialState);
  const stepStartRef = useRef<number>(Date.now());

  useEffect(() => {
    trackStepStarted(STEP_NAMES[1]!);
  }, []);

  const setAnswers = useCallback((updates: Partial<WizardAnswers>) => {
    setState((prev) => ({
      ...prev,
      answers: { ...prev.answers, ...updates },
    }));
  }, []);

  const nextStep = useCallback(() => {
    setState((prev) => {
      const durationMs = Date.now() - stepStartRef.current;
      trackStepCompleted(
        STEP_NAMES[prev.step] ?? `step-${prev.step}`,
        durationMs,
      );
      const nextStepNum = Math.min(prev.step + 1, TOTAL_STEPS);
      trackStepStarted(STEP_NAMES[nextStepNum] ?? `step-${nextStepNum}`);
      stepStartRef.current = Date.now();
      return { ...prev, step: nextStepNum };
    });
  }, []);

  const prevStep = useCallback(() => {
    setState((prev) => ({
      ...prev,
      step: Math.max(prev.step - 1, 1),
    }));
  }, []);

  const generateSuggestions = useCallback(() => {
    setState((prev) => {
      const { systemType } = prev.answers;
      if (!systemType) return prev;

      const template = SYSTEM_TEMPLATES[systemType];
      const suggestions: SuggestedComponent[] = template.defaultComponents.map(
        (c, i) => ({
          id: `suggested-${i}`,
          name: c.name,
          type: c.type,
          description: "",
          selected: true,
        }),
      );

      return { ...prev, suggestedComponents: suggestions };
    });
  }, []);

  const toggleComponent = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      suggestedComponents: prev.suggestedComponents.map((c) =>
        c.id === id ? { ...c, selected: !c.selected } : c,
      ),
    }));
  }, []);

  const reset = useCallback(() => setState(initialState), []);

  return {
    state,
    setAnswers,
    nextStep,
    prevStep,
    generateSuggestions,
    toggleComponent,
    reset,
    totalSteps: TOTAL_STEPS,
  };
}
