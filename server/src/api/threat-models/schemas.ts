/**
 * Threat Model API - Zod Schemas
 */
import { z } from "zod";

export const CanvasStateSchema = z.object({
  nodes: z.array(z.any()),
  edges: z.array(z.any()),
  viewport: z
    .object({
      x: z.number(),
      y: z.number(),
      zoom: z.number(),
    })
    .optional(),
});

export const CreateThreatModelSchema = z.object({
  name: z.string().min(1).max(255),
  projectId: z.string().optional(),
  canvasState: CanvasStateSchema.optional(),
});

export const UpdateThreatModelSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  canvasState: CanvasStateSchema.optional(),
  projectId: z.string().optional(),
  status: z.enum(["DRAFT", "IN_REVIEW", "PUBLISHED", "ARCHIVED"]).optional(),
  reanalysisSchedule: z.enum(["none", "weekly", "on-change"]).optional(),
});

export const UpdateStatusSchema = z.object({
  status: z.enum(["DRAFT", "IN_REVIEW", "PUBLISHED", "ARCHIVED"]),
});

export const UpdateTagsSchema = z.object({
  tags: z.array(z.string().min(1).max(50)).max(20),
});
