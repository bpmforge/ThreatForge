/**
 * Mitigation Library Validation Schemas
 */
import { z } from "zod";

const MitigationStrategyEnum = z.enum([
  "PREVENTION",
  "DETECTION",
  "RESPONSE",
  "RECOVERY",
  "DETERRENCE",
]);

const EffortLevelEnum = z.enum([
  "TRIVIAL",
  "LOW",
  "MEDIUM",
  "HIGH",
  "VERY_HIGH",
]);

const EffectivenessLevelEnum = z.enum(["LOW", "MEDIUM", "HIGH", "VERY_HIGH"]);

export const CreateLibrarySchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  isPublic: z.boolean().optional().default(false),
});

export const CreateTemplateSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().min(1).max(5000),
  strategy: MitigationStrategyEnum,
  effort: EffortLevelEnum.optional().default("MEDIUM"),
  effectiveness: EffectivenessLevelEnum.optional().default("MEDIUM"),
  applicableThreatTypes: z.array(z.string()).optional().default([]),
  complianceControls: z
    .record(z.string(), z.array(z.string()))
    .optional()
    .default({}),
  implementationSteps: z.array(z.string()).optional().default([]),
  prerequisites: z.array(z.string()).optional().default([]),
  relatedTemplateIds: z.array(z.string()).optional().default([]),
  tags: z.array(z.string()).optional().default([]),
});

export const UpdateTemplateSchema = CreateTemplateSchema.partial();
