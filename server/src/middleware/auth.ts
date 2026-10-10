/**
 * Authentication middleware for Fastify routes.
 *
 * Verifies sessions by calling NextAuth's session endpoint, JWT tokens, or API tokens.
 */
import type { FastifyRequest, FastifyReply, FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import { createHash, randomBytes } from "crypto";
import { getPrisma } from "../db.js";
import { requiredScopeFor, satisfyingScopes } from "./api-token-scopes.js";

/** User payload from JWT token */
export interface JWTPayload {
  id: string;
  email?: string;
  name?: string;
  type?: "access" | "refresh";
  jti?: string;
  iat?: number;
  exp?: number;
}

// ---------------------------------------------------------------------------
// Redis jti denylist — lazy connection, only created when REDIS_URL is set
// Uses ioredis (already a project dependency via redis-collaboration service).
// ---------------------------------------------------------------------------
import type { Redis as IoRedis } from "ioredis";
import { sendForbidden, sendUnauthorized } from "../utils/api-response.js";

let _redisClient: IoRedis | null = null;

async function getRedisClient(): Promise<IoRedis | null> {
  if (!process.env.REDIS_URL) return null;
  if (!_redisClient) {
    const { Redis } = await import("ioredis");
    _redisClient = new Redis(process.env.REDIS_URL, { lazyConnect: false });
  }
  return _redisClient;
}

/** Token expiration times */
const TOKEN_EXPIRY = {
  access: "15m",
  refresh: "7d",
};

/** User context attached to authenticated requests */
export interface AuthUser {
  id: string;
  email?: string;
  name?: string;
  /** Scopes granted by API token (undefined for session auth) */
  apiTokenScopes?: string[];
  /** API token ID for audit logging */
  apiTokenId?: string;
}

/** Extend FastifyRequest to include authUser and requiredScopes */
declare module "fastify" {
  interface FastifyRequest {
    authUser?: AuthUser;
    /** Scopes required for this route (set via route config) */
    requiredScopes?: string[];
  }
}

// Cache for session validation to avoid hitting NextAuth API on every request.
// Uses Redis when available (multi-replica safe); falls back to a process-local
// Map when Redis is not configured (single-replica / dev).
const sessionCache = new Map<string, { user: AuthUser; expiresAt: number }>();
const SESSION_CACHE_TTL = 60 * 1000; // 1 minute
const SESSION_REDIS_KEY = "ftm:session:";
/** Redis set of a user's cached session keys, so they can be dropped together. */
const SESSION_USER_REDIS_KEY = "ftm:session-user:";

/**
 * Account statuses that may use a session or token. PENDING_DELETION stays
 * allowed so the owner can sign in and cancel the deletion.
 */
export const SESSION_STATUSES = new Set(["ACTIVE", "PENDING_DELETION"]);

async function getCachedSession(token: string): Promise<AuthUser | null> {
  // Local Map fast-path (same replica)
  const local = sessionCache.get(token);
  if (local && local.expiresAt > Date.now()) return local.user;

  // Cross-replica: check Redis
  const redis = await getRedisClient();
  if (redis) {
    try {
      const raw = await redis.get(SESSION_REDIS_KEY + token);
      if (raw) {
        const entry = JSON.parse(raw) as {
          user: AuthUser;
          expiresAt: number;
        };
        if (entry.expiresAt > Date.now()) {
          sessionCache.set(token, entry); // warm local
          return entry.user;
        }
      }
    } catch {
      // Redis error — fall through to DB validation
    }
  }
  return null;
}

async function setCachedSession(token: string, user: AuthUser): Promise<void> {
  const entry = { user, expiresAt: Date.now() + SESSION_CACHE_TTL };
  sessionCache.set(token, entry);
  const redis = await getRedisClient();
  if (redis) {
    try {
      await redis.set(
        SESSION_REDIS_KEY + token,
        JSON.stringify(entry),
        "PX",
        SESSION_CACHE_TTL,
      );
      const userKey = SESSION_USER_REDIS_KEY + user.id;
      await redis.sadd(userKey, SESSION_REDIS_KEY + token);
      await redis.pexpire(userKey, SESSION_CACHE_TTL);
    } catch {
      // Non-fatal — local cache still populated
    }
  }
}

/** Track failed auth attempts per IP for account lockout */
const failedAttempts = new Map<
  string,
  { count: number; lockedUntil: number }
>();

// Sweep expired entries every 5 minutes to prevent unbounded Map growth
const MAX_FAILED_ENTRIES = 10_000;
setInterval(
  () => {
    const now = Date.now();
    for (const [key, value] of sessionCache.entries()) {
      if (value.expiresAt < now) sessionCache.delete(key);
    }
    if (failedAttempts.size > MAX_FAILED_ENTRIES) {
      const toDelete = failedAttempts.size - MAX_FAILED_ENTRIES;
      let deleted = 0;
      for (const key of failedAttempts.keys()) {
        if (deleted >= toDelete) break;
        failedAttempts.delete(key);
        deleted++;
      }
    }
  },
  5 * 60 * 1000,
).unref();
const MAX_FAILED_ATTEMPTS = 10;
const LOCKOUT_DURATION_MS = 30 * 60 * 1000; // 30 minutes

function checkLockout(ip: string): boolean {
  const record = failedAttempts.get(ip);
  if (!record) return false;
  if (record.lockedUntil > Date.now()) return true;
  if (record.lockedUntil <= Date.now()) {
    failedAttempts.delete(ip);
    return false;
  }
  return false;
}

function recordFailedAttempt(ip: string): void {
  const record = failedAttempts.get(ip) || { count: 0, lockedUntil: 0 };
  record.count++;
  if (record.count >= MAX_FAILED_ATTEMPTS) {
    record.lockedUntil = Date.now() + LOCKOUT_DURATION_MS;
  }
  failedAttempts.set(ip, record);
}

function clearFailedAttempts(ip: string): void {
  failedAttempts.delete(ip);
}

/**
 * Drop every cached session for a user, on this replica and in Redis.
 * Call this on password change, logout, account deactivation, or role changes.
 */
export async function invalidateSessionCache(userId: string): Promise<void> {
  for (const [key, entry] of sessionCache) {
    if (entry.user.id === userId) {
      sessionCache.delete(key);
    }
  }
  const redis = await getRedisClient();
  if (!redis) return;
  try {
    const userKey = SESSION_USER_REDIS_KEY + userId;
    const keys = await redis.smembers(userKey);
    await redis.del(userKey, ...keys);
  } catch {
    // Redis entries expire within SESSION_CACHE_TTL anyway
  }
}

/**
 * True when a token issued at `iat` (seconds) predates the user's last
 * password change or "sign out everywhere". Compared at whole-second
 * granularity so a login made in the same second is not rejected.
 */
export function issuedBeforePasswordChange(
  iat: number | undefined,
  passwordChangedAt: Date | null | undefined,
  sessionsRevokedAt?: Date | null,
): boolean {
  const cutoff = Math.max(
    passwordChangedAt?.getTime() ?? 0,
    sessionsRevokedAt?.getTime() ?? 0,
  );
  if (!cutoff) return false;
  if (iat === undefined) return true;
  return iat < Math.floor(cutoff / 1000);
}

/**
 * Verify an API token (ftm_xxx format).
 * Returns AuthUser with scopes if valid, null otherwise.
 */
async function verifyApiToken(
  token: string,
  log: FastifyRequest["log"],
): Promise<AuthUser | null> {
  // API tokens must start with ftm_ prefix
  if (!token.startsWith("ftm_")) {
    return null;
  }

  const prefix = token.substring(0, 12);
  const tokenHash = createHash("sha256").update(token).digest("hex");

  try {
    const prisma = await getPrisma();

    // Find token by prefix (indexed for performance)
    const apiToken = await prisma.apiToken.findFirst({
      where: {
        tokenPrefix: prefix,
        isActive: true,
      },
      include: {
        user: {
          select: { id: true, email: true, name: true, status: true },
        },
      },
    });

    if (!apiToken) {
      log.warn({ prefix }, "API token not found or inactive");
      return null;
    }

    // Verify hash matches
    if (apiToken.tokenHash !== tokenHash) {
      log.warn({ prefix }, "API token hash mismatch");
      return null;
    }

    // Check expiration
    if (apiToken.expiresAt && apiToken.expiresAt < new Date()) {
      log.warn({ prefix }, "API token expired");
      return null;
    }

    // Check user is active
    if (apiToken.user.status !== "ACTIVE") {
      log.warn({ userId: apiToken.userId }, "API token user is not active");
      return null;
    }

    // Update usage tracking (non-blocking)
    prisma.apiToken
      .update({
        where: { id: apiToken.id },
        data: {
          lastUsedAt: new Date(),
          usageCount: { increment: 1 },
        },
      })
      .catch((err) => log.error({ err }, "Failed to update API token usage"));

    // Parse scopes
    const scopes: string[] = JSON.parse(apiToken.scopes || "[]");

    return {
      id: apiToken.user.id,
      email: apiToken.user.email ?? undefined,
      name: apiToken.user.name ?? undefined,
      apiTokenScopes: scopes,
      apiTokenId: apiToken.id,
    };
  } catch (err) {
    log.error({ err }, "Error verifying API token");
    return null;
  }
}

/**
 * Check if the user has required scopes for an operation.
 * Session-authenticated users have all scopes.
 * API token users must have matching scopes.
 */
function hasRequiredScopes(user: AuthUser, requiredScopes: string[]): boolean {
  // Session auth (no apiTokenScopes) has full access
  if (!user.apiTokenScopes) {
    return true;
  }

  // Check each required scope
  for (const required of requiredScopes) {
    // Support wildcard patterns: "read:*" matches "read:models", "read:threats", etc.
    const hasScope = user.apiTokenScopes.some((scope) => {
      if (scope === required) return true;
      // Handle category wildcards like "read:*"
      if (scope.endsWith(":*")) {
        const category = scope.slice(0, -1); // "read:"
        return required.startsWith(category);
      }
      return false;
    });

    if (!hasScope) {
      return false;
    }
  }

  return true;
}

/**
 * Verify session by calling NextAuth's session endpoint.
 * This is the primary authentication method when frontend uses NextAuth.
 */
async function verifyNextAuthSession(
  cookies: Record<string, string | undefined>,
  log: FastifyRequest["log"],
): Promise<AuthUser | null> {
  // Get the session token from cookies.
  // Auth.js v5 splits large JWTs across numbered chunks: cookieName.0, .1, …
  // Reassemble by sorting chunk keys and concatenating their values.
  const SESSION_COOKIE_BASES = [
    "authjs.session-token",
    "next-auth.session-token",
    "__Secure-authjs.session-token",
    "__Secure-next-auth.session-token",
  ];

  let sessionToken: string | undefined;
  for (const base of SESSION_COOKIE_BASES) {
    if (cookies[base]) {
      sessionToken = cookies[base];
      break;
    }
    // Reassemble chunked token: base.0, base.1, …
    const chunks = Object.keys(cookies)
      .filter((k) => k.startsWith(`${base}.`) && /\.\d+$/.test(k))
      .sort()
      .map((k) => cookies[k])
      .filter(Boolean) as string[];
    if (chunks.length > 0) {
      sessionToken = chunks.join("");
      break;
    }
  }

  if (!sessionToken) {
    return null;
  }

  // Check cache first (local Map or Redis)
  const cachedUser = await getCachedSession(sessionToken);
  if (cachedUser) return cachedUser;

  try {
    // Call NextAuth's session endpoint
    const authUrl = process.env.AUTH_URL || "http://localhost:3000";
    const response = await fetch(`${authUrl}/api/auth/session`, {
      headers: {
        Cookie: Object.entries(cookies)
          .filter(([, v]) => v !== undefined)
          .map(([k, v]) => `${k}=${v}`)
          .join("; "),
      },
    });

    if (!response.ok) {
      log.warn(
        { status: response.status },
        "NextAuth session verification failed",
      );
      return null;
    }

    const session = (await response.json()) as {
      user?: { id?: string; email?: string; name?: string };
    };

    if (!session?.user?.id) {
      return null;
    }

    // Verify user exists in database — reject stale/orphaned sessions
    const prisma = await getPrisma();
    const dbUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, email: true, name: true, status: true },
    });

    if (!dbUser) {
      log.warn(
        { sessionUserId: session.user.id, sessionEmail: session.user.email },
        "Session references non-existent user — rejecting",
      );
      return null;
    }

    if (!SESSION_STATUSES.has(dbUser.status)) {
      log.warn(
        { userId: dbUser.id, status: dbUser.status },
        "Session references an inactive account — rejecting",
      );
      return null;
    }

    const user: AuthUser = {
      id: dbUser.id,
      email: dbUser.email,
      name: dbUser.name,
    };

    // Cache the verified result (local + Redis)
    await setCachedSession(sessionToken, user);

    return user;
  } catch (err) {
    log.error({ err }, "Error verifying NextAuth session");
    return null;
  }
}

