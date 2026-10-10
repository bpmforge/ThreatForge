"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { STRIDE_CATEGORIES } from "@/features/threats/constants";
import type { StrideCategory } from "@/types/canvas";
import type {
  ChecklistItem,
  ComponentChecklist,
  ChecklistResponse,
} from "../types";

// STRIDE questions for threat checklist
const STRIDE_QUESTIONS: Record<
  StrideCategory,
  { question: string; helpText: string }
> = {
  SPOOFING: {
    question: "Can an attacker impersonate users or systems?",
    helpText:
      "Consider authentication mechanisms, identity verification, and credential management.",
  },
  TAMPERING: {
    question: "Can data or code be modified without detection?",
    helpText:
      "Consider data integrity, input validation, and cryptographic signatures.",
  },
  REPUDIATION: {
    question: "Can actions be performed without accountability?",
    helpText:
      "Consider audit logging, non-repudiation, and transaction tracking.",
  },
  INFORMATION_DISCLOSURE: {
    question: "Can sensitive information be exposed?",
    helpText: "Consider data classification, encryption, and access controls.",
  },
  DENIAL_OF_SERVICE: {
    question: "Can the service be made unavailable?",
    helpText:
      "Consider rate limiting, resource exhaustion, and availability requirements.",
  },
  ELEVATION_OF_PRIVILEGE: {
    question: "Can unauthorized access be gained?",
    helpText:
      "Consider authorization, privilege escalation, and least privilege principles.",
  },
};

/**
 * Hook to manage STRIDE-based threat checklists for components.
 */
export function useThreatChecklist(componentId: string | null): {
  checklist: ComponentChecklist | null;
  setResponse: (itemId: string, response: ChecklistResponse) => void;
  resetChecklist: () => void;
  progress: { completed: number; total: number };
} {
  const [responses, setResponses] = useState<Record<string, ChecklistResponse>>(
    {},
  );

  // Reset responses when componentId changes
  useEffect(() => {
    setResponses({});
  }, [componentId]);

  // Build checklist items
  const items = useMemo((): ChecklistItem[] => {
    if (!componentId) return [];

    return STRIDE_CATEGORIES.map((category) => ({
      id: `${componentId}-${category.value}`,
      category: category.value,
      question: STRIDE_QUESTIONS[category.value].question,
      helpText: STRIDE_QUESTIONS[category.value].helpText,
      response: responses[`${componentId}-${category.value}`] || null,
    }));
  }, [componentId, responses]);

  // Set response for a specific item
  const setResponse = useCallback(
    (itemId: string, response: ChecklistResponse) => {
      setResponses((prev) => ({
        ...prev,
        [itemId]: response,
      }));
    },
    [],
  );

  // Reset all responses
  const resetChecklist = useCallback(() => {
    setResponses({});
  }, []);

  // Calculate progress
  const progress = useMemo(() => {
    const total = items.length;
    const completed = items.filter((item) => item.response !== null).length;
    return { completed, total };
  }, [items]);

  // Build checklist object
  const checklist: ComponentChecklist | null = componentId
    ? {
        componentId,
        items,
        completedCount: progress.completed,
        totalCount: progress.total,
      }
    : null;

  return {
    checklist,
    setResponse,
    resetChecklist,
    progress,
  };
}
