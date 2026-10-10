import type { SeverityQuestion } from "../types";

export const SEVERITY_QUESTIONS: SeverityQuestion[] = [
  {
    id: "data-sensitivity",
    question: "What type of data could be affected?",
    weight: 3,
    options: [
      {
        label: "Public data",
        score: 1,
        description: "Non-sensitive, publicly available information",
      },
      {
        label: "Internal business data",
        score: 2,
        description: "Internal docs, non-PII business info",
      },
      {
        label: "Personal information (PII)",
        score: 3,
        description: "Names, emails, addresses, phone numbers",
      },
      {
        label: "Credentials or secrets",
        score: 4,
        description: "Passwords, API keys, tokens, encryption keys",
      },
    ],
  },
  {
    id: "exposure",
    question: "Who can reach this component?",
    weight: 2,
    options: [
      {
        label: "Internal users only",
        score: 1,
        description: "Behind VPN or internal network",
      },
      {
        label: "Authenticated external users",
        score: 2,
        description: "Requires login from internet",
      },
      {
        label: "Partially authenticated",
        score: 3,
        description: "Some endpoints public, some protected",
      },
      {
        label: "Public internet",
        score: 4,
        description: "Fully exposed to anonymous users",
      },
    ],
  },
  {
    id: "business-impact",
    question: "What's the business impact if exploited?",
    weight: 3,
    options: [
      {
        label: "Minor inconvenience",
        score: 1,
        description: "Temporary service disruption",
      },
      {
        label: "Moderate impact",
        score: 2,
        description: "Financial loss or reputation damage",
      },
      {
        label: "Major impact",
        score: 3,
        description: "Regulatory violation or significant breach",
      },
      {
        label: "Catastrophic",
        score: 4,
        description: "Business-ending, mass data exposure",
      },
    ],
  },
  {
    id: "exploitability",
    question: "How easy is this threat to exploit?",
    weight: 2,
    options: [
      {
        label: "Requires significant expertise",
        score: 1,
        description: "Nation-state level resources",
      },
      {
        label: "Requires some expertise",
        score: 2,
        description: "Skilled attacker with tools",
      },
      {
        label: "Known techniques exist",
        score: 3,
        description: "Published exploits available",
      },
      {
        label: "Trivially exploitable",
        score: 4,
        description: "Script kiddie level, automated tools",
      },
    ],
  },
];

export function calculateSeverity(answers: Record<string, number>): {
  severity: "low" | "medium" | "high" | "critical";
  score: number;
  maxScore: number;
  explanation: string;
} {
  let totalScore = 0;
  let maxScore = 0;

  SEVERITY_QUESTIONS.forEach((q) => {
    const answer = answers[q.id];
    if (answer !== undefined) {
      totalScore += answer * q.weight;
    }
    maxScore += 4 * q.weight;
  });

  const percentage = (totalScore / maxScore) * 100;
  let severity: "low" | "medium" | "high" | "critical";
  let explanation: string;

  if (percentage <= 25) {
    severity = "low";
    explanation = "Limited exposure and impact. Monitor but lower priority.";
  } else if (percentage <= 50) {
    severity = "medium";
    explanation =
      "Moderate risk. Should be addressed in normal development cycle.";
  } else if (percentage <= 75) {
    severity = "high";
    explanation = "Significant risk. Prioritize for near-term remediation.";
  } else {
    severity = "critical";
    explanation = "Severe risk. Requires immediate attention and remediation.";
  }

  return { severity, score: totalScore, maxScore, explanation };
}
