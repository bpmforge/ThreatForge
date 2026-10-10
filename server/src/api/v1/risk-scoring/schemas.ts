/**
 * Risk Scoring API Schemas
 */
import { z } from "zod";

// OWASP Risk Rating factors
export const OWASPFactorsSchema = z.object({
  // Threat Agent Factors (0-9)
  skillLevel: z.number().min(0).max(9),
  motive: z.number().min(0).max(9),
  opportunity: z.number().min(0).max(9),
  size: z.number().min(0).max(9),
  // Vulnerability Factors (0-9)
  easeOfDiscovery: z.number().min(0).max(9),
  easeOfExploit: z.number().min(0).max(9),
  awareness: z.number().min(0).max(9),
  intrusionDetection: z.number().min(0).max(9),
  // Technical Impact Factors (0-9)
  lossOfConfidentiality: z.number().min(0).max(9),
  lossOfIntegrity: z.number().min(0).max(9),
  lossOfAvailability: z.number().min(0).max(9),
  lossOfAccountability: z.number().min(0).max(9),
  // Business Impact Factors (0-9)
  financialDamage: z.number().min(0).max(9),
  reputationDamage: z.number().min(0).max(9),
  nonCompliance: z.number().min(0).max(9),
  privacyViolation: z.number().min(0).max(9),
});

export type OWASPFactors = z.infer<typeof OWASPFactorsSchema>;

// DREAD factors
export const DREADFactorsSchema = z.object({
  damage: z.number().min(0).max(10),
  reproducibility: z.number().min(0).max(10),
  exploitability: z.number().min(0).max(10),
  affectedUsers: z.number().min(0).max(10),
  discoverability: z.number().min(0).max(10),
});

export type DREADFactors = z.infer<typeof DREADFactorsSchema>;

// Generic factors schema for custom frameworks
const GenericFactorsSchema = z.record(z.string(), z.number());

const RiskFrameworkTypeEnum = z.enum([
  "OWASP_RISK_RATING",
  "FAIR",
  "CVSS",
  "DREAD",
  "CUSTOM",
]);

export const CreateFrameworkSchema = z.object({
  name: z.string().min(1).max(200),
  type: RiskFrameworkTypeEnum,
  description: z.string().max(1000).optional(),
  config: z.record(z.string(), z.unknown()).optional().default({}),
  isDefault: z.boolean().optional().default(false),
  organizationId: z.string(),
});

export type CreateFrameworkInput = z.infer<typeof CreateFrameworkSchema>;

export const CalculateScoreSchema = z.object({
  frameworkId: z.string(),
  threatId: z.string(),
  factors: z.union([
    OWASPFactorsSchema,
    DREADFactorsSchema,
    GenericFactorsSchema,
  ]),
});

export type CalculateScoreInput = z.infer<typeof CalculateScoreSchema>;
