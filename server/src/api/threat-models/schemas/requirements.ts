/**
 * Zod schemas for the Requirements API
 */
import { z } from "zod";

const RequirementSourceEnum = z.enum([
  "MANUAL",
  "DOCUMENT",
  "CSV",
  "FRAMEWORK",
  "AI_SUGGESTED",
]);

const RequirementReviewStatusEnum = z.enum([
  "PENDING",
  "ACCEPTED",
  "REJECTED",
  "MODIFIED",
]);

export const CreateRequirementSchema = z.object({
  reqId: z.string().min(1).max(100),
  text: z.string().min(1).max(2000),
  category: z.string().max(50).optional(),
  docId: z.string().max(200).optional(),
  source: RequirementSourceEnum.default("MANUAL"),
  frameworkId: z.string().max(100).optional(),
  documentId: z.string().max(100).optional(),
});

export const UpdateRequirementSchema = z.object({
  text: z.string().min(1).max(2000).optional(),
  category: z.string().max(50).nullable().optional(),
  docId: z.string().max(200).nullable().optional(),
  reviewStatus: RequirementReviewStatusEnum.optional(),
  reviewNotes: z.string().max(2000).nullable().optional(),
});

export const BulkCreateRequirementsSchema = z.object({
  requirements: z.array(CreateRequirementSchema).min(1).max(500),
  source: RequirementSourceEnum.optional(),
});

export const FrameworkImportSchema = z.object({
  frameworkId: z.string().min(1).max(100),
  controlIds: z.array(z.string().min(1)).min(1).max(200),
});
