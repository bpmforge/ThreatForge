/**
 * Admin Feature Module
 *
 * Provides administrative console for managing users, organizations, and system settings.
 */

// Components
export { AdminSidebar } from "./components/AdminSidebar";
export { StatsCard } from "./components/StatsCard";
export { SystemHealthCard } from "./components/SystemHealthCard";
export { UsersTable } from "./components/UsersTable";
export { AuditLogTable } from "./components/AuditLogTable";
export { CacheStatsPanel } from "./components/CacheStatsPanel";
export { SystemMetricsPanel } from "./components/SystemMetricsPanel";

// Hooks
export {
  useAdminStats,
  useSystemHealth,
  useUsers,
  useUpdateUser,
  useInviteUser,
  useAddMembership,
  useUpdateMembership,
  useRemoveMembership,
  useOrganizations,
  useOrganizationWithMembers,
  useUpdateOrganization,
  useDeleteOrganization,
  useAddOrgMember,
  useUpdateOrgMemberRole,
  useRemoveOrgMember,

  // Cache & Observability
} from "./hooks/useAdmin";
// DEPRECATED: Use useSystemAdminGuard instead
// useAdminGuard conflated system admin with org admin roles
// NEW: Use this for /admin routes - checks ONLY system admin status
export { useSystemAdminGuard } from "./hooks/useSystemAdminGuard";

// Types
export type {
  MemberRole,
  AdminUser,
  AdminOrganization,

  // Cache & Observability
} from "./types";
