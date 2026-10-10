import type { ComponentType } from "@/types/canvas";
import { VENDOR_RULES, GENERIC_RULES } from "./component-type-rules";

interface DetectionResult {
  type: ComponentType;
  confidence: "high" | "medium" | "low";
}

export type { DetectionResult };

export function detectComponentType(name: string): DetectionResult | null {
  const trimmed = name.trim();
  if (!trimmed) return null;

  for (const rule of VENDOR_RULES) {
    if (rule.pattern.test(trimmed)) {
      return { type: rule.type, confidence: rule.confidence };
    }
  }
  for (const rule of GENERIC_RULES) {
    if (rule.pattern.test(trimmed)) {
      return { type: rule.type, confidence: rule.confidence };
    }
  }
  return null;
}

export function shouldSuggestTypeChange(
  name: string,
  currentType: ComponentType,
): DetectionResult | null {
  const detection = detectComponentType(name);
  if (!detection) return null;
  if (detection.type === currentType) return null;
  return detection;
}
