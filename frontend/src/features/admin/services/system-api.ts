/**
 * Admin API — System metrics, health, settings, cache, email, OAuth, observability
 */

import type {
  AdminStats,
  SystemHealth,
  CacheStats,
  SystemInfo,
  TraceSummary,
  TraceSpan,
} from "../types";
import { apiGet, apiPost, apiPut } from "@/lib/api-client";

// =============================================================================
// Stats & Health
// =============================================================================

export async function getAdminStats(): Promise<AdminStats> {
  return apiGet<AdminStats>("/api/admin/stats");
}

export async function getSystemHealth(): Promise<SystemHealth> {
  return apiGet<SystemHealth>("/api/admin/health");
}

// =============================================================================
// System Settings
// =============================================================================

export interface SystemSettings {
  allowSignups: boolean;
  requireEmailVerification: boolean;
  defaultUserRole: "OWNER" | "ADMIN" | "EDITOR" | "VIEWER";
  sessionTimeoutHours: number;
  maxLoginAttempts: number;
  lockoutDurationMinutes: number;
  // Password policy
  passwordMinLength: number;
  passwordRequireUppercase: boolean;
  passwordRequireLowercase: boolean;
  passwordRequireNumbers: boolean;
  passwordRequireSpecialChars: boolean;
  // MFA/2FA
  mfaRequired: boolean;
  maxProjectsPerOrg: number;
  enableAI: boolean;
  aiProvider: string;
  auditRetentionDays: number;
  // SAML SSO settings
  samlEnabled?: boolean;
  samlJacksonUrl?: string;
  samlProductId?: string;
  // IP Allowlist settings
  ipAllowlistEnabled?: boolean;
  ipAllowlist?: string[];
  // AI private-host allowlist (self-hosted model endpoints)
  aiPrivateHostAllowlist?: string[];
  aiAllowAllPrivateHosts?: boolean;
  /** Read-only: what AI_PRIVATE_HOST_ALLOWLIST / AI_ALLOW_ALL_PRIVATE_HOSTS add. */
  aiPrivateHostAllowlistFromEnv?: string[];
  aiAllowAllPrivateHostsFromEnv?: boolean;
  /** Write-only: a new NVD API key, or "" to remove the stored one. */
  nvdApiKey?: string;
  /** Read-only: whether CVE lookups have a key, and where it comes from. */
  nvdApiKeyConfigured?: boolean;
  nvdApiKeySource?: "settings" | "environment" | "none";
  // Email settings
  emailProvider?: string;
  emailFrom?: string;
  emailConfig?: Record<string, unknown>;
  updatedAt?: string;
}

export async function getSystemSettings(): Promise<SystemSettings> {
  return apiGet<SystemSettings>("/api/admin/settings");
}

export async function updateSystemSettings(
  settings: Partial<SystemSettings>,
): Promise<SystemSettings> {
  return apiPut<SystemSettings>("/api/admin/settings", settings);
}

// =============================================================================
// Email Configuration
// =============================================================================

export type EmailProvider = "none" | "smtp" | "sendgrid" | "resend" | "ses";

export async function testEmailConnection(): Promise<{
  success: boolean;
  error?: string;
}> {
  return apiPost("/api/admin/email/test");
}

export async function sendTestEmail(
  to: string,
): Promise<{ success: boolean; error?: string; messageId?: string }> {
  return apiPost("/api/admin/email/send-test", { to });
}

// =============================================================================
// OAuth Provider Configuration
// =============================================================================

export type OAuthProviderType = "google" | "github" | "microsoft" | "oidc";

export interface OAuthProviderConfig {
  enabled: boolean;
  clientId: string;
  clientSecret: string;
  issuer?: string;
  authorizationUrl?: string;
  tokenUrl?: string;
  userinfoUrl?: string;
  scopes?: string[];
  name?: string;
}

export interface OAuthProvidersResponse {
  providers: Record<string, OAuthProviderConfig>;
  envProviders: Record<
    string,
    { enabled: boolean; source: "env" | "database" }
  >;
}

export interface CallbackUrlsResponse {
  google: string;
  github: string;
  microsoft: string;
  oidc: string;
}

export async function getOAuthProviders(): Promise<OAuthProvidersResponse> {
  return apiGet("/api/admin/oauth-providers");
}

export async function updateOAuthProvider(
  provider: OAuthProviderType,
  config: OAuthProviderConfig,
): Promise<{ provider: string; config: OAuthProviderConfig }> {
  return apiPut(`/api/admin/oauth-providers/${provider}`, config);
}

export async function getOAuthCallbackUrls(): Promise<CallbackUrlsResponse> {
  return apiGet("/api/admin/oauth-providers/callback-urls");
}

// =============================================================================
// Cache Management
// =============================================================================

export async function getCacheStats(): Promise<CacheStats> {
  return apiGet<CacheStats>("/api/admin/cache/stats");
}

export async function clearCache(): Promise<void> {
  await apiPost("/api/admin/cache/clear");
}

export async function invalidateCacheByTag(
  tag: string,
): Promise<{ invalidatedCount: number }> {
  return apiPost<{ invalidatedCount: number }>(
    "/api/admin/cache/invalidate/tag",
    { tag },
  );
}

export async function invalidateCacheByPattern(
  pattern: string,
): Promise<{ invalidatedCount: number }> {
  return apiPost<{ invalidatedCount: number }>(
    "/api/admin/cache/invalidate/pattern",
    { pattern },
  );
}

// =============================================================================
// System & Observability
// =============================================================================

export async function getSystemInfo(): Promise<SystemInfo> {
  return apiGet<SystemInfo>("/api/admin/system");
}

export async function getTraces(limit?: number): Promise<TraceSummary[]> {
  const query = limit ? `?limit=${limit}` : "";
  const result = await apiGet<{ count: number; traces: TraceSummary[] }>(
    `/api/admin/traces${query}`,
  );
  return result.traces;
}

export async function getTrace(
  traceId: string,
): Promise<{ traceId: string; spans: TraceSpan[] }> {
  return apiGet<{ traceId: string; spans: TraceSpan[] }>(
    `/api/admin/traces/${traceId}`,
  );
}
