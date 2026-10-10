/**
 * Route options for synchronous AI routes (those that call the provider in
 * the request itself): the AI rate limit, keyed per organization, and the
 * org's monthly spend cap, the same check the queued-job path runs.
 */
import type { FastifyReply, FastifyRequest } from "fastify";
import { getPrisma } from "../../db.js";
import { getAiRateLimit } from "../../middleware/rate-limit.js";
import type { AuthzPolicy } from "../../middleware/authz-policy.js";
import { replyIfOverSpendCap } from "../../services/ai/spend-guard.js";
import { aiOrgForRequest } from "./ai-org.js";

/** Organization the request spends from, or null when it cannot be told. */
async function orgIdForRequest(
  request: FastifyRequest,
): Promise<string | null> {
  const params = (request.params ?? {}) as Record<string, unknown>;
  if (typeof params.orgId === "string") return params.orgId;

  // Only the route param: authz has already checked the caller may use it.
  const modelId = typeof params.modelId === "string" ? params.modelId : null;
  if (modelId) {
    const prisma = await getPrisma();
    const model = await prisma.threatModel.findUnique({
      where: { id: modelId },
      select: { project: { select: { organizationId: true } } },
    });
    return model?.project?.organizationId ?? null;
  }

  if (request.authUser) {
    return (await aiOrgForRequest(request.authUser.id, request))?.id ?? null;
  }
  return null;
}

async function aiRateLimitKey(request: FastifyRequest): Promise<string> {
  try {
    const orgId = await orgIdForRequest(request);
    if (orgId) return `ai:org:${orgId}`;
  } catch {
    // Fall through to the per-user bucket.
  }
  return request.authUser
    ? `ai:user:${request.authUser.id}`
    : `ai:ip:${request.ip}`;
}

/** Sends 429 when the caller's org has reached its monthly AI spend cap. */
async function aiSpendGuard(request: FastifyRequest, reply: FastifyReply) {
  const orgId = await orgIdForRequest(request);
  if (!orgId) return; // the handler reports the missing model or org
  if (await replyIfOverSpendCap(reply, await getPrisma(), orgId)) return reply;
}

/** Route options: the authz declaration plus the AI rate limit. */
export function aiRateLimited(authz: AuthzPolicy) {
  return { config: { authz, ...getAiRateLimit(aiRateLimitKey).config } };
}

/** Route options: the AI rate limit plus the org's monthly spend cap. */
export function aiGuarded(authz: AuthzPolicy) {
  return { ...aiRateLimited(authz), preHandler: aiSpendGuard };
}
