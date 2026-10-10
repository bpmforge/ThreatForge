/**
 * Threat Model API - Normalized Data Routes (Components, Connections, Interfaces)
 */
import type { FastifyPluginAsync } from "fastify";
import { getPrisma } from "../../../db.js";
import { ensureCanvasSynced } from "../../../services/canvas-sync.js";
import { getAuthUser, canAccessThreatModel } from "../helpers.js";
import { sendNotFound } from "../../../utils/api-response.js";
import { routeAuthz } from "../../../middleware/authz-policy.js";

const MODEL_VIEW = routeAuthz({ model: "view" });

export const normalizedRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /api/threat-models/:id/components
   * Get all components for a threat model (from normalized tables)
   */
  fastify.get<{ Params: { id: string } }>(
    "/api/threat-models/:id/components",
    MODEL_VIEW,
    async (request, reply) => {
      const user = getAuthUser(request);
      const prisma = await getPrisma();
      const { id } = request.params;

      const hasAccess = await canAccessThreatModel(user.id, id);
      if (!hasAccess) {
        return sendNotFound(reply, "Threat model");
      }

      await ensureCanvasSynced(id);

      const components = await prisma.component.findMany({
        where: { threatModelId: id },
        include: { interfaces: true },
        orderBy: { name: "asc" },
      });

      return {
        data: components.map((c) => ({
          ...c,
          properties: JSON.parse(c.properties),
          interfaces: c.interfaces.map(
            (i: { dataClassifications: string }) => ({
              ...i,
              dataClassifications: JSON.parse(i.dataClassifications),
            }),
          ),
        })),
      };
    },
  );

  /**
   * GET /api/threat-models/:id/connections
   * Get all connections for a threat model (from normalized tables)
   */
  fastify.get<{ Params: { id: string } }>(
    "/api/threat-models/:id/connections",
    MODEL_VIEW,
    async (request, reply) => {
      const user = getAuthUser(request);
      const prisma = await getPrisma();
      const { id } = request.params;

      const hasAccess = await canAccessThreatModel(user.id, id);
      if (!hasAccess) {
        return sendNotFound(reply, "Threat model");
      }

      await ensureCanvasSynced(id);

      const connections = await prisma.connection.findMany({
        where: { threatModelId: id },
        include: {
          sourceComponent: { select: { id: true, name: true, type: true } },
          targetComponent: { select: { id: true, name: true, type: true } },
          sourceInterface: {
            select: { id: true, name: true, port: true, protocol: true },
          },
          targetInterface: {
            select: { id: true, name: true, port: true, protocol: true },
          },
        },
      });

      return {
        data: connections.map((c) => ({
          ...c,
          dataClassifications: JSON.parse(c.dataClassifications),
        })),
      };
    },
  );

  /**
   * GET /api/threat-models/:id/interfaces
   * Get all interfaces across all components for a threat model
   */
  fastify.get<{ Params: { id: string } }>(
    "/api/threat-models/:id/interfaces",
    MODEL_VIEW,
    async (request, reply) => {
      const user = getAuthUser(request);
      const prisma = await getPrisma();
      const { id } = request.params;

      const hasAccess = await canAccessThreatModel(user.id, id);
      if (!hasAccess) {
        return sendNotFound(reply, "Threat model");
      }

      await ensureCanvasSynced(id);

      const interfaces = await prisma.componentInterface.findMany({
        where: { component: { threatModelId: id } },
        include: {
          component: { select: { id: true, name: true, type: true } },
        },
        orderBy: [{ component: { name: "asc" } }, { name: "asc" }],
      });

      return {
        data: interfaces.map((i) => ({
          ...i,
          dataClassifications: JSON.parse(i.dataClassifications),
        })),
      };
    },
  );
};
