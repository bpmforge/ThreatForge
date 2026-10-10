/**
 * Version History API routes.
 *
 * CRUD operations for threat model versions.
 * All routes require authentication and model access verification.
 */
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getPrisma } from "../db.js";
import { getAuthUser } from "../utils/auth-helpers.js";
import { syncCanvasToDatabase } from "../services/canvas-sync.js";
import logger from "../utils/logger.js";
import {
  sendSuccess,
  sendCreated,
  sendNotFound,
  sendBadRequest,
} from "../utils/api-response.js";
import {
  diffModels,
  type ModelSnapshot,
} from "../services/versioning/model-diff.js";
import { authorizeModelAction } from "./threat-models/helpers.js";
import { routeAuthz } from "../middleware/authz-policy.js";
import { dispatchWebhookEvent } from "../services/webhooks/webhook-dispatcher.js";

const MODEL_VIEW = routeAuthz({ model: "view" });
const MODEL_EDIT = routeAuthz({ model: "edit" });

const CreateVersionSchema = z.object({
  name: z.string().max(100).optional(),
  changesSummary: z.string().max(500).optional(),
});

const UpdateVersionSchema = z.object({
  name: z.string().max(100).optional(),
  changesSummary: z.string().max(500).optional(),
});

export async function versionRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/threat-models/:id/versions
   * List all versions for a threat model
   */
  fastify.get<{
    Params: { id: string };
    Querystring: { limit?: string; page?: string };
  }>("/api/threat-models/:id/versions", MODEL_VIEW, async (request, reply) => {
    const user = getAuthUser(request);
    const prisma = await getPrisma();
    const { id } = request.params;

    const limit = Math.min(
      Math.max(1, parseInt(request.query.limit ?? "50", 10) || 50),
      100,
    );
    const page = Math.max(1, parseInt(request.query.page ?? "1", 10) || 1);

    if (!(await authorizeModelAction(reply, user.id, id, "view"))) {
      return reply;
    }

    const versions = await prisma.threatModelVersion.findMany({
      where: { threatModelId: id },
      orderBy: { version: "desc" },
      take: limit,
      skip: (page - 1) * limit,
      select: {
        id: true,
        version: true,
        changesSummary: true,
        documentIds: true,
        createdById: true,
        createdAt: true,
      },
    });

    // Get user names for each version
    const userIds = [...new Set(versions.map((v) => v.createdById))];
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    return versions.map((v) => ({
      id: v.id,
      version: v.version,
      name: null,
      changesSummary: v.changesSummary,
      documentCount: (() => {
        try {
          return JSON.parse(v.documentIds || "[]").length;
        } catch {
          return 0;
        }
      })(),
      createdById: v.createdById,
      createdBy: userMap.get(v.createdById),
      createdAt: v.createdAt.toISOString(),
    }));
  });

  /**
   * GET /api/threat-models/:id/versions/:versionId
   * Get a specific version with full canvas state
   */
  fastify.get<{ Params: { id: string; versionId: string } }>(
    "/api/threat-models/:id/versions/:versionId",
    MODEL_VIEW,
    async (request, reply) => {
      const authUser = getAuthUser(request);
      const prisma = await getPrisma();
      const { id, versionId } = request.params;

      if (!(await authorizeModelAction(reply, authUser.id, id, "view"))) {
        return reply;
      }

      const version = await prisma.threatModelVersion.findFirst({
        where: { id: versionId, threatModelId: id },
      });

      if (!version) {
        return sendNotFound(reply, "Version");
      }

      const user = await prisma.user.findUnique({
        where: { id: version.createdById },
        select: { id: true, name: true },
      });

      let canvasState: Record<string, unknown>;
      try {
        canvasState = JSON.parse(version.canvasState);
      } catch {
        canvasState = {};
      }

      return {
        id: version.id,
        version: version.version,
        name: null,
        changesSummary: version.changesSummary,
        canvasState,
        createdById: version.createdById,
        createdBy: user,
        createdAt: version.createdAt.toISOString(),
      };
    },
  );

  /**
   * POST /api/threat-models/:id/versions
   * Create a new version (snapshot current state)
   */
  fastify.post<{ Params: { id: string } }>(
    "/api/threat-models/:id/versions",
    MODEL_EDIT,
    async (request, reply) => {
      const authUser = getAuthUser(request);
      const prisma = await getPrisma();
      const { id } = request.params;
      const parseResult = CreateVersionSchema.safeParse(request.body);

      if (!parseResult.success) {
        return sendBadRequest(reply, "Validation failed", {
          details: parseResult.error.flatten(),
        });
      }

      if (!(await authorizeModelAction(reply, authUser.id, id, "edit"))) {
        return reply;
      }

      const model = await prisma.threatModel.findUnique({
        where: { id },
        include: { project: { select: { organizationId: true } } },
      });
      if (!model) {
        return sendNotFound(reply, "Threat model");
      }

      // Get current max version number
      const maxVersion = await prisma.threatModelVersion.findFirst({
        where: { threatModelId: id },
        orderBy: { version: "desc" },
        select: { version: true },
      });

      const newVersionNumber = (maxVersion?.version || 0) + 1;

      // Capture document IDs for version-linked evidence
      const docs = await prisma.document.findMany({
        where: { threatModelId: id },
        select: { id: true },
      });
      const documentIds = JSON.stringify(docs.map((d) => d.id));

      const version = await prisma.threatModelVersion.create({
        data: {
          threatModelId: id,
          version: newVersionNumber,
          canvasState: model.canvasState,
          changesSummary: parseResult.data.changesSummary,
          documentIds,
          createdById: authUser.id,
        },
      });

      // Fire webhook — fire-and-forget
      const orgId = model.project?.organizationId;
      if (orgId) {
        dispatchWebhookEvent(orgId, "model.version_created", {
          versionId: version.id,
          modelId: id,
          versionNumber: version.version,
        });
      }

      // Sync canvas to normalized tables - version creation is an explicit checkpoint
      try {
        const canvasState = JSON.parse(model.canvasState);
        await syncCanvasToDatabase(id, canvasState);
      } catch (syncError) {
        logger.error(
          { data: syncError },
          "Failed to sync canvas on version creation:",
        );
      }

      // Retention: keep only the 50 most recent versions per model.
      // Prune oldest beyond the limit to prevent unbounded blob accumulation.
      const MAX_VERSIONS = 50;
      try {
        const oldest = await prisma.threatModelVersion.findMany({
          where: { threatModelId: id },
          orderBy: { version: "desc" },
          skip: MAX_VERSIONS,
          select: { id: true },
        });
        if (oldest.length > 0) {
          await prisma.threatModelVersion.deleteMany({
            where: { id: { in: oldest.map((v) => v.id) } },
          });
        }
      } catch (pruneError) {
        logger.warn({ data: pruneError }, "Version retention prune failed");
      }

      return sendCreated(reply, {
        id: version.id,
        version: version.version,
        name: parseResult.data.name || null,
        changesSummary: version.changesSummary,
        createdById: version.createdById,
        createdBy: { id: authUser.id, name: authUser.name },
        createdAt: version.createdAt.toISOString(),
      });
    },
  );

  /**
   * POST /api/threat-models/:id/versions/:versionId/restore
   * Restore a previous version (creates new version with old state)
   */
  fastify.post<{ Params: { id: string; versionId: string } }>(
    "/api/threat-models/:id/versions/:versionId/restore",
    MODEL_EDIT,
    async (request, reply) => {
      const authUser = getAuthUser(request);
      const prisma = await getPrisma();
      const { id, versionId } = request.params;

      if (!(await authorizeModelAction(reply, authUser.id, id, "edit"))) {
        return reply;
      }

      const model = await prisma.threatModel.findUnique({ where: { id } });
      if (!model) {
        return sendNotFound(reply, "Threat model");
      }

      const versionToRestore = await prisma.threatModelVersion.findFirst({
        where: { id: versionId, threatModelId: id },
      });

      if (!versionToRestore) {
        return sendNotFound(reply, "Version");
      }

      // Get current max version number
      const maxVersion = await prisma.threatModelVersion.findFirst({
        where: { threatModelId: id },
        orderBy: { version: "desc" },
        select: { version: true },
      });

      const newVersionNumber = (maxVersion?.version || 0) + 1;

      // First, save current state as a version
      await prisma.threatModelVersion.create({
        data: {
          threatModelId: id,
          version: newVersionNumber,
          canvasState: model.canvasState,
          changesSummary: "Auto-saved before restore",
          createdById: authUser.id,
        },
      });

      // Update threat model with restored state
      await prisma.threatModel.update({
        where: { id },
        data: {
          canvasState: versionToRestore.canvasState,
          version: { increment: 1 },
        },
      });

      // Create a new version representing the restore
      const restoredVersion = await prisma.threatModelVersion.create({
        data: {
          threatModelId: id,
          version: newVersionNumber + 1,
          canvasState: versionToRestore.canvasState,
          changesSummary: `Restored from Version ${versionToRestore.version}`,
          createdById: authUser.id,
        },
      });

      // Sync restored canvas to normalized tables
      try {
        const canvasState = JSON.parse(versionToRestore.canvasState);
        await syncCanvasToDatabase(id, canvasState);
      } catch (syncError) {
        logger.error(
          { data: syncError },
          "Failed to sync canvas on version restore:",
        );
      }

      return sendCreated(reply, {
        id: restoredVersion.id,
        version: restoredVersion.version,
        name: null,
        changesSummary: restoredVersion.changesSummary,
        createdById: restoredVersion.createdById,
        createdBy: { id: authUser.id, name: authUser.name },
        createdAt: restoredVersion.createdAt.toISOString(),
      });
    },
  );

  /**
   * PATCH /api/threat-models/:id/versions/:versionId
   * Update version metadata
   */
  fastify.patch<{ Params: { id: string; versionId: string } }>(
    "/api/threat-models/:id/versions/:versionId",
    MODEL_EDIT,
    async (request, reply) => {
      const authUser = getAuthUser(request);
      const prisma = await getPrisma();
      const { id, versionId } = request.params;
      const parseResult = UpdateVersionSchema.safeParse(request.body);

      if (!parseResult.success) {
        return sendBadRequest(reply, "Validation failed", {
          details: parseResult.error.flatten(),
        });
      }

      if (!(await authorizeModelAction(reply, authUser.id, id, "edit"))) {
        return reply;
      }

      const version = await prisma.threatModelVersion.findFirst({
        where: { id: versionId, threatModelId: id },
      });

      if (!version) {
        return sendNotFound(reply, "Version");
      }

      const { changesSummary } = parseResult.data;

      const updated = await prisma.threatModelVersion.update({
        where: { id: versionId },
        data: {
          ...(changesSummary !== undefined && { changesSummary }),
        },
      });

      const user = await prisma.user.findUnique({
        where: { id: updated.createdById },
        select: { id: true, name: true },
      });

      return {
        id: updated.id,
        version: updated.version,
        name: parseResult.data.name || null,
        changesSummary: updated.changesSummary,
        createdById: updated.createdById,
        createdBy: user,
        createdAt: updated.createdAt.toISOString(),
      };
    },
  );

  /**
   * GET /api/threat-models/:id/versions/diff?from=versionId1&to=versionId2
   * Compare two versions and return structured diff
   */
  fastify.get<{
    Params: { id: string };
    Querystring: { from: string; to: string };
  }>(
    "/api/threat-models/:id/versions/diff",
    MODEL_VIEW,
    async (request, reply) => {
      const user = getAuthUser(request);
      const prisma = await getPrisma();
      const { id } = request.params;
      const { from: fromId, to: toId } = request.query;

      if (!fromId || !toId) {
        return sendBadRequest(
          reply,
          "Both 'from' and 'to' version IDs are required",
        );
      }

      if (!(await authorizeModelAction(reply, user.id, id, "view"))) {
        return reply;
      }

      // Load size metadata first to guard against transferring huge blobs
      const [fromMeta, toMeta] = await Promise.all([
        prisma.threatModelVersion.findFirst({
          where: { id: fromId, threatModelId: id },
          select: {
            id: true,
            version: true,
            createdAt: true,
            canvasState: true,
          },
        }),
        prisma.threatModelVersion.findFirst({
          where: { id: toId, threatModelId: id },
          select: {
            id: true,
            version: true,
            createdAt: true,
            canvasState: true,
          },
        }),
      ]);

      if (!fromMeta || !toMeta) {
        return sendNotFound(reply, "Version");
      }

      const MAX_DIFF_BLOB_BYTES = 5 * 1024 * 1024; // 5 MB per snapshot
      if (
        fromMeta.canvasState.length > MAX_DIFF_BLOB_BYTES ||
        toMeta.canvasState.length > MAX_DIFF_BLOB_BYTES
      ) {
        return sendBadRequest(
          reply,
          "One or both versions are too large for an inline diff (>5 MB). Download the snapshots individually.",
        );
      }

      const fromVersion = fromMeta;
      const toVersion = toMeta;

      // Parse canvas states and build snapshots
      // Also load threats/mitigations for each version timeframe
      const buildSnapshot = (canvasState: string): ModelSnapshot => {
        try {
          const canvas = JSON.parse(canvasState || "{}");
          const nodes = canvas.nodes || [];
          const edges = canvas.edges || [];

          return {
            components: nodes
              .filter((n: { type?: string }) => n.type === "component")
              .map(
                (n: {
                  id: string;
                  data?: { label?: string; type?: string };
                }) => ({
                  id: n.id,
                  name: n.data?.label || "Unknown",
                  type: n.data?.type || "PROCESS",
                }),
              ),
            connections: edges.map(
              (e: {
                id: string;
                source: string;
                target: string;
                label?: string;
              }) => ({
                id: e.id,
                source: e.source,
                target: e.target,
                label: e.label,
              }),
            ),
            threats: [],
            mitigations: [],
          };
        } catch {
          return {
            components: [],
            connections: [],
            threats: [],
            mitigations: [],
          };
        }
      };

      const beforeSnapshot = buildSnapshot(fromVersion.canvasState);
      const afterSnapshot = buildSnapshot(toVersion.canvasState);

      // Load current threats for "to" version context
      const currentThreats = await prisma.threat.findMany({
        where: { threatModelId: id },
        include: { mitigations: true },
      });

      afterSnapshot.threats = currentThreats.map((t) => ({
        id: t.id,
        name: t.name,
        severity: t.severity,
        status: t.status,
        componentId: t.componentNodeId || undefined,
      }));

      afterSnapshot.mitigations = currentThreats.flatMap((t) =>
        t.mitigations.map((m) => ({
          id: m.id,
          description: m.description,
          status: m.status,
          threatId: t.id,
        })),
      );

      const diff = diffModels(beforeSnapshot, afterSnapshot);

      return sendSuccess(reply, {
        from: {
          id: fromVersion.id,
          version: fromVersion.version,
          createdAt: fromVersion.createdAt,
        },
        to: {
          id: toVersion.id,
          version: toVersion.version,
          createdAt: toVersion.createdAt,
        },
        diff,
      });
    },
  );
}
