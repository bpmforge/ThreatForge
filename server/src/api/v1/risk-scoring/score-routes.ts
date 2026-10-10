/**
 * Risk Score Calculation Routes
 */
import type { FastifyPluginAsync } from "fastify";
import { getPrisma } from "../../../db.js";
import { getAuthUser } from "../helpers.js";
import { authorizeModelAction } from "../../threat-models/helpers.js";
import {
  CalculateScoreSchema,
  OWASPFactorsSchema,
  DREADFactorsSchema,
  type CalculateScoreInput,
} from "./schemas.js";
import {
  calculateOWASPScore,
  calculateDREADScore,
  calculateCustomScore,
} from "./calculators.js";
import {
  sendSuccess,
  sendNotFound,
  sendBadRequest,
} from "../../../utils/api-response.js";

export const scoreRoutes: FastifyPluginAsync = async (server) => {
  const prisma = await getPrisma();

  /**
   * POST /risk-scores/calculate
   * Calculate and store a risk score for a threat
   */
  server.post<{ Body: CalculateScoreInput }>(
    "/risk-scores/calculate",
    {
      config: { authz: { handler: "edit on the threat's model" } },
      schema: {
        tags: ["Risk Scoring"],
        summary: "Calculate risk score",
      },
    },
    async (request, reply) => {
      const user = getAuthUser(request);
      const body = CalculateScoreSchema.parse(request.body);

      const threat = await prisma.threat.findUnique({
        where: { id: body.threatId },
        include: {
          threatModel: {
            include: {
              project: { select: { organizationId: true } },
            },
          },
        },
      });
      if (!threat) {
        // Same 404 as an unreachable threat, so ids cannot be probed.
        return sendNotFound(reply, "Threat model");
      }
      // Scoring writes the threat: edit on its model (404 when unreachable).
      if (
        !(await authorizeModelAction(
          reply,
          user.id,
          threat.threatModelId,
          "edit",
        ))
      ) {
        return reply;
      }

      // A global framework, or one of the threat's own organization.
      const orgId = threat.threatModel.project.organizationId;
      const framework = await prisma.riskFramework.findUnique({
        where: { id: body.frameworkId },
      });
      if (
        !framework ||
        (framework.organizationId !== null &&
          framework.organizationId !== orgId)
      ) {
        return sendNotFound(reply, "Framework");
      }

      let score: number;
      let rating: string;

      switch (framework.type) {
        case "OWASP_RISK_RATING": {
          const owaspFactors = OWASPFactorsSchema.parse(body.factors);
          const result = calculateOWASPScore(owaspFactors);
          score = result.score;
          rating = result.rating;
          break;
        }
        case "DREAD": {
          const dreadFactors = DREADFactorsSchema.parse(body.factors);
          const result = calculateDREADScore(dreadFactors);
          score = result.score;
          rating = result.rating;
          break;
        }
        case "CUSTOM": {
          const customFactors = body.factors as Record<string, number>;
          const result = calculateCustomScore(customFactors);
          score = result.score;
          rating = result.rating;
          break;
        }
        default:
          return sendBadRequest(
            reply,
            `Unsupported framework type: ${framework.type}`,
          );
      }

      const riskScore = await prisma.threatRiskScore.upsert({
        where: {
          threatId_frameworkId: {
            threatId: body.threatId,
            frameworkId: body.frameworkId,
          },
        },
        update: {
          factors: JSON.stringify(body.factors),
          score,
          rating,
          calculatedAt: new Date(),
          calculatedById: user.id,
        },
        create: {
          threatId: body.threatId,
          frameworkId: body.frameworkId,
          factors: JSON.stringify(body.factors),
          score,
          rating,
          calculatedById: user.id,
        },
      });

      return sendSuccess(reply, {
        id: riskScore.id,
        threatId: riskScore.threatId,
        frameworkId: riskScore.frameworkId,
        frameworkName: framework.name,
        frameworkType: framework.type,
        factors: body.factors,
        score,
        rating,
        calculatedAt: riskScore.calculatedAt.toISOString(),
      });
    },
  );

  /**
   * GET /threats/:threatId/risk-scores
   * Get all risk scores for a threat
   */
  server.get<{ Params: { threatId: string } }>(
    "/threats/:threatId/risk-scores",
    {
      config: { authz: { handler: "view on the threat's model" } },
      schema: {
        tags: ["Risk Scoring"],
        summary: "Get threat risk scores",
      },
    },
    async (request, reply) => {
      const user = getAuthUser(request);
      const { threatId } = request.params;

      const threat = await prisma.threat.findUnique({
        where: { id: threatId },
        select: { threatModelId: true },
      });
      if (!threat) {
        // Same 404 as an unreachable threat, so ids cannot be probed.
        return sendNotFound(reply, "Threat model");
      }
      if (
        !(await authorizeModelAction(
          reply,
          user.id,
          threat.threatModelId,
          "view",
        ))
      ) {
        return reply;
      }

      const scores = await prisma.threatRiskScore.findMany({
        where: { threatId },
        include: { framework: { select: { name: true, type: true } } },
        orderBy: { calculatedAt: "desc" },
      });

      return sendSuccess(reply, {
        data: scores.map((s) => ({
          id: s.id,
          frameworkId: s.frameworkId,
          frameworkName: s.framework.name,
          frameworkType: s.framework.type,
          factors: JSON.parse(s.factors),
          score: s.score,
          rating: s.rating,
          calculatedAt: s.calculatedAt.toISOString(),
        })),
      });
    },
  );
};
