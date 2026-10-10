/**
 * ThreatForge - Fastify application builder
 *
 * Builds the fully configured server (plugins, route scopes, WebSocket) without
 * listening or touching the database, so tests can construct the real app.
 * Process concerns (env checks, DB/Redis init, listen, shutdown) stay in index.ts.
 */
import Fastify, { type RouteOptions } from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import jwt from "@fastify/jwt";
import websocket from "@fastify/websocket";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { threatModelRoutes } from "./api/threat-models.js";
import { threatRoutes } from "./api/threats.js";
import { threatCommentRoutes } from "./api/threat-comments.js";
import { threatModelMemberRoutes } from "./api/threat-model-members.js";
import { mitigationRoutes } from "./api/mitigations.js";
import { settingsRoutes } from "./api/settings.js";
import { aiRoutes } from "./api/ai.js";
import { organizationRoutes } from "./api/organizations.js";
import { projectRoutes } from "./api/projects.js";
import { versionRoutes } from "./api/versions.js";
import { sequenceDiagramRoutes } from "./api/sequence-diagrams.js";
import { adminRoutes } from "./api/admin.js";
import { dfdRoutes } from "./api/dfd.js";
import { userStoryRoutes } from "./api/user-stories.js";
import { threatLibraryRoutes } from "./api/threat-library.js";
import { componentTemplateRoutes } from "./api/component-templates.js";
import { ciRoutes } from "./api/ci.js";
import { encryptionRoutes } from "./api/encryption.js";
import { setupRoutes } from "./api/setup.js";
import { userRoutes } from "./api/users.js";
import { authPublicRoutes } from "./api/auth-public.js";
import { oauthProviderRoutes } from "./api/oauth-providers.js";
import { invitationRoutes } from "./api/invitations.js";
import { memberRoutes } from "./api/members.js";
import { guestAccessRoutes } from "./api/guest-access.js";
import { auditRoutes } from "./api/audit.js";
import { aiProviderRoutes } from "./api/ai-providers.js";
import { twoFactorRoutes } from "./api/two-factor.js";
import { sessionRoutes } from "./api/sessions.js";
import { apiTokenRoutes } from "./api/api-tokens.js";
import { dataExportRoutes } from "./api/data-export.js";
import { usageRoutes } from "./api/usage.js";
import { webhookRoutes } from "./api/webhooks.js";
import { ssoRoutes } from "./api/sso.js";
import { customRoleRoutes } from "./api/custom-roles.js";
import { uploadRoutes } from "./api/uploads.js";
import { documentRoutes } from "./api/documents.js";
import { riskOverviewRoutes } from "./api/risk-overview.js";
import { attackSurfaceRoutes } from "./api/attack-surface.js";
import { attackChainRoutes } from "./api/attack-chains.js";
import { architecturalMitigationRoutes } from "./api/architectural-mitigations.js";
import { complianceRoutes } from "./api/compliance.js";
import { complianceEvidenceRoutes } from "./api/compliance-evidence.js";
import { reportingRoutes } from "./api/reporting.js";
import { scannerRoutes } from "./api/scanners.js";
import { notificationRoutes } from "./api/notifications.js";
import { reviewRoutes } from "./api/reviews.js";
import { observabilityRoutes } from "./api/observability.js";
import { cacheRoutes } from "./api/cache.js";
import { bulkRoutes } from "./api/bulk.js";
import { promptRoutes } from "./api/prompts.js";
import { pipelineRoutes } from "./api/pipelines.js";
import { v1Routes } from "./api/v1/index.js";
import { aiJobRoutes } from "./api/ai-jobs.js";
import { citationRoutes } from "./api/citations.js";
import { presenceRoutes } from "./api/presence.js";
import authPlugin, {
  authenticate,
  refreshToken,
  type JWTPayload,
} from "./middleware/auth.js";
import { getPrisma } from "./db.js";
import { resolveCollaborationAccess } from "./services/collaboration-access.js";
import { registerCsrf, getCsrfToken } from "./middleware/csrf.js";
import { registerRateLimiting } from "./middleware/rate-limit.js";
import { registerIpAllowlist } from "./middleware/ip-allowlist.js";
import {
  registerErrorHandler,
  registerNotFoundHandler,
} from "./middleware/error-handler.js";
import {
  handleConnection,
  setDocUpdateCallback,
} from "./services/collaboration.js";
import {
  saveCollaborationState,
  initCollaborationFromCanvas,
  registerCollaborationSession,
  unregisterCollaborationSession,
} from "./services/collaboration-persistence.js";
import {
  isRedisEnabled,
  getPreferredServer,
  getServerId,
} from "./services/redis-collaboration.js";
import logger from "./utils/logger.js";
import { routeAuthz } from "./middleware/authz-policy.js";
import { enforceDeclaredAuthz } from "./middleware/authz-enforce.js";
import { keepRawJsonBody } from "./utils/raw-body.js";
import { readOnlyGuard } from "./middleware/read-only-guard.js";
import { mfaRequiredGuard } from "./middleware/mfa-required.js";