/**
 * Authentication hook that verifies session/JWT and attaches user to request.
 * Use as a preHandler on protected routes.
 *
 * Routes can skip auth by setting `config: { skipAuth: true }` in route options.
 */
export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  // Check if route has skipAuth config (for API key authenticated routes)
  const routeConfig = request.routeOptions?.config as
    | { skipAuth?: boolean }
    | undefined;
  if (routeConfig?.skipAuth) {
    return; // Skip JWT auth - route handles its own auth (e.g., API keys)
  }

  // First, try to verify NextAuth session (primary method)
  const nextAuthUser = await verifyNextAuthSession(
    request.cookies,
    request.log,
  );
  if (nextAuthUser) {
    request.authUser = nextAuthUser;
    clearFailedAttempts(request.ip);
    return;
  }

  // Fall back to Bearer token verification (for API clients)
  const authHeader = request.headers.authorization;
  let token: string | undefined;

  if (authHeader?.startsWith("Bearer ")) {
    token = authHeader.slice(7);
  } else {
    // Legacy: try token cookie
    token = request.cookies["token"];
  }

  // A missing token is not a guess, so it does not count toward the lockout.
  if (!token) {
    return sendUnauthorized(reply, "No authentication token provided");
  }

  // Lockout only gates token checks, never a valid browser session.
  if (checkLockout(request.ip)) {
    return reply
      .status(429)
      .send({ error: "Too many failed attempts. Try again later." });
  }

  // Try API token first (ftm_ prefix)
  if (token.startsWith("ftm_")) {
    const apiTokenUser = await verifyApiToken(token, request.log);
    if (apiTokenUser) {
      // Route override wins; otherwise default-deny by URL family
      const routeConfig = request.routeOptions?.config as
        | { scopes?: string[] }
        | undefined;
      if (routeConfig?.scopes) {
        if (!hasRequiredScopes(apiTokenUser, routeConfig.scopes)) {
          return sendForbidden(
            reply,
            `Insufficient scopes. Required: ${routeConfig.scopes.join(", ")}`,
          );
        }
      } else {
        const needed = requiredScopeFor(
          request.method,
          request.routeOptions?.url ?? request.url,
        );
        if (!needed) {
          return sendForbidden(
            reply,
            "API tokens cannot be used for this endpoint",
          );
        }
        // write:X implies read:X
        const ok = satisfyingScopes(needed).some((s) =>
          hasRequiredScopes(apiTokenUser, [s]),
        );
        if (!ok) {
          return sendForbidden(
            reply,
            `Insufficient scopes. Required: ${needed}`,
          );
        }
      }
      request.authUser = apiTokenUser;
      clearFailedAttempts(request.ip);
      return;
    }
    recordFailedAttempt(request.ip);
    return sendUnauthorized(reply, "Invalid or expired API token");
  }

  // Fall back to JWT verification
  try {
    const payload = request.server.jwt.verify<JWTPayload>(token);
    if (payload.type !== "access") {
      return sendUnauthorized(reply, "Invalid token type");
    }

    // Verify user still exists and is active
    const prisma = await getPrisma();
    const jwtUser = await prisma.user.findUnique({
      where: { id: payload.id },
      select: {
        id: true,
        email: true,
        name: true,
        status: true,
        passwordChangedAt: true,
        sessionsRevokedAt: true,
      },
    });

    if (!jwtUser) {
      request.log.warn(
        { jwtUserId: payload.id },
        "JWT references non-existent user — rejecting",
      );
      recordFailedAttempt(request.ip);
      return sendUnauthorized(reply, "User account no longer exists");
    }

    if (!SESSION_STATUSES.has(jwtUser.status)) {
      return sendUnauthorized(reply, "Account is not active");
    }

    if (
      issuedBeforePasswordChange(
        payload.iat,
        jwtUser.passwordChangedAt,
        jwtUser.sessionsRevokedAt,
      )
    ) {
      return sendUnauthorized(reply, "Session ended by a password change");
    }

    request.authUser = {
      id: jwtUser.id,
      email: jwtUser.email,
      name: jwtUser.name,
    };
    clearFailedAttempts(request.ip);
  } catch (err) {
    request.log.warn({ err }, "JWT verification failed");
    recordFailedAttempt(request.ip);
    return sendUnauthorized(reply, "Invalid or expired token");
  }
}

