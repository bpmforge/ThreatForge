/**
 * Component Templates API - Shared helpers, schemas, and re-exports.
 */
import { z } from "zod";

export { getPrisma } from "../../db.js";
export { getAuthUser } from "../../utils/auth-helpers.js";
export {
  sendCreated,
  sendNoContent,
  sendBadRequest,
  sendForbidden,
  sendNotFound,
} from "../../utils/api-response.js";

// =============================================================================
// Shared access checks
// =============================================================================

// ACTIVE memberships only (suspended members get nothing).
export {
  isActiveOrgMember as isMemberOfOrganization,
  isActiveOrgAdmin as isOrgAdmin,
} from "../../services/access-control/access-control-service.js";

// =============================================================================
// Validation Schemas
// =============================================================================

const ComponentTypes = [
  "EXTERNAL_USER",
  "INTERNAL_USER",
  "EXTERNAL_SYSTEM",
  "SERVICE",
  "API",
  "FUNCTION",
  "PROCESS",
  "DATABASE",
  "FILE_STORAGE",
  "CACHE",
  "QUEUE",
  "LOAD_BALANCER",
  "FIREWALL",
  "API_GATEWAY",
] as const;

export const CreateLibrarySchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  isPublic: z.boolean().optional(),
});

export const UpdateLibrarySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional().nullable(),
  isPublic: z.boolean().optional(),
});

export const CreateTemplateSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  componentType: z.enum(ComponentTypes),
  icon: z.string().optional(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(),
  defaultProperties: z.record(z.string(), z.unknown()).optional(),
  suggestedThreats: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
});

export const UpdateTemplateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional().nullable(),
  componentType: z.enum(ComponentTypes).optional(),
  icon: z.string().optional().nullable(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional()
    .nullable(),
  defaultProperties: z.record(z.string(), z.unknown()).optional(),
  suggestedThreats: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
});

export const ImportLibrarySchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  templates: z.array(
    z.object({
      name: z.string().min(1),
      description: z.string().optional(),
      componentType: z.enum(ComponentTypes),
      icon: z.string().optional(),
      color: z.string().optional(),
      defaultProperties: z.record(z.string(), z.unknown()).optional(),
      suggestedThreats: z.array(z.string()).optional(),
      tags: z.array(z.string()).optional(),
    }),
  ),
});
