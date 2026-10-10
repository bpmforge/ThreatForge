/**
 * Organization API - Shared Helpers
 *
 * Utility functions for organization membership, slug generation, and schemas.
 */
import { z } from "zod";
import crypto from "crypto";
import { getPrisma } from "../../db.js";

/** Generate a unique slug from organization name */
export async function generateUniqueSlug(baseName: string): Promise<string> {
  const prisma = await getPrisma();

  // Sanitize name to create slug
  let baseSlug = baseName
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 40);

  if (baseSlug.length < 2) {
    baseSlug = "org";
  }

  // Check for uniqueness
  let slug = baseSlug;
  let suffix = 1;

  while (suffix <= 100) {
    const existing = await prisma.organization.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (!existing) {
      return slug;
    }

    slug = `${baseSlug}-${suffix}`;
    suffix++;
  }

  // Fallback with random suffix
  const randomSuffix = crypto.randomBytes(3).toString("hex");
  return `${baseSlug}-${randomSuffix}`;
}

// Membership checks count ACTIVE memberships only (suspended members get nothing).
export {
  isActiveOrgMember as isMemberOfOrganization,
  getUserOrgRole as getUserRole,
} from "../../services/access-control/access-control-service.js";

export const CreateOrganizationSchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().max(500).optional(),
  type: z.enum(["TEAM", "ENTERPRISE"]).default("TEAM"),
});

export const UpdateOrganizationSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  description: z.string().max(500).optional(),
  settings: z.record(z.string(), z.unknown()).optional(),
  allowGuestAccess: z.boolean().optional(),
  guestDefaultRole: z.enum(["VIEWER", "COMMENTER", "EDITOR"]).optional(),
  allowGuestExport: z.boolean().optional(),
  threatMethodology: z
    .enum(["STRIDE", "LINDDUN", "CIA", "STRIDE_LINDDUN"])
    .optional(),
});

export const TransferOwnershipSchema = z.object({
  newOwnerId: z.string().min(1),
});
