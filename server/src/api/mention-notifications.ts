/**
 * Mention Notification Helper
 *
 * Parses @Name patterns from a comment body, resolves matched org members,
 * and dispatches MENTION notifications via the notification service.
 * Fire-and-forget — errors are logged but never propagate to the caller.
 */
import { getPrisma } from "../db.js";
import { getNotificationService } from "../services/notifications/notification-service.js";
import logger from "../utils/logger.js";

export interface MentionDispatchOptions {
  body: string;
  modelId: string;
  actorId: string;
  actorName: string;
  /** Human-readable context describing where the mention happened. */
  context?: string;
  /** Optional override for the click-through link. */
  link?: string;
}

export async function dispatchMentionNotifications(
  opts: MentionDispatchOptions,
): Promise<void> {
  try {
    const prisma = await getPrisma();

    const model = await prisma.threatModel.findFirst({
      where: { id: opts.modelId, deletedAt: null },
      select: { project: { select: { organizationId: true } } },
    });
    if (!model) return;

    const members = await prisma.membership.findMany({
      where: { organizationId: model.project.organizationId, status: "ACTIVE" },
      select: { user: { select: { id: true, name: true } } },
    });

    const recipientIds = [
      ...new Set(
        members
          .filter((m) => {
            if (!m.user?.name) return false;
            const escaped = m.user.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            return new RegExp(`@${escaped}(?=\\s|$|[^A-Za-z])`, "i").test(
              opts.body,
            );
          })
          .map((m) => m.user!.id)
          .filter((id) => id !== opts.actorId),
      ),
    ];

    if (recipientIds.length === 0) return;

    const snippet =
      opts.body.length > 80 ? `${opts.body.slice(0, 80)}…` : opts.body;

    await getNotificationService().notify({
      type: "MENTION",
      category: "SYSTEM",
      priority: "NORMAL",
      recipientIds,
      actorId: opts.actorId,
      actorName: opts.actorName,
      modelId: opts.modelId,
      link: opts.link ?? `/models/${opts.modelId}`,
      data: {
        mentionerName: opts.actorName,
        context: opts.context ?? "a threat comment",
        snippet,
      },
    });
  } catch (err) {
    logger.error({ err }, "Failed to dispatch mention notifications");
  }
}
