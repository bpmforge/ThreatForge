/**
 * Executive Reporting API
 *
 * Provides endpoints for dashboards and executive summaries.
 */

import type { FastifyInstance } from "fastify";
import { authenticate } from "../middleware/auth.js";
import {
  organizationDashboardSchema,
  getOrganizationDashboardHandler,
  projectDashboardSchema,
  getProjectDashboardHandler,
  trendsSchema,
  getTrendsHandler,
} from "./reporting-dashboards.js";
import {
  modelSummarySchema,
  getModelSummaryHandler,
  modelPdfSchema,
  getModelPdfHandler,
} from "./reporting-model.js";
import {
  listTemplatesHandler,
  generateReportHandler,
} from "./reporting-generate.js";
import { compareModelsHandler } from "./reporting-compare.js";
import {
  systemicPatternsSchema,
  getSystemicPatternsHandler,
} from "./reporting-patterns.js";
import type { AuthzPolicy } from "../middleware/authz-policy.js";

/** Reporting reads its own membership include; guests are not members. */
const MODEL_MEMBER: AuthzPolicy = {
  handler: "ACTIVE member of the model's org (guests refused)",
};
const PROJECT_MEMBER: AuthzPolicy = {
  handler: "ACTIVE member of the project's org",
};

export async function reportingRoutes(server: FastifyInstance) {
  // GET /api/reporting/organization/:orgId — organization-wide dashboard.
  server.get<{
    Params: { orgId: string };
    Querystring: { period?: string };
  }>(
    "/api/reporting/organization/:orgId",
    {
      config: { authz: { org: "VIEWER" } },
      schema: organizationDashboardSchema,
    },
    getOrganizationDashboardHandler,
  );

  // GET /api/reporting/project/:projectId — project-level dashboard.
  server.get<{
    Params: { projectId: string };
    Querystring: { period?: string };
  }>(
    "/api/reporting/project/:projectId",
    { config: { authz: PROJECT_MEMBER }, schema: projectDashboardSchema },
    getProjectDashboardHandler,
  );

  // GET /api/reporting/model/:modelId — model executive summary.
  server.get<{
    Params: { modelId: string };
    Querystring: { frameworks?: string };
  }>(
    "/api/reporting/model/:modelId",
    { config: { authz: MODEL_MEMBER }, schema: modelSummarySchema },
    getModelSummaryHandler,
  );

  // GET /api/reporting/model/:modelId/pdf — generate PDF report for a model.
  server.get<{
    Params: { modelId: string };
    Querystring: {
      includeCompliance?: string;
      includeThreats?: string;
      includeMitigations?: string;
      frameworks?: string;
    };
  }>(
    "/api/reporting/model/:modelId/pdf",
    { config: { authz: MODEL_MEMBER }, schema: modelPdfSchema },
    getModelPdfHandler,
  );

  // GET /api/reporting/trends/:orgId — trend data for charts.
  server.get<{
    Params: { orgId: string };
    Querystring: { period?: string };
  }>(
    "/api/reporting/trends/:orgId",
    { config: { authz: { org: "VIEWER" } }, schema: trendsSchema },
    getTrendsHandler,
  );

  // GET /api/reporting/templates — list available report templates.
  server.get(
    "/api/reporting/templates",
    { config: { authz: "authenticated" } },
    listTemplatesHandler,
  );

  // POST /api/reporting/model/:modelId/generate — report from a built-in template.
  server.post<{
    Params: { modelId: string };
    Body: { templateId?: string };
  }>(
    "/api/reporting/model/:modelId/generate",
    { config: { authz: MODEL_MEMBER } },
    generateReportHandler,
  );

  // POST /api/reporting/compare — compare risk metrics across threat models.
  server.post<{ Body: { modelIds: string[] } }>(
    "/api/reporting/compare",
    {
      config: {
        authz: { handler: "only models of the caller's ACTIVE memberships" },
      },
      preHandler: authenticate,
    },
    compareModelsHandler,
  );

  // GET /api/reporting/patterns/:orgId — recurring threat patterns across the org's models.
  server.get<{
    Params: { orgId: string };
    Querystring: { minModels?: string };
  }>(
    "/api/reporting/patterns/:orgId",
    {
      preHandler: authenticate,
      schema: systemicPatternsSchema,
      config: { authz: { org: "VIEWER" } },
    },
    getSystemicPatternsHandler,
  );
}
