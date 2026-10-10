/**
 * CI/CD API - Feedback Routes
 */
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { getPrisma } from "../../../db.js";
import { processScanFeedback } from "../../../services/ci-feedback/index.js";
import { isOrgAdmin, getAuthUser } from "../helpers.js";
import {
  sendSuccess,
  sendForbidden,
  sendNotFound,
  sendBadRequest,
  sendInternalError,
} from "../../../utils/api-response.js";
import { routeAuthz } from "../../../middleware/authz-policy.js";
import { checkTenantBaseUrl } from "../../../services/ai/private-host-policy.js";

const ORG_ADMIN = routeAuthz({ org: "ADMIN" });

const FeedbackConfigSchema = z.object({
  token: z.string().min(1),
  provider: z
    .enum(["GITHUB", "GITLAB", "BITBUCKET", "AZURE_DEVOPS"])
    .default("GITHUB"),
  baseUrl: z.string().url().optional(),
  postPRComment: z.boolean().default(true),
  createCheckRun: z.boolean().default(true),
  updateCommitStatus: z.boolean().default(false),
});

export const feedbackRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * POST /api/ci/scans/:scanId/feedback
   * Post scan results to GitHub/GitLab as PR comment or check run
   */
  fastify.post<{
    Params: { scanId: string };
    Querystring: { organizationId: string };
  }>("/api/ci/scans/:scanId/feedback", ORG_ADMIN, async (request, reply) => {
    const user = getAuthUser(request);
    const { scanId } = request.params;
    const { organizationId } = request.query;
    const prisma = await getPrisma();

    if (!(await isOrgAdmin(user.id, organizationId))) {
      return sendForbidden(reply, "Admin access required");
    }

    const parseResult = FeedbackConfigSchema.safeParse(request.body);
    if (!parseResult.success) {
      return sendBadRequest(reply, "Invalid configuration", {
        details: parseResult.error.issues,
      });
    }
    if (parseResult.data.baseUrl) {
      const urlError = await checkTenantBaseUrl(parseResult.data.baseUrl);
      if (urlError) return sendBadRequest(reply, urlError);
    }

    const scan = await prisma.cIScan.findUnique({
      where: { id: scanId },
      include: {
        threatModel: {
          include: { project: { select: { organizationId: true } } },
        },
      },
    });

    if (!scan || scan.threatModel.project.organizationId !== organizationId) {
      return sendNotFound(reply, "Scan");
    }

    try {
      const result = await processScanFeedback(scanId, parseResult.data);

      if (!result.success) {
        return sendInternalError(reply, result.error || "Feedback failed");
      }

      return sendSuccess(reply, {
        success: true,
        urls: result.urls,
        message: "Feedback posted successfully",
      });
    } catch (error) {
      return sendInternalError(
        reply,
        error instanceof Error ? error.message : "Unknown error",
      );
    }
  });
};
