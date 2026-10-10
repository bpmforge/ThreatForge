/**
 * Compliance Gap Analysis API
 *
 * Provides endpoints for analyzing threat models against compliance frameworks.
 */

import type { FastifyInstance } from "fastify";
import {
  analyzeCompliance,
  generateGapReport,
  compareFrameworks,
  getSupportedFrameworks,
  getFrameworkDisplayName,
  getFrameworkCategories,
} from "../services/compliance/index.js";
import type { ComplianceFramework } from "../services/compliance/types.js";
import { loadMemberModel } from "./model-access.js";
import {
  sendSuccess,
  sendNotFound,
  sendBadRequest,
} from "../utils/api-response.js";

export async function complianceRoutes(server: FastifyInstance) {
  /**
   * GET /api/compliance/frameworks
   *
   * List supported compliance frameworks.
   */
  server.get(
    "/api/compliance/frameworks",
    {
      config: { authz: "authenticated" },
      schema: {
        description: "List supported compliance frameworks",
        tags: ["Compliance"],
      },
    },
    async (_request, reply) => {
      const frameworks = getSupportedFrameworks();

      const data = frameworks.map((framework) => {
        const categories = getFrameworkCategories(framework);
        const controlCount = categories.reduce(
          (sum, cat) => sum + cat.controls.length,
          0,
        );

        return {
          id: framework,
          name: getFrameworkDisplayName(framework),
          categoryCount: categories.length,
          controlCount,
        };
      });

      return sendSuccess(reply, data);
    },
  );

  /**
   * GET /api/compliance/:modelId/:framework
   *
   * Analyze a threat model against a compliance framework.
   */
  server.get<{ Params: { modelId: string; framework: string } }>(
    "/api/compliance/:modelId/:framework",
    {
      config: {
        authz: { handler: "ACTIVE member of the model's org (guests refused)" },
      },
      schema: {
        description: "Analyze threat model compliance",
        tags: ["Compliance"],
        params: {
          type: "object",
          properties: {
            modelId: { type: "string", description: "Threat model ID" },
            framework: { type: "string", description: "Compliance framework" },
          },
          required: ["modelId", "framework"],
        },
      },
    },
    async (request, reply) => {
      const { modelId, framework } = request.params;
      const user = request.authUser!;

      // Validate framework
      const supportedFrameworks = getSupportedFrameworks();
      if (!supportedFrameworks.includes(framework as ComplianceFramework)) {
        return sendBadRequest(
          reply,
          `Unsupported framework. Supported: ${supportedFrameworks.join(", ")}`,
        );
      }

      const access = await loadMemberModel(reply, modelId, user.id);
      if (access.denied) return access.denied;

      try {
        const analysis = await analyzeCompliance(
          modelId,
          framework as ComplianceFramework,
        );
        return sendSuccess(reply, analysis);
      } catch (error) {
        request.log.error(
          { error, modelId, framework },
          "Failed to analyze compliance",
        );
        throw error;
      }
    },
  );

  /**
   * GET /api/compliance/:modelId/:framework/report
   *
   * Generate a gap report for export.
   */
  server.get<{ Params: { modelId: string; framework: string } }>(
    "/api/compliance/:modelId/:framework/report",
    {
      config: {
        authz: { handler: "ACTIVE member of the model's org (guests refused)" },
      },
      schema: {
        description: "Generate compliance gap report",
        tags: ["Compliance"],
        params: {
          type: "object",
          properties: {
            modelId: { type: "string" },
            framework: { type: "string" },
          },
          required: ["modelId", "framework"],
        },
      },
    },
    async (request, reply) => {
      const { modelId, framework } = request.params;
      const user = request.authUser!;

      // Validate framework
      const supportedFrameworks = getSupportedFrameworks();
      if (!supportedFrameworks.includes(framework as ComplianceFramework)) {
        return sendBadRequest(
          reply,
          `Unsupported framework. Supported: ${supportedFrameworks.join(", ")}`,
        );
      }

      const access = await loadMemberModel(reply, modelId, user.id);
      if (access.denied) return access.denied;

      const report = await generateGapReport(
        modelId,
        framework as ComplianceFramework,
      );
      return sendSuccess(reply, report);
    },
  );

  /**
   * GET /api/compliance/:modelId/compare
   *
   * Compare compliance across multiple frameworks.
   */
  server.get<{
    Params: { modelId: string };
    Querystring: { frameworks?: string };
  }>(
    "/api/compliance/:modelId/compare",
    {
      config: {
        authz: { handler: "ACTIVE member of the model's org (guests refused)" },
      },
      schema: {
        description: "Compare compliance across frameworks",
        tags: ["Compliance"],
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
            frameworks: {
              type: "string",
              description: "Comma-separated list of frameworks",
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { modelId } = request.params;
      const { frameworks: frameworksParam } = request.query;
      const user = request.authUser!;

      const access = await loadMemberModel(reply, modelId, user.id);
      if (access.denied) return access.denied;
      const { model } = access;

      // Parse frameworks or use all supported
      let frameworks: ComplianceFramework[];
      if (frameworksParam) {
        frameworks = frameworksParam.split(",") as ComplianceFramework[];
      } else {
        frameworks = getSupportedFrameworks();
      }

      const comparison = await compareFrameworks(modelId, frameworks);

      return sendSuccess(reply, {
        modelId,
        modelName: model.name,
        comparison: comparison.map((c) => ({
          ...c,
          frameworkName: getFrameworkDisplayName(c.framework),
        })),
      });
    },
  );

  /**
   * GET /api/compliance/:modelId/:framework/category/:categoryId
   *
   * Get detailed assessment for a specific category.
   */
  server.get<{
    Params: { modelId: string; framework: string; categoryId: string };
  }>(
    "/api/compliance/:modelId/:framework/category/:categoryId",
    {
      config: {
        authz: { handler: "ACTIVE member of the model's org (guests refused)" },
      },
      schema: {
        description: "Get category compliance details",
        tags: ["Compliance"],
        params: {
          type: "object",
          properties: {
            modelId: { type: "string" },
            framework: { type: "string" },
            categoryId: { type: "string" },
          },
          required: ["modelId", "framework", "categoryId"],
        },
      },
    },
    async (request, reply) => {
      const { modelId, framework, categoryId } = request.params;
      const user = request.authUser!;

      // Validate framework
      const supportedFrameworks = getSupportedFrameworks();
      if (!supportedFrameworks.includes(framework as ComplianceFramework)) {
        return sendBadRequest(reply, "Unsupported framework");
      }

      const access = await loadMemberModel(reply, modelId, user.id);
      if (access.denied) return access.denied;

      const analysis = await analyzeCompliance(
        modelId,
        framework as ComplianceFramework,
      );

      const category = analysis.categories.find(
        (c) => c.category.id === categoryId,
      );

      if (!category) {
        return sendNotFound(reply, "Category");
      }

      return sendSuccess(reply, category);
    },
  );
}
