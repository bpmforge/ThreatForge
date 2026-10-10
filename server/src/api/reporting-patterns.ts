/**
 * Reporting Systemic Patterns Handler
 *
 * Org-scoped view of threats that recur across many models in a portfolio.
 */

import type { FastifyReply, FastifyRequest, FastifySchema } from "fastify";
import { checkOrganizationAccess } from "../services/access-control/access-control-service.js";
import { getSystemicPatterns } from "../services/risk/systemic-patterns.js";
import { getAuthUser } from "../utils/auth-helpers.js";
import {
  sendSuccess,
  sendBadRequest,
  sendForbidden,
} from "../utils/api-response.js";

export const systemicPatternsSchema: FastifySchema = {
  description: "Recurring threat patterns across all models in an organization",
  tags: ["Reporting"],
  params: {
    type: "object",
    properties: { orgId: { type: "string", description: "Organization ID" } },
    required: ["orgId"],
  },
  querystring: {
    type: "object",
    properties: {
      minModels: {
        type: "string",
        description: "Minimum number of models a pattern must appear in (>=2)",
      },
    },
  },
};

export async function getSystemicPatternsHandler(
  request: FastifyRequest<{
    Params: { orgId: string };
    Querystring: { minModels?: string };
  }>,
  reply: FastifyReply,
) {
  const user = await getAuthUser(request);
  const { orgId } = request.params;

  let minModels = 2;
  if (request.query.minModels !== undefined) {
    minModels = Number(request.query.minModels);
    if (!Number.isInteger(minModels) || minModels < 2 || minModels > 1000) {
      return sendBadRequest(reply, "minModels must be an integer >= 2");
    }
  }

  // Active membership of THIS organization — never trust the :orgId alone.
  const access = await checkOrganizationAccess(user.id, orgId);
  if (!access.hasAccess) {
    return sendForbidden(reply, "Access denied to this organization");
  }

  const result = await getSystemicPatterns(orgId, minModels);
  return sendSuccess(reply, result);
}
