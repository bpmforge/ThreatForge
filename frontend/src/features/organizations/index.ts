/**
 * Organizations Feature - Public API
 *
 * Organization management including member invites, roles, and settings.
 */

// Components
export { OrganizationPanel } from "./components/OrganizationPanel";
export { MembersList } from "./components/MembersList";
export { OrganizationSettings } from "./components/OrganizationSettings";
export { InviteMemberDialog } from "./components/InviteMemberDialog";
export { AuditLogViewer } from "./components/AuditLogViewer";
export { OrgSwitcher } from "./components/OrgSwitcher";
export { OrgProvider } from "./components/OrgProvider";
export { UsageQuotas } from "./components/UsageQuotas";
export { WebhookManager } from "./components/WebhookManager";
export { SSOSettings } from "./components/SSOSettings";
export { SCIMSettings } from "./components/SCIMSettings";
export { CustomRolesManager } from "./components/CustomRolesManager";

// Hooks
export {
  useOrganization,
  useCurrentUserRole,
  useCreateOrganization,
} from "./hooks/useOrganization";
export { useOrgPermissions } from "./hooks/useOrgPermissions";
export { useOrgAdminGuard } from "./hooks/useOrgAdminGuard";

// Types
export type { Organization, MemberRole } from "./types";
export { canManageMembers, canEditSettings } from "./types";

// Services
export * as organizationApi from "./services/api";
