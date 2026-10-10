/**
 * Decides whether a WebSocket token may join a model's collaboration session,
 * and whether it may write. Mirrors the HTTP auth checks in middleware/auth.ts.
 */
import { getPrisma } from "../db.js";
import {
  SESSION_STATUSES,
  issuedBeforePasswordChange,
  type JWTPayload,
} from "../middleware/auth.js";
import { isReadOnlyUser } from "../middleware/read-only-guard.js";
import {
  canAccessThreatModel,
  canEditThreatModel,
} from "../api/threat-models/helpers.js";

export type CollaborationAccess =
  | { ok: true; receiveOnly: boolean }
  | { ok: false; code: 4001 | 4003; reason: string };

export async function resolveCollaborationAccess(
  payload: JWTPayload,
  modelId: string,
): Promise<CollaborationAccess> {
  if (payload.type !== "access") {
    return { ok: false, code: 4001, reason: "Authentication failed" };
  }

  const prisma = await getPrisma();
  const user = await prisma.user.findUnique({
    where: { id: payload.id },
    select: {
      email: true,
      status: true,
      passwordChangedAt: true,
      sessionsRevokedAt: true,
    },
  });
  if (
    !user ||
    !SESSION_STATUSES.has(user.status) ||
    issuedBeforePasswordChange(
      payload.iat,
      user.passwordChangedAt,
      user.sessionsRevokedAt,
    )
  ) {
    return { ok: false, code: 4001, reason: "Authentication failed" };
  }

  if (!(await canAccessThreatModel(payload.id, modelId))) {
    return { ok: false, code: 4003, reason: "Access denied" };
  }

  // Viewers and read-only accounts get the live canvas but cannot change it.
  const canEdit = await canEditThreatModel(payload.id, modelId);
  return { ok: true, receiveOnly: isReadOnlyUser(user.email) || !canEdit };
}
