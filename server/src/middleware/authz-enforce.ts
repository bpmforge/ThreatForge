/**
 * Enforce declared route authz policies.
 *
 * Runs after `authenticate` on every protected route and enforces the
 * route's `config.authz` (see authz-policy.ts) when it is `{ org }`,
 * `{ model }` or `"superAdmin"`. `"authenticated"`, `{ handler }` and
 * `{ public }` are left to the handler. Handlers keep their own checks; this
 * hook can only add a refusal, so a declaration must never be stricter than
 * what the handler allows.
 *
 * Refusals carry `code: AUTHZ_POLICY_ERROR_CODE` so tests can tell them from
 * handler refusals. A declared policy whose target id cannot be found fails
 * closed with `AUTHZ_TARGET_ERROR_CODE`: that is a declaration bug.
 */
import type { FastifyReply, FastifyRequest } from "fastify";
import { getPrisma } from "../db.js";
import {
  canPerformAction,
  requireOrgRole,
} from "../services/access-control/access-control-service.js";
import { errorResponse } from "../utils/api-response.js";
import type { AuthzPolicy } from "./authz-policy.js";

export const AUTHZ_POLICY_ERROR_CODE = "AUTHZ_POLICY";
export const AUTHZ_TARGET_ERROR_CODE = "AUTHZ_POLICY_TARGET";

type Bag = Record<string, unknown> | undefined;

function pick(sources: Bag[], keys: string[]): string | undefined {
  for (const source of sources) {
    for (const key of keys) {
      const value = source?.[key];
      if (typeof value === "string" && value.length > 0) return value;
    }
  }
  return undefined;
}

/**
 * The id a policy addresses: route params first, then `:id` when the route
 * names that collection, then query string, then JSON body.
 */
export function resolveAuthzTarget(
  kind: "org" | "model",
  routeUrl: string,
  params: Bag,
  query: Bag,
  body: Bag,
): string | undefined {
  const keys =
    kind === "org" ? ["orgId", "organizationId"] : ["modelId", "threatModelId"];
  const idCollection =
    kind === "org" ? "/organizations/:id" : "/threat-models/:id";
  const fromParams = pick([params], keys);
  if (fromParams) return fromParams;
  if (routeUrl.includes(idCollection)) {
    const id = pick([params], ["id"]);
    if (id) return id;
  }
  return pick([query, body], keys);
}

function deny(
  reply: FastifyReply,
  status: 403 | 404,
  message: string,
  code = AUTHZ_POLICY_ERROR_CODE,
) {
  return reply
    .status(status)
    .send(errorResponse(message, code, undefined, reply.request.id));
}

export async function enforceDeclaredAuthz(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const user = request.authUser;
  if (!user) return;
  const policy = request.routeOptions.config?.authz as AuthzPolicy | undefined;
  if (!policy || policy === "authenticated") return;

  if (policy === "superAdmin") {
    const prisma = await getPrisma();
    const row = await prisma.user.findUnique({
      where: { id: user.id },
      select: { isSuperAdmin: true },
    });
    if (!row?.isSuperAdmin) return deny(reply, 403, "Super admin required");
    return;
  }

  if (!("org" in policy) && !("model" in policy)) return;
  const kind = "org" in policy ? "org" : "model";

  const target = resolveAuthzTarget(
    kind,
    request.routeOptions.url ?? "",
    request.params as Bag,
    request.query as Bag,
    request.body as Bag,
  );
  if (!target) {
    request.log.error(
      { route: request.routeOptions.url, policy },
      "authz policy target not found in request",
    );
    return deny(reply, 403, "Access denied", AUTHZ_TARGET_ERROR_CODE);
  }

  if ("org" in policy) {
    const result = await requireOrgRole(user.id, target, policy.org);
    if (!result.allowed) {
      return result.role
        ? deny(reply, 403, result.error ?? "Access denied")
        : deny(reply, 404, "Organization not found");
    }
    return;
  }

  const result = await canPerformAction(user.id, target, policy.model);
  if (!result.allowed) {
    return result.access
      ? deny(reply, 403, result.error ?? "Access denied")
      : deny(reply, 404, "Threat model not found");
  }
}
