/**
 * Threat Library API - Helper Functions
 */
import { getActiveOrgIds } from "../../services/access-control/access-control-service.js";

export { getAuthUser } from "../../utils/auth-helpers.js";

// ACTIVE memberships only (suspended members get nothing).
export {
  isActiveOrgMember as isMemberOfOrganization,
  isActiveOrgAdmin as isOrgAdmin,
  getActiveOrgIds as getUserOrganizationIds,
} from "../../services/access-control/access-control-service.js";

/** Helper to get user's single org (for mutations) */
export async function getUserSingleOrganization(
  userId: string,
): Promise<string | null> {
  const orgIds = await getActiveOrgIds(userId);
  if (orgIds.length === 1) return orgIds[0];
  return null;
}
