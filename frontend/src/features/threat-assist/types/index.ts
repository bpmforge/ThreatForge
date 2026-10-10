import type { ComponentType } from "@/types/canvas";
import type { StrideCategory } from "@/features/threat-templates/types";

export interface ThreatSuggestion {
  id: string;
  title: string;
  description: string;
  strideCategory: StrideCategory;
  severity: "low" | "medium" | "high" | "critical";
  confidence: number;
  mitigations: string[];
}

export interface ComponentSuggestions {
  componentId: string;
  componentType: ComponentType;
  suggestions: ThreatSuggestion[];
  dismissed: boolean;
  timestamp: number;
}

export interface SeverityQuestion {
  id: string;
  question: string;
  options: SeverityOption[];
  weight: number;
}

interface SeverityOption {
  label: string;
  score: number;
  description?: string;
}

export interface SeverityCalculationResult {
  severity: "low" | "medium" | "high" | "critical";
  score: number;
  maxScore: number;
  explanation: string;
}

export interface StrideHelpContent {
  category: StrideCategory;
  name: string;
  definition: string;
  exampleAttacks: string[];
  questionsToAsk: string[];
  componentSpecificHelp: Partial<Record<ComponentType, string>>;
}
