/**
 * Reporting Model Handlers
 *
 * Model executive summary and PDF-data endpoints.
 */

import type { FastifyReply, FastifyRequest, FastifySchema } from "fastify";
import { getModelExecutiveSummary } from "../services/reporting/index.js";
import type { ComplianceFramework } from "../services/compliance/types.js";
import { getPrisma } from "../db.js";
import {
  checkModelAccess,
  loadMemberModel,
  memberProjectInclude,
} from "./model-access.js";
import { sendSuccess } from "../utils/api-response.js";

export const modelSummarySchema: FastifySchema = {
  description: "Get model executive summary",
  tags: ["Reporting"],
  params: {
    type: "object",
    properties: {
      modelId: { type: "string", description: "Threat model ID" },
    },
    required: ["modelId"],
  },
  querystring: {
    type: "object",
    properties: {
      frameworks: {
        type: "string",
        description: "Comma-separated compliance frameworks",
      },
    },
  },
};

export async function getModelSummaryHandler(
  request: FastifyRequest<{
    Params: { modelId: string };
    Querystring: { frameworks?: string };
  }>,
  reply: FastifyReply,
) {
  const { modelId } = request.params;
  const { frameworks: frameworksParam } = request.query;
  const user = request.authUser!;

  const access = await loadMemberModel(reply, modelId, user.id);
  if (access.denied) return access.denied;

  // Parse frameworks
  let frameworks: ComplianceFramework[] | undefined;
  if (frameworksParam) {
    frameworks = frameworksParam.split(",") as ComplianceFramework[];
  }

  const summary = await getModelExecutiveSummary(modelId, frameworks);
  return sendSuccess(reply, summary);
}

export const modelPdfSchema: FastifySchema = {
  description: "Generate PDF report",
  tags: ["Reporting"],
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
      includeCompliance: { type: "string" },
      includeThreats: { type: "string" },
      includeMitigations: { type: "string" },
      frameworks: { type: "string" },
    },
  },
};

export async function getModelPdfHandler(
  request: FastifyRequest<{
    Params: { modelId: string };
    Querystring: {
      includeCompliance?: string;
      includeThreats?: string;
      includeMitigations?: string;
      frameworks?: string;
    };
  }>,
  reply: FastifyReply,
) {
  const { modelId } = request.params;
  const user = request.authUser!;

  // Verify access
  const prisma = await getPrisma();
  const found = await prisma.threatModel.findUnique({
    where: { id: modelId },
    include: {
      project: memberProjectInclude(user.id),
      threats: {
        include: {
          mitigations: true,
        },
      },
    },
  });

  const access = checkModelAccess(reply, found);
  if (access.denied) return access.denied;
  const { model } = access;

  // Get executive summary for PDF
  const summary = await getModelExecutiveSummary(modelId);

  // Return JSON data that the frontend can use to generate PDF
  // Full PDF generation would require a library like puppeteer or pdfmake
  return sendSuccess(reply, {
    type: "pdf-data",
    model: {
      id: model.id,
      name: model.name,
      projectName: model.project.name,
      organizationName: model.project.organization.name,
      createdAt: model.createdAt,
      updatedAt: model.updatedAt,
    },
    summary,
    threats: model.threats.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      severity: t.severity,
      status: t.status,
      strideCategories: (() => {
        try {
          return JSON.parse(t.strideCategories || "[]");
        } catch {
          return [];
        }
      })(),
      mitigations: t.mitigations.map((m) => ({
        id: m.id,
        description: m.description,
        status: m.status,
        priority: m.priority,
        strategy: m.strategy,
      })),
    })),
    generatedAt: new Date().toISOString(),
  });
}
