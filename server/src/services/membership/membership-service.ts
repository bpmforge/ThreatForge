/**
 * Membership Service
 *
 * Re-exports from modular membership/ directory.
 * @see ./index.ts
 */
export * from "./types.js";
export { canManageRole, canAssignRole } from "./role-helpers.js";
export { updateMemberRole } from "./role-service.js";
export {
  removeMember,
  leaveOrganization,
  getOrganizationMembers,
} from "./member-service.js";
export { suspendMember, unsuspendMember } from "./suspension-service.js";
