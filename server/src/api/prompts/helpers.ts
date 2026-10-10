/**
 * AI Prompts API - Helper Functions
 */
export { getAuthUser } from "../../utils/auth-helpers.js";

// ACTIVE memberships only (suspended members get nothing).
export {
  isActiveOrgAdmin as hasOrgAdminAccess,
  isActiveOrgMember as isOrgMember,
} from "../../services/access-control/access-control-service.js";
