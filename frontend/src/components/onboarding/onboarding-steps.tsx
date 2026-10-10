"use client";

import { ONBOARDING_STEPS_1 } from "./onboarding-steps-1";
import { ONBOARDING_STEPS_2 } from "./onboarding-steps-2";

export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  content: React.ReactNode;
}

export const ONBOARDING_STEPS: OnboardingStep[] = [
  ...ONBOARDING_STEPS_1,
  ...ONBOARDING_STEPS_2,
];
