/**
 * Marketplace API Schemas
 */
import { z } from "zod";

const LibraryTypeEnum = z.enum([
  "THREAT_LIBRARY",
  "MITIGATION_LIBRARY",
  "COMPONENT_TEMPLATE_LIBRARY",
  "MODEL_TEMPLATE",
]);

export const PublishLibrarySchema = z.object({
  organizationId: z.string(),
  libraryType: LibraryTypeEnum,
  libraryId: z.string(),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  changelog: z.string().max(2000).optional(),
  targetOrgId: z.string().optional(), // NULL = public marketplace
});

export type PublishLibraryInput = z.infer<typeof PublishLibrarySchema>;

export const SubscribeBodySchema = z.object({
  libraryId: z.string(),
  autoUpdate: z.boolean().optional().default(true),
});

export type SubscribeInput = z.infer<typeof SubscribeBodySchema>;

export interface BrowseQuerystring {
  search?: string;
  limit?: string;
  offset?: string;
  sort?: "newest" | "popular" | "name";
  featured?: string;
}

export interface SimpleQuerystring {
  search?: string;
  limit?: string;
}

export interface TemplateQuerystring {
  search?: string;
  limit?: string;
  sort?: "newest" | "popular" | "name";
}
