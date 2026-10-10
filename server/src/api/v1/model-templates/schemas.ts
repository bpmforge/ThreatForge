/**
 * Model Templates API Schemas
 */
import { z } from "zod";

export const CreateTemplateSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  category: z.string().max(100).optional(),
  tags: z.array(z.string()).optional().default([]),
  isPublic: z.boolean().optional().default(false),
  organizationId: z.string(),
});

export type CreateTemplateInput = z.infer<typeof CreateTemplateSchema>;

export const SaveAsTemplateSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  category: z.string().max(100).optional(),
  tags: z.array(z.string()).optional().default([]),
  isPublic: z.boolean().optional().default(false),
  includeThreats: z.boolean().optional().default(true),
});

export type SaveAsTemplateInput = z.infer<typeof SaveAsTemplateSchema>;

export interface ListTemplatesQuery {
  category?: string;
  search?: string;
  publicOnly?: string;
  limit?: string;
  offset?: string;
}

export interface CreateFromTemplateBody {
  projectId: string;
  name: string;
  description?: string;
}
