/**
 * In-app notification store operations.
 *
 * Read/list/mark/delete queries plus per-user statistics against the
 * Notification table. Leaf module — no imports from other notification
 * submodules.
 */
import { getPrisma } from "../../db.js";
import type {
  NotificationCategory,
  NotificationPriority,
  InAppNotification,
  NotificationStats,
} from "./types.js";

type NotificationRow = {
  id: string;
  userId: string;
  type: string;
  category: string;
  priority: string;
  title: string;
  message: string;
  link: string | null;
  metadata: string | null;
  isRead: boolean;
  readAt: Date | null;
  createdAt: Date;
};

function toInApp(n: NotificationRow): InAppNotification {
  return {
    id: n.id,
    userId: n.userId,
    type: n.type as InAppNotification["type"],
    category: n.category as NotificationCategory,
    priority: n.priority as NotificationPriority,
    title: n.title,
    message: n.message,
    link: n.link || undefined,
    metadata: n.metadata ? JSON.parse(n.metadata) : undefined,
    isRead: n.isRead,
    readAt: n.readAt || undefined,
    createdAt: n.createdAt,
  };
}

/** Get unread notifications for a user */
export async function getUnreadNotifications(
  userId: string,
  limit = 50,
): Promise<InAppNotification[]> {
  const prisma = await getPrisma();

  const notifications = await prisma.notification.findMany({
    where: {
      userId,
      isRead: false,
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return notifications.map(toInApp);
}

/** Get all notifications for a user with pagination */
export async function getNotifications(
  userId: string,
  options: { offset?: number; limit?: number; unreadOnly?: boolean } = {},
): Promise<{ notifications: InAppNotification[]; total: number }> {
  const prisma = await getPrisma();
  const { offset = 0, limit = 20, unreadOnly = false } = options;

  const where = {
    userId,
    ...(unreadOnly ? { isRead: false } : {}),
  };

  const [notifications, total] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: offset,
      take: limit,
    }),
    prisma.notification.count({ where }),
  ]);

  return {
    notifications: notifications.map(toInApp),
    total,
  };
}

/** Mark notification as read */
export async function markAsRead(
  notificationId: string,
  userId: string,
): Promise<void> {
  const prisma = await getPrisma();

  await prisma.notification.updateMany({
    where: {
      id: notificationId,
      userId,
    },
    data: {
      isRead: true,
      readAt: new Date(),
    },
  });
}

/** Mark all notifications as read */
export async function markAllAsRead(userId: string): Promise<number> {
  const prisma = await getPrisma();

  const result = await prisma.notification.updateMany({
    where: {
      userId,
      isRead: false,
    },
    data: {
      isRead: true,
      readAt: new Date(),
    },
  });

  return result.count;
}

/** Delete a notification */
export async function deleteNotification(
  notificationId: string,
  userId: string,
): Promise<void> {
  const prisma = await getPrisma();

  await prisma.notification.deleteMany({
    where: {
      id: notificationId,
      userId,
    },
  });
}

/** Get notification statistics */
export async function getStats(userId: string): Promise<NotificationStats> {
  const prisma = await getPrisma();

  const [total, unread, byCategory, byPriority] = await Promise.all([
    prisma.notification.count({ where: { userId } }),
    prisma.notification.count({ where: { userId, isRead: false } }),
    prisma.notification.groupBy({
      by: ["category"],
      where: { userId, isRead: false },
      _count: true,
    }),
    prisma.notification.groupBy({
      by: ["priority"],
      where: { userId, isRead: false },
      _count: true,
    }),
  ]);

  const categoryMap: Record<NotificationCategory, number> = {
    THREAT: 0,
    MITIGATION: 0,
    MODEL: 0,
    PROJECT: 0,
    ORGANIZATION: 0,
    SECURITY: 0,
    SYSTEM: 0,
  };

  for (const item of byCategory) {
    categoryMap[item.category as NotificationCategory] = item._count;
  }

  const priorityMap: Record<NotificationPriority, number> = {
    LOW: 0,
    NORMAL: 0,
    HIGH: 0,
    URGENT: 0,
  };

  for (const item of byPriority) {
    priorityMap[item.priority as NotificationPriority] = item._count;
  }

  return {
    total,
    unread,
    byCategory: categoryMap,
    byPriority: priorityMap,
  };
}
