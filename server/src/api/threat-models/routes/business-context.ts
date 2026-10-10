/**
 * Business Context API Routes (A23)
 *
 * GET /api/threat-models/:id/business-context  — fetch context fields
 * PUT /api/threat-models/:id/business-context  — update + bulk-recalculate threats
 */
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { getPrisma } from "../../../db.js";
import { canPerformAction } from "../../../services/access-control/access-control-service.js";
import {
  sendNotFound,
  sendBadRequest,
  sendForbidden,
  sendSuccess,
} from "../../../utils/api-response.js";
import { getAuthUser, authorizeModelAction } from "../helpers.js";
import {
  calculateBusinessRisk,
  type BusinessContext,
} from "../../../services/risk/risk-calculator.js";
import type { RiskTier } from "@prisma/client";
import { routeAuthz } from "../../../middleware/authz-policy.js";

const BusinessImpactEnum = z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);
const DataClassificationEnum = z.enum([
  "PUBLIC",
  "INTERNAL",
  "CONFIDENTIAL",
  "RESTRICTED",
]);
const UserBaseEnum = z.enum(["INTERNAL", "CUSTOMERS", "PUBLIC"]);
const RevenueImpactEnum = z.enum(["NONE", "INDIRECT", "DIRECT", "PRIMARY"]);

const BusinessContextUpdateSchema = z.object({
  businessImpact: BusinessImpactEnum.nullable().optional(),
  dataClassification: DataClassificationEnum.nullable().optional(),
  regulatoryScope: z.array(z.string()).optional(),
  userBase: UserBaseEnum.nullable().optional(),
  revenueImpact: RevenueImpactEnum.nullable().optional(),
});

const MODEL_VIEW = routeAuthz({ model: "view" });
const MODEL_EDIT = routeAuthz({ model: "edit" });

export const businessContextRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /api/threat-models/:id/business-context
   * Returns the business context fields for a threat model.
   */
  fastify.get<{ Params: { id: string } }>(
    "/api/threat-models/:id/business-context",
    MODEL_VIEW,
    async (request, reply) => {
      const user = getAuthUser(request);
      const prisma = await getPrisma();
      const { id } = request.params;

      const actionCheck = await canPerformAction(user.id, id, "view");
      if (!actionCheck.allowed) {
        if (!actionCheck.access?.hasAccess) {
          return sendNotFound(reply, "Threat model");
        }
        return sendForbidden(reply, actionCheck.error);
      }

      const model = await prisma.threatModel.findUnique({
        where: { id },
        select: {
          id: true,
          businessImpact: true,
          dataClassification: true,
          regulatoryScope: true,
          userBase: true,
          revenueImpact: true,
        },
      });

      if (!model) return sendNotFound(reply, "Threat model");

      return sendSuccess(reply, {
        ...model,
        regulatoryScope: JSON.parse(model.regulatoryScope) as string[],
      });
    },
  );

  /**
   * PUT /api/threat-models/:id/business-context
   * Updates the business context and synchronously recalculates all threats.
   */
  fastify.put<{ Params: { id: string } }>(
    "/api/threat-models/:id/business-context",
    MODEL_EDIT,
    async (request, reply) => {
      const user = getAuthUser(request);
      const prisma = await getPrisma();
      const { id } = request.params;

      if (!(await authorizeModelAction(reply, user.id, id, "edit"))) {
        return reply;
      }

      const parseResult = BusinessContextUpdateSchema.safeParse(request.body);
      if (!parseResult.success) {
        return sendBadRequest(reply, "Invalid business context", {
          details: parseResult.error.flatten(),
        });
      }

      const patch = parseResult.data;

      // Fetch existing model to merge partial update
      const existing = await prisma.threatModel.findUnique({
        where: { id },
        select: {
          businessImpact: true,
          dataClassification: true,
          regulatoryScope: true,
          userBase: true,
          revenueImpact: true,
        },
      });

      if (!existing) return sendNotFound(reply, "Threat model");

      const updated = await prisma.threatModel.update({
        where: { id },
        data: {
          businessImpact:
            "businessImpact" in patch ? patch.businessImpact : undefined,
          dataClassification:
            "dataClassification" in patch
              ? patch.dataClassification
              : undefined,
          regulatoryScope:
            patch.regulatoryScope !== undefined
              ? JSON.stringify(patch.regulatoryScope)
              : undefined,
          userBase: "userBase" in patch ? patch.userBase : undefined,
          revenueImpact:
            "revenueImpact" in patch ? patch.revenueImpact : undefined,
        },
        select: {
          id: true,
          businessImpact: true,
          dataClassification: true,
          regulatoryScope: true,
          userBase: true,
          revenueImpact: true,
        },
      });

      const context: BusinessContext = {
        businessImpact:
          updated.businessImpact as BusinessContext["businessImpact"],
        dataClassification:
          updated.dataClassification as BusinessContext["dataClassification"],
        regulatoryScope: JSON.parse(updated.regulatoryScope) as string[],
        userBase: updated.userBase as BusinessContext["userBase"],
        revenueImpact:
          updated.revenueImpact as BusinessContext["revenueImpact"],
      };

      // Bulk-recalculate all threats for this model
      const threats = await prisma.threat.findMany({
        where: { threatModelId: id },
        select: { id: true, severity: true, likelihood: true },
      });

      for (const threat of threats) {
        const result = calculateBusinessRisk(
          threat.severity,
          threat.likelihood,
          context,
        );
        if (result) {
          await prisma.threat.update({
            where: { id: threat.id },
            data: {
              businessRiskScore: result.businessRisk,
              businessRiskTier: result.businessRiskTier as RiskTier,
            },
          });
        }
      }

      return sendSuccess(reply, {
        ...updated,
        regulatoryScope: JSON.parse(updated.regulatoryScope) as string[],
        threatsRecalculated: threats.length,
      });
    },
  );
};
