/**
 * Attack Surface Analysis API
 *
 * Provides endpoints for analyzing the attack surface of threat models.
 */

import type { FastifyInstance } from "fastify";
import { analyzeAttackSurface } from "../services/attack-surface/index.js";
import { loadMemberModel } from "./model-access.js";
import { sendSuccess } from "../utils/api-response.js";

export async function attackSurfaceRoutes(server: FastifyInstance) {
  /**
   * GET /api/attack-surface/:modelId
   *
   * Analyze the attack surface of a threat model.
   */
  server.get<{ Params: { modelId: string } }>(
    "/api/attack-surface/:modelId",
    {
      config: {
        authz: { handler: "ACTIVE member of the model's org (guests refused)" },
      },
      schema: {
        description: "Analyze attack surface of a threat model",
        tags: ["Attack Surface"],
        params: {
          type: "object",
          properties: {
            modelId: { type: "string", description: "Threat model ID" },
          },
          required: ["modelId"],
        },
      },
    },
    async (request, reply) => {
      const { modelId } = request.params;
      const user = request.authUser!;

      const access = await loadMemberModel(reply, modelId, user.id);
      if (access.denied) return access.denied;

      try {
        const analysis = await analyzeAttackSurface(modelId);
        return sendSuccess(reply, analysis);
      } catch (error) {
        request.log.error(
          { error, modelId },
          "Failed to analyze attack surface",
        );
        throw error;
      }
    },
  );

  /**
   * GET /api/attack-surface/:modelId/summary
   *
   * Get a quick summary of the attack surface.
   */
  server.get<{ Params: { modelId: string } }>(
    "/api/attack-surface/:modelId/summary",
    {
      config: {
        authz: { handler: "ACTIVE member of the model's org (guests refused)" },
      },
      schema: {
        description: "Get attack surface summary",
        tags: ["Attack Surface"],
        params: {
          type: "object",
          properties: {
            modelId: { type: "string" },
          },
          required: ["modelId"],
        },
      },
    },
    async (request, reply) => {
      const { modelId } = request.params;
      const user = request.authUser!;

      const access = await loadMemberModel(reply, modelId, user.id);
      if (access.denied) return access.denied;
      const { model } = access;

      const analysis = await analyzeAttackSurface(modelId);

      return sendSuccess(reply, {
        modelId,
        modelName: model.name,
        summary: analysis.summary,
        riskDistribution: analysis.riskDistribution,
      });
    },
  );

  /**
   * GET /api/attack-surface/:modelId/interfaces
   *
   * List all interfaces for a threat model.
   */
  server.get<{
    Params: { modelId: string };
    Querystring: { exposure?: string; minCvss?: string };
  }>(
    "/api/attack-surface/:modelId/interfaces",
    {
      config: {
        authz: { handler: "ACTIVE member of the model's org (guests refused)" },
      },
      schema: {
        description: "List attack surface interfaces",
        tags: ["Attack Surface"],
        params: {
          type: "object",
          properties: {
            modelId: { type: "string" },
          },
          required: ["modelId"],
        },
        querystring: {
          type: "object",
          properties: {
            exposure: {
              type: "string",
              description: "Filter by network exposure",
            },
            minCvss: { type: "string", description: "Minimum CVSS score" },
          },
        },
      },
    },
    async (request, reply) => {
      const { modelId } = request.params;
      const { exposure, minCvss } = request.query;
      const user = request.authUser!;

      const access = await loadMemberModel(reply, modelId, user.id);
      if (access.denied) return access.denied;

      const analysis = await analyzeAttackSurface(modelId);

      // Flatten interfaces from all components
      let interfaces = analysis.components.flatMap((c) => c.interfaces);

      // Apply filters
      if (exposure) {
        interfaces = interfaces.filter((i) => i.networkExposure === exposure);
      }
      if (minCvss) {
        const minScore = parseFloat(minCvss);
        interfaces = interfaces.filter((i) => (i.cvssBase || 0) >= minScore);
      }

      // Sort by CVSS score (highest first)
      interfaces.sort((a, b) => (b.cvssBase || 0) - (a.cvssBase || 0));

      return sendSuccess(reply, {
        total: interfaces.length,
        interfaces,
      });
    },
  );

  /**
   * GET /api/attack-surface/:modelId/high-risk
   *
   * Get high-risk interfaces (CVSS >= 7.0).
   */
  server.get<{ Params: { modelId: string } }>(
    "/api/attack-surface/:modelId/high-risk",
    {
      config: {
        authz: { handler: "ACTIVE member of the model's org (guests refused)" },
      },
      schema: {
        description: "Get high-risk interfaces",
        tags: ["Attack Surface"],
        params: {
          type: "object",
          properties: {
            modelId: { type: "string" },
          },
          required: ["modelId"],
        },
      },
    },
    async (request, reply) => {
      const { modelId } = request.params;
      const user = request.authUser!;

      const access = await loadMemberModel(reply, modelId, user.id);
      if (access.denied) return access.denied;

      const analysis = await analyzeAttackSurface(modelId);

      const highRiskInterfaces = analysis.components
        .flatMap((c) => c.interfaces)
        .filter((i) => (i.cvssBase || 0) >= 7.0)
        .sort((a, b) => (b.cvssBase || 0) - (a.cvssBase || 0));

      return sendSuccess(reply, {
        total: highRiskInterfaces.length,
        interfaces: highRiskInterfaces,
      });
    },
  );
}
