/**
 * Admin Feature - Types
 */

export type MemberRole = "OWNER" | "ADMIN" | "EDITOR" | "VIEWER";

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string | null;
  lastLoginAt?: string | null;
  createdAt: string;
  isSuperAdmin: boolean;
  memberships: {
    id: string;
    role: MemberRole;
    organizationId: string;
    organizationName: string;
  }[];
}

export interface AdminOrganization {
  id: string;
  name: string;
  slug: string;
  memberCount: number;
  projectCount: number;
  modelCount: number;
  createdAt: string;
  updatedAt: string;
  owner?: {
    id: string;
    name: string;
    email: string;
  } | null;
}

export interface AdminOrganizationMember {
  id: string;
  role: MemberRole;
  userId: string;
  userName: string;
  userEmail: string;
}

export interface AdminOrganizationDetail extends AdminOrganization {
  members: AdminOrganizationMember[];
}

export interface AddOrgMemberRequest {
  userId: string;
  role: MemberRole;
}

export interface AdminStats {
  totalUsers: number;
  totalOrganizations: number;
  totalProjects: number;
  totalThreatModels: number;
  totalThreats: number;
  activeUsersLast7Days: number;
  activeUsersToday: number;
  usersThisMonth: number;
  projectsThisMonth: number;
  threatModelsThisMonth: number;
  modelsCreatedLast7Days: number;
  threatsIdentifiedLast7Days: number;
}

export interface AuditLogEntry {
  id: string;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string;
  entityName?: string;
  userId: string;
  userName: string;
  userEmail: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  timestamp: string;
}

export type AuditAction =
  | "CREATE"
  | "UPDATE"
  | "DELETE"
  | "LOGIN"
  | "LOGOUT"
  | "INVITE"
  | "REMOVE"
  | "ROLE_CHANGE"
  | "EXPORT"
  | "IMPORT";

export type AuditEntityType =
  | "USER"
  | "ORGANIZATION"
  | "PROJECT"
  | "THREAT_MODEL"
  | "THREAT"
  | "MITIGATION"
  | "MEMBERSHIP";

export interface SystemHealth {
  status: "healthy" | "degraded" | "unhealthy";
  database: {
    connected: boolean;
    latencyMs: number;
  };
  uptime: number;
  version: string;
  lastChecked: string;
}

export interface UpdateUserRequest {
  name?: string;
  isSuperAdmin?: boolean;
}

export interface UpdateMembershipRequest {
  role: MemberRole;
}

export interface AddMembershipRequest {
  organizationId: string;
  role: MemberRole;
}

export interface InviteUserRequest {
  email: string;
  role: MemberRole;
  organizationId: string;
}

export interface UpdateOrganizationRequest {
  name?: string;
  settings?: Record<string, unknown>;
}

// =============================================================================
// Cache & Observability Types
// =============================================================================

export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  hitRatePercent: string;
  size: number;
  maxSize: number;
  tags: string[];
}

export interface SystemInfo {
  nodeVersion: string;
  platform: string;
  arch: string;
  uptime: number;
  memoryUsage: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
  };
  cpuUsage?: {
    user: number;
    system: number;
  };
}

export interface TraceSpan {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  startTime: number;
  endTime: number;
  duration: number;
  status: "ok" | "error";
  attributes?: Record<string, unknown>;
}

export interface TraceSummary {
  traceId: string;
  spanCount: number;
  startTime: number;
  rootSpan?: string;
}