const IS_PRODUCTION = process.env.NODE_ENV === "production";

const PUBLIC_SHARE = routeAuthz({
  public:
    "the unexpired ftm-share- token (sha256-matched to ModelAccess.accessToken) is the credential",
});

/**
 * Which proxies may set the client IP via X-Forwarded-For. TRUST_PROXY is a
 * hop count, "false", or a comma list of addresses/CIDRs. The default trusts
 * loopback and private networks (nginx and the Next.js server in Docker), so
 * a client reaching the server from the internet cannot pick its own IP.
 */
function trustProxySetting(): boolean | string {
  const raw = (process.env.TRUST_PROXY ?? "").trim();
  if (raw === "false" || raw === "0") return false;
  return raw || "loopback,linklocal,uniquelocal";
}

export interface BuildServerOptions {
  jwtSecret: string;
  /** Observe every route as it is registered (used by the route-authz inventory test). */
  onRoute?: (route: RouteOptions) => void;
  /** Enforce declared `{ org }`/`{ model }`/`superAdmin` policies (default true; tests compare against false). */
  enforceAuthz?: boolean;
}

/**
 * Build and configure the Fastify server instance.
 */
export async function buildServer({
  jwtSecret,
  onRoute,
  enforceAuthz = true,
}: BuildServerOptions) {
  const server = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || "info",
      transport:
        process.env.NODE_ENV === "development"
          ? {
              target: "pino-pretty",
              options: {
                colorize: true,
              },
            }
          : undefined,
    },
    // Trust only the hops we run (nginx = 1) so request.ip is the real client
    // and a client-supplied X-Forwarded-For cannot pick its own IP.
    trustProxy: trustProxySetting(),
  });

  if (onRoute) server.addHook("onRoute", onRoute);

  // Webhook signatures cover the exact bytes sent; keep them on request.rawBody
  keepRawJsonBody(server);

  // Register global error handlers
  registerErrorHandler(server);
  registerNotFoundHandler(server);

  // Register plugins
  const corsOrigin = process.env.CORS_ORIGIN || "http://localhost:3000";
  if (corsOrigin === "*" && IS_PRODUCTION) {
    logger.fatal(
      "CORS_ORIGIN=* with credentials is a full bypass — refusing to start in production",
    );
    process.exit(1);
  }
  await server.register(cors, {
    origin: corsOrigin,
    credentials: true,
    methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  });

  await server.register(cookie);

  // Register OpenAPI documentation
  await server.register(swagger, {
    openapi: {
      openapi: "3.1.0",
      info: {
        title: "ThreatForge API",
        description:
          "API for managing threat models, threats, mitigations, and projects",
        version: "1.0.0",
      },
      servers: [
        { url: "http://localhost:3001", description: "Development server" },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT",
          },
          cookieAuth: {
            type: "apiKey",
            in: "cookie",
            name: "token",
          },
          ciApiKey: {
            type: "http",
            scheme: "bearer",
            description: "CI/CD API key (format: ftm_xxx)",
          },
        },
      },
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      tags: [
        { name: "Threat Models", description: "Threat model operations" },
        { name: "Threats", description: "Threat operations" },
        { name: "Mitigations", description: "Mitigation operations" },
        { name: "Projects", description: "Project operations" },
        { name: "Organizations", description: "Organization operations" },
        { name: "Admin", description: "Admin operations" },
        { name: "AI", description: "AI-powered features" },
        { name: "Auth", description: "Authentication" },
        { name: "CI/CD", description: "CI/CD integration and scans" },
        { name: "Attack Surface", description: "Attack surface analysis" },
        { name: "Compliance", description: "Compliance gap analysis" },
        { name: "Reporting", description: "Executive dashboards and reports" },
        {
          name: "Custom Categories",
          description: "Custom threat categories (v1)",
        },
        {
          name: "Mitigation Libraries",
          description: "Mitigation template libraries (v1)",
        },
        { name: "Model Templates", description: "Threat model templates (v1)" },
        { name: "Risk Scoring", description: "Risk scoring frameworks (v1)" },
        { name: "Integrations", description: "Third-party integrations (v1)" },
        { name: "Marketplace", description: "Library marketplace (v1)" },
      ],
    },
  });

  if (!IS_PRODUCTION) {
    await server.register(swaggerUi, {
      routePrefix: "/docs",
      uiConfig: {
        docExpansion: "list",
        deepLinking: true,
      },
    });
  }

  // Register CSRF protection
  await registerCsrf(server);

  // Register rate limiting
  await registerRateLimiting(server);

  // Register IP allowlist (enterprise feature)
  await registerIpAllowlist(server);

  await server.register(jwt, {
    secret: jwtSecret,
    cookie: {
      cookieName: "token",
      signed: false,
    },
  });

  await server.register(websocket);

  // Set up collaboration persistence callback
  setDocUpdateCallback(saveCollaborationState);

  // Register auth plugin
  await server.register(authPlugin);

  // Register PUBLIC setup routes (no authentication required)
  // These are used for first-time system configuration
  await server.register(setupRoutes);

  // Register PUBLIC auth routes (no authentication required)
  // Password reset, etc.
  await server.register(authPublicRoutes);

  // Register public share viewing route (no auth required)
  server.get(
    "/api/public/share/:token",
    PUBLIC_SHARE,
    async (request, reply) => {
      // Delegate to the share handler — registered below in protected scope too
      const prisma = await getPrisma();
      const { createHash } = await import("crypto");
      const token = (request.params as { token: string }).token;
      if (!token?.startsWith("ftm-share-")) {
        return reply.status(400).send({ error: "Invalid share token" });
      }
      const tokenHash = createHash("sha256").update(token).digest("hex");
      const access = await prisma.modelAccess.findFirst({
        where: {
          accessToken: tokenHash,
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
        include: {
          threatModel: {
            include: {
              components: true,
              connections: true,
              boundaries: true,
              threats: { include: { mitigations: true } },
              project: { select: { name: true } },
            },
          },
        },
      });
      if (!access?.threatModel)
        return reply
          .status(404)
          .send({ error: "Share link expired or not found" });
      await prisma.modelAccess.update({
        where: { id: access.id },
        data: { lastAccessedAt: new Date(), accessCount: { increment: 1 } },
      });
      const model = access.threatModel;
      return {
        data: {
          name: model.name,
          projectName: model.project?.name,
          canvasState: JSON.parse(model.canvasState || "{}"),
          components: model.components,
          connections: model.connections,
          boundaries: model.boundaries,
          threats: model.threats.map((t) => ({
            id: t.id,
            name: t.name,
            description: t.description,
            severity: t.severity,
            status: t.status,
            strideCategories: JSON.parse(t.strideCategories || "[]"),
            mitigationCount: t.mitigations.length,
          })),
          threatCount: model.threats.length,
          componentCount: model.components.length,
          readOnly: true,
          expiresAt: access.expiresAt?.toISOString(),
        },
      };
    },
  );

  // Register SCIM provisioning routes (DB-backed per-org Bearer token auth)
  const { scimRoutes } = await import("./api/scim.js");
  await server.register(scimRoutes, { prefix: "/api" });
  server.log.info("SCIM 2.0 provisioning endpoints enabled");

  // Register API routes with authentication and CSRF protection
  // All /api/* routes require authentication
  await server.register(async (protectedRoutes) => {
    // Add authentication to all routes in this scope
    protectedRoutes.addHook("preHandler", authenticate);

    // Read-only accounts (the public demo login) may not change anything.
    protectedRoutes.addHook("preHandler", readOnlyGuard);
    protectedRoutes.addHook("preHandler", mfaRequiredGuard);

    // Enforce each route's declared `config.authz` (org role, model action,
    // super admin) before the handler's own checks run.
    if (enforceAuthz) {
      protectedRoutes.addHook("preHandler", enforceDeclaredAuthz);
    }

    // Add CSRF protection for state-changing requests (production only)
    // In development, CSRF is disabled to simplify testing with NextAuth
    // JSON API requests are exempt because:
    // 1. SameSite cookies prevent cross-site requests
    // 2. CORS prevents cross-origin JSON submissions
    // 3. Browsers can't send JSON bodies in CSRF attacks
    if (IS_PRODUCTION) {
      protectedRoutes.addHook("preHandler", (request, reply, done) => {
        const safeMethods = ["GET", "HEAD", "OPTIONS", "DELETE"];
        if (!safeMethods.includes(request.method)) {
          // Skip CSRF for JSON API requests - they're protected by CORS/SameSite
          const contentType = request.headers["content-type"] || "";
          if (contentType.includes("application/json")) {
            done();
            return;
          }
          // Skip CSRF for Bearer token auth (API tokens, not cookie sessions)
          const authHeader = request.headers.authorization || "";
          if (authHeader.startsWith("Bearer ")) {
            done();
            return;
          }
          server.csrfProtection(request, reply, done);
        } else {
          done();
        }
      });
    }

    // Register protected routes
    await protectedRoutes.register(threatModelRoutes);
    await protectedRoutes.register(threatRoutes);
    await protectedRoutes.register(threatCommentRoutes);
    await protectedRoutes.register(threatModelMemberRoutes);
    await protectedRoutes.register(bulkRoutes);
    await protectedRoutes.register(mitigationRoutes);
    await protectedRoutes.register(settingsRoutes);
    await protectedRoutes.register(aiRoutes);
    await protectedRoutes.register(organizationRoutes);
    await protectedRoutes.register(projectRoutes);
    await protectedRoutes.register(versionRoutes);
    await protectedRoutes.register(sequenceDiagramRoutes);
    await protectedRoutes.register(adminRoutes);
    await protectedRoutes.register(dfdRoutes);
    await protectedRoutes.register(userStoryRoutes);
    await protectedRoutes.register(threatLibraryRoutes);
    await protectedRoutes.register(componentTemplateRoutes);
    await protectedRoutes.register(ciRoutes);
    await protectedRoutes.register(encryptionRoutes);
    await protectedRoutes.register(userRoutes);
    await protectedRoutes.register(oauthProviderRoutes);
    await protectedRoutes.register(invitationRoutes);
    await protectedRoutes.register(memberRoutes);
    await protectedRoutes.register(guestAccessRoutes);
    await protectedRoutes.register(auditRoutes);
    await protectedRoutes.register(aiProviderRoutes);
    await protectedRoutes.register(twoFactorRoutes);
    await protectedRoutes.register(sessionRoutes);
    await protectedRoutes.register(apiTokenRoutes);
    await protectedRoutes.register(dataExportRoutes);
    await protectedRoutes.register(usageRoutes);
    await protectedRoutes.register(webhookRoutes);
    await protectedRoutes.register(ssoRoutes);
    const { scimTokenRoutes } = await import("./api/scim-tokens.js");
    await protectedRoutes.register(scimTokenRoutes);
    await protectedRoutes.register(customRoleRoutes);
    await protectedRoutes.register(uploadRoutes);
    await protectedRoutes.register(documentRoutes);
    await protectedRoutes.register(riskOverviewRoutes);
    await protectedRoutes.register(attackSurfaceRoutes);
    await protectedRoutes.register(attackChainRoutes);
    await protectedRoutes.register(architecturalMitigationRoutes);
    await protectedRoutes.register(complianceRoutes);
    await protectedRoutes.register(complianceEvidenceRoutes);
    await protectedRoutes.register(reportingRoutes);
    await protectedRoutes.register(scannerRoutes);
    await protectedRoutes.register(notificationRoutes);
    await protectedRoutes.register(reviewRoutes);
    await protectedRoutes.register(cacheRoutes);
    await protectedRoutes.register(promptRoutes);
    await protectedRoutes.register(pipelineRoutes);
    await protectedRoutes.register(aiJobRoutes);
    await protectedRoutes.register(citationRoutes);
    await protectedRoutes.register(presenceRoutes);

    // Register public share management routes (create, list, revoke — auth required)
    const { publicShareRoutes } = await import("./api/public-share.js");
    await protectedRoutes.register(publicShareRoutes);

    // Register supply chain analysis routes
    const { supplyChainRoutes } = await import("./api/supply-chain.js");
    await protectedRoutes.register(supplyChainRoutes);

    // Register v1 API routes (new modular features)
    await protectedRoutes.register(v1Routes);
  });

  // Register observability routes (metrics, health checks - public)
  await server.register(observabilityRoutes);

  // API version info
  server.get(
    "/api",
    routeAuthz({ public: "static version info" }),
    async () => {
      return {
        name: "ThreatForge API",
        version: "0.1.0",
        documentation: "/api/docs",
      };
    },
  );

  // CSRF token endpoint (requires authentication)
  server.get(
    "/api/csrf-token",
    { preHandler: authenticate, config: { authz: "authenticated" } },
    getCsrfToken,
  );

  // Token refresh endpoint (no authentication required, uses refresh token)
  server.post(
    "/api/auth/refresh",
    routeAuthz({ public: "the refresh token is the credential" }),
    refreshToken,
  );

  // WebSocket endpoint for real-time collaboration
  // URL format: /ws/:modelId?token=xxx
  server.get<{ Params: { modelId: string }; Querystring: { token?: string } }>(
    "/ws/:modelId",
    {
      websocket: true,
      config: {
        authz: {
          handler:
            "verifies the ?token JWT and canAccessThreatModel; anonymous only outside production",
        },
      },
    },
    async (socket, req) => {
      const { modelId } = req.params;
      const token = req.query.token;

      // Verify JWT token
      let userId: string;
      let userName: string;
      let receiveOnly = false;

      if (token) {
        try {
          const payload = server.jwt.verify<JWTPayload>(token);
          userId = payload.id;
          userName = payload.name || "User";

          const access = await resolveCollaborationAccess(payload, modelId);
          if (!access.ok) {
            server.log.warn(
              { modelId, userId },
              `WebSocket rejected: ${access.reason}`,
            );
            socket.close(access.code, access.reason);
            return;
          }
          receiveOnly = access.receiveOnly;
        } catch (err) {
          server.log.warn({ modelId, err }, "WebSocket authentication failed");
          socket.close(4001, "Authentication failed");
          return;
        }
      } else if (IS_PRODUCTION) {
        // In production, require authentication
        server.log.warn(
          { modelId },
          "WebSocket connection rejected - no token in production",
        );
        socket.close(4001, "Authentication required");
        return;
      } else {
        // In development, allow anonymous connections with warning
        userId = "dev-anonymous";
        userName = "Anonymous (Dev)";
        server.log.warn(
          { modelId },
          "WebSocket anonymous connection allowed in development mode",
        );
      }

      // Check server affinity when Redis is enabled
      if (isRedisEnabled()) {
        const preferredServer = await getPreferredServer(modelId);
        const currentServer = getServerId();

        // Log server affinity info (in production, a load balancer would handle routing)
        if (preferredServer && preferredServer !== currentServer) {
          server.log.info(
            { modelId, preferredServer, currentServer },
            "Model has existing sessions on another server (sticky session hint)",
          );
        }
      }

      server.log.info(
        { modelId, userId, userName },
        "WebSocket client connected for collaboration",
      );

      // Initialize collaboration state from database/canvas. If that fails,
      // close instead of serving an empty doc that saves would write back.
      try {
        await initCollaborationFromCanvas(modelId);
      } catch (err) {
        server.log.error(
          { modelId, err },
          "Failed to initialize collaboration state; closing the session",
        );
        socket.close(1011, "Could not load this model for editing");
        return;
      }

      // Register session for horizontal scaling
      try {
        await registerCollaborationSession(modelId, userId, userName);
      } catch (err) {
        server.log.error(
          { modelId, err },
          "Failed to register collaboration session",
        );
      }

      handleConnection(socket, modelId, userId, userName, { receiveOnly });

      socket.on("close", async () => {
        server.log.info({ modelId, userId }, "WebSocket client disconnected");

        // Unregister session on disconnect
        try {
          await unregisterCollaborationSession(modelId, userId);
        } catch (err) {
          server.log.error(
            { modelId, err },
            "Failed to unregister collaboration session",
          );
        }
      });
    },
  );

  return server;
}
