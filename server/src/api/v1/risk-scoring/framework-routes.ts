/**
 * Risk Framework CRUD Routes
 */
import type { FastifyPluginAsync } from "fastify";
import { getPrisma } from "../../../db.js";
import { getAuthUser, checkOrganizationAccess, logAudit } from "../helpers.js";
import { CreateFrameworkSchema, type CreateFrameworkInput } from "./schemas.js";
import {
  sendSuccess,
  sendCreated,
  sendNotFound,
  sendForbidden,
  sendConflict,
  sendNoContent,
} from "../../../utils/api-response.js";

export const frameworkRoutes: FastifyPluginAsync = async (server) => {
  const prisma = await getPrisma();

  /**
   * GET /risk-frameworks
   * List available risk frameworks
   */
  server.get<{ Querystring: { organizationId: string } }>(
    "/risk-frameworks",
    {
      schema: {
        tags: ["Risk Scoring"],
        summary: "List risk frameworks",
      },
      config: { authz: { org: "VIEWER" } },
    },
    async (request, reply) => {
      const user = getAuthUser(request);
      const { organizationId } = request.query;

      const access = await checkOrganizationAccess(user.id, organizationId);
      if (!access) {
        return sendForbidden(reply);
      }

      const frameworks = await prisma.riskFramework.findMany({
        where: {
          OR: [{ organizationId }, { organizationId: null, isDefault: true }],
          isActive: true,
        },
        orderBy: [{ isDefault: "desc" }, { name: "asc" }],
      });

      return sendSuccess(reply, {
        data: frameworks.map((f) => ({
          id: f.id,
          name: f.name,
          type: f.type,
          description: f.description,
          config: JSON.parse(f.config),
          isDefault: f.isDefault,
          isOwned: f.organizationId === organizationId,
          createdAt: f.createdAt.toISOString(),
        })),
      });
    },
  );

  /**
   * POST /risk-frameworks
   * Create a custom risk framework
   */
  server.post<{ Body: CreateFrameworkInput }>(
    "/risk-frameworks",
    {
      schema: {
        tags: ["Risk Scoring"],
        summary: "Create risk framework",
      },
      config: { authz: { org: "ADMIN" } },
    },
    async (request, reply) => {
      const user = getAuthUser(request);
      const body = CreateFrameworkSchema.parse(request.body);

      const access = await checkOrganizationAccess(
        user.id,
        body.organizationId,
      );
      if (
        !access ||
        !access.role ||
        !["OWNER", "ADMIN"].includes(access.role)
      ) {
        return sendForbidden(reply, "Admin access required");
      }

      const existing = await prisma.riskFramework.findFirst({
        where: { organizationId: body.organizationId, name: body.name },
      });
      if (existing) {
        return sendConflict(reply, "Framework with this name already exists");
      }

      if (body.isDefault) {
        await prisma.riskFramework.updateMany({
          where: { organizationId: body.organizationId, isDefault: true },
          data: { isDefault: false },
        });
      }

      const framework = await prisma.riskFramework.create({
        data: {
          organizationId: body.organizationId,
          name: body.name,
          type: body.type,
          description: body.description,
          config: JSON.stringify(body.config),
          isDefault: body.isDefault,
          createdById: user.id,
        },
      });

      await logAudit({
        scope: "ORGANIZATION",
        action: "CREATE",
        resourceType: "THREAT_LIBRARY",
        resourceId: framework.id,
        resourceName: framework.name,
        userId: user.id,
        userEmail: user.email || "",
        organizationId: body.organizationId,
        metadata: { type: "risk_framework", frameworkType: body.type },
      });

      return sendCreated(reply, {
        id: framework.id,
        name: framework.name,
        type: framework.type,
        description: framework.description,
        config: body.config,
        isDefault: framework.isDefault,
        createdAt: framework.createdAt.toISOString(),
      });
    },
  );

  /**
   * DELETE /risk-frameworks/:id
   * Delete a risk framework
   */
  server.delete<{
    Params: { id: string };
    Querystring: { organizationId: string };
  }>(
    "/risk-frameworks/:id",
    {
      schema: {
        tags: ["Risk Scoring"],
        summary: "Delete risk framework",
      },
      config: { authz: { org: "ADMIN" } },
    },
    async (request, reply) => {
      const user = getAuthUser(request);
      const { id } = request.params;
      const { organizationId } = request.query;

      const access = await checkOrganizationAccess(user.id, organizationId);
      if (
        !access ||
        !access.role ||
        !["OWNER", "ADMIN"].includes(access.role)
      ) {
        return sendForbidden(reply, "Admin access required");
      }

      const framework = await prisma.riskFramework.findFirst({
        where: { id, organizationId },
      });
      if (!framework) {
        return sendNotFound(reply, "Framework");
      }

      await prisma.threatRiskScore.deleteMany({ where: { frameworkId: id } });
      await prisma.riskFramework.delete({ where: { id } });

      await logAudit({
        scope: "ORGANIZATION",
        action: "DELETE",
        resourceType: "THREAT_LIBRARY",
        resourceId: id,
        resourceName: framework.name,
        userId: user.id,
        userEmail: user.email || "",
        organizationId,
        metadata: { type: "risk_framework" },
      });

      return sendNoContent(reply);
    },
  );

  /**
   * GET /risk-frameworks/:frameworkId/presets
   * Get preset factor configurations for a framework
   */
  server.get<{ Params: { frameworkId: string } }>(
    "/risk-frameworks/:frameworkId/presets",
    {
      config: {
        authz: {
          handler:
            "built-in frameworks for anyone signed in; an org framework needs ACTIVE membership",
        },
      },
      schema: {
        tags: ["Risk Scoring"],
        summary: "Get framework factor presets",
      },
    },
    async (request, reply) => {
      const { frameworkId } = request.params;

      const framework = await prisma.riskFramework.findUnique({
        where: { id: frameworkId },
      });
      // Org frameworks are visible to that org's ACTIVE members only;
      // built-in ones (no organizationId) to everyone signed in.
      if (
        !framework ||
        (framework.organizationId &&
          !(await checkOrganizationAccess(
            getAuthUser(request).id,
            framework.organizationId,
          )))
      ) {
        return sendNotFound(reply, "Framework");
      }

      switch (framework.type) {
        case "OWASP_RISK_RATING":
          return sendSuccess(reply, {
            presets: [
              {
                name: "Low Risk Default",
                factors: {
                  skillLevel: 2,
                  motive: 2,
                  opportunity: 2,
                  size: 2,
                  easeOfDiscovery: 2,
                  easeOfExploit: 2,
                  awareness: 2,
                  intrusionDetection: 2,
                  lossOfConfidentiality: 2,
                  lossOfIntegrity: 2,
                  lossOfAvailability: 2,
                  lossOfAccountability: 2,
                  financialDamage: 2,
                  reputationDamage: 2,
                  nonCompliance: 2,
                  privacyViolation: 2,
                },
              },
              {
                name: "Medium Risk Default",
                factors: {
                  skillLevel: 5,
                  motive: 5,
                  opportunity: 5,
                  size: 5,
                  easeOfDiscovery: 5,
                  easeOfExploit: 5,
                  awareness: 5,
                  intrusionDetection: 5,
                  lossOfConfidentiality: 5,
                  lossOfIntegrity: 5,
                  lossOfAvailability: 5,
                  lossOfAccountability: 5,
                  financialDamage: 5,
                  reputationDamage: 5,
                  nonCompliance: 5,
                  privacyViolation: 5,
                },
              },
              {
                name: "High Risk Default",
                factors: {
                  skillLevel: 7,
                  motive: 7,
                  opportunity: 7,
                  size: 7,
                  easeOfDiscovery: 7,
                  easeOfExploit: 7,
                  awareness: 7,
                  intrusionDetection: 7,
                  lossOfConfidentiality: 7,
                  lossOfIntegrity: 7,
                  lossOfAvailability: 7,
                  lossOfAccountability: 7,
                  financialDamage: 7,
                  reputationDamage: 7,
                  nonCompliance: 7,
                  privacyViolation: 7,
                },
              },
            ],
          });
        case "DREAD":
          return sendSuccess(reply, {
            presets: [
              {
                name: "Low Risk",
                factors: {
                  damage: 2,
                  reproducibility: 2,
                  exploitability: 2,
                  affectedUsers: 2,
                  discoverability: 2,
                },
              },
              {
                name: "Medium Risk",
                factors: {
                  damage: 5,
                  reproducibility: 5,
                  exploitability: 5,
                  affectedUsers: 5,
                  discoverability: 5,
                },
              },
              {
                name: "High Risk",
                factors: {
                  damage: 8,
                  reproducibility: 8,
                  exploitability: 8,
                  affectedUsers: 8,
                  discoverability: 8,
                },
              },
            ],
          });
        default:
          return sendSuccess(reply, { presets: [] });
      }
    },
  );

  /**
   * POST /risk-frameworks/seed-defaults
   * Seed default system frameworks (admin only)
   */
  server.post(
    "/risk-frameworks/seed-defaults",
    {
      schema: {
        tags: ["Risk Scoring"],
        summary: "Seed default frameworks (admin only)",
      },
      config: { authz: "superAdmin" },
    },
    async (request, reply) => {
      const user = getAuthUser(request);

      const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
      if (!dbUser?.isSuperAdmin) {
        return sendForbidden(reply, "Super admin access required");
      }

      const existingDefaults = await prisma.riskFramework.count({
        where: { isDefault: true, organizationId: null },
      });
      if (existingDefaults > 0) {
        return sendSuccess(reply, {
          message: "Default frameworks already exist",
          count: existingDefaults,
        });
      }

      const defaults = [
        {
          name: "OWASP Risk Rating",
          type: "OWASP_RISK_RATING" as const,
          description:
            "OWASP Risk Rating methodology using likelihood and impact factors.",
          config: JSON.stringify({
            factorGroups: [
              "threatAgent",
              "vulnerability",
              "technicalImpact",
              "businessImpact",
            ],
          }),
        },
        {
          name: "DREAD",
          type: "DREAD" as const,
          description:
            "DREAD threat modeling methodology (Damage, Reproducibility, Exploitability, Affected users, Discoverability).",
          config: JSON.stringify({
            factors: [
              "damage",
              "reproducibility",
              "exploitability",
              "affectedUsers",
              "discoverability",
            ],
          }),
        },
      ];

      for (const def of defaults) {
        await prisma.riskFramework.create({
          data: {
            ...def,
            isDefault: true,
            isActive: true,
            organizationId: null,
            createdById: user.id,
          },
        });
      }

      return sendSuccess(reply, {
        message: "Default frameworks created",
        count: defaults.length,
      });
    },
  );
};