/**
 * Middleware to enforce specific scopes on a route.
 * Use after authenticate middleware.
 *
 * @example
 * server.get('/api/models', {
 *   preHandler: [authenticate, requireScopes(['read:models'])]
 * }, handler)
 */
export function requireScopes(scopes: string[]) {
  return async (
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> => {
    if (!request.authUser) {
      return sendUnauthorized(reply, "Authentication required");
    }

    if (!hasRequiredScopes(request.authUser, scopes)) {
      return sendForbidden(
        reply,
        `Insufficient scopes. Required: ${scopes.join(", ")}`,
      );
    }
  };
}

/**
 * Refresh token endpoint handler.
 * Validates refresh token and issues new access + refresh token pair.
 * When Redis is available, the consumed jti is stored in a denylist so
 * replayed tokens are rejected (token-reuse / token-theft detection).
 */
export async function refreshToken(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<{ accessToken: string; refreshToken: string }> {
  const token =
    request.cookies["refresh_token"] ||
    (request.body as { refreshToken?: string })?.refreshToken;

  if (!token) {
    return sendUnauthorized(reply, "No refresh token provided");
  }

  try {
    const payload = request.server.jwt.verify<JWTPayload>(token);

    if (payload.type !== "refresh") {
      return sendUnauthorized(reply, "Invalid token type");
    }

    // A password change (or a deleted/suspended account) ends refresh too
    const prisma = await getPrisma();
    const user = await prisma.user.findUnique({
      where: { id: payload.id },
      select: {
        status: true,
        passwordChangedAt: true,
        sessionsRevokedAt: true,
      },
    });
    if (
      !user ||
      !SESSION_STATUSES.has(user.status) ||
      issuedBeforePasswordChange(
        payload.iat,
        user.passwordChangedAt,
        user.sessionsRevokedAt,
      )
    ) {
      return sendUnauthorized(reply, "Invalid or expired refresh token");
    }

    // jti denylist check — reject replayed refresh tokens
    const redis = await getRedisClient();
    if (redis && payload.jti) {
      const used = await redis.get(`rtoken:used:${payload.jti}`);
      if (used) {
        return sendUnauthorized(reply, "Token already used");
      }
      // Mark jti as consumed; expire at the token's natural expiry time
      const ttl = payload.exp
        ? Math.max(1, payload.exp - Math.floor(Date.now() / 1000))
        : 86400;
      await redis.set(`rtoken:used:${payload.jti}`, "1", "EX", ttl);
    }

    // Issue new access token
    const accessToken = request.server.jwt.sign(
      { id: payload.id, type: "access" },
      { expiresIn: TOKEN_EXPIRY.access },
    );

    // Rotate: issue new refresh token with a fresh jti
    const newRefreshToken = request.server.jwt.sign(
      { id: payload.id, type: "refresh", jti: randomBytes(16).toString("hex") },
      { expiresIn: TOKEN_EXPIRY.refresh },
    );

    return { accessToken, refreshToken: newRefreshToken };
  } catch {
    // parse fallback — error surfaced to caller via 401 response
    return sendUnauthorized(reply, "Invalid or expired refresh token");
  }
}

/**
 * Decorator to add authentication to all routes in a plugin.
 * Usage: fastify.addHook('preHandler', authenticate)
 */
async function authPlugin(fastify: FastifyInstance): Promise<void> {
  // Add authenticate decorator for easy access
  fastify.decorate("authenticate", authenticate);
}

export default fp(authPlugin, {
  name: "auth",
  dependencies: ["@fastify/jwt", "@fastify/cookie"],
});
