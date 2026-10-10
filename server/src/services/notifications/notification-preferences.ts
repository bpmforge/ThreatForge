/**
 * Notification preferences.
 *
 * Default preferences, per-user read/update, and channel resolution for a
 * given event. Leaf module — no imports from other notification submodules.
 */
import { getPrisma } from "../../db.js";
import type {
  NotificationChannel,
  NotificationCategory,
  NotificationPreferences,
} from "./types.js";

// Default notification preferences
const DEFAULT_PREFERENCES: NotificationPreferences = {
  channels: {
    THREAT: ["IN_APP", "EMAIL"],
    MITIGATION: ["IN_APP"],
    MODEL: ["IN_APP"],
    PROJECT: ["IN_APP"],
    ORGANIZATION: ["IN_APP", "EMAIL"],
    SECURITY: ["IN_APP", "EMAIL"],
    SYSTEM: ["IN_APP"],
  },
  email: {
    enabled: true,
    digestFrequency: "REALTIME",
  },
};

/** Get user notification preferences */
export async function getUserPreferences(
  userId: string,
): Promise<NotificationPreferences> {
  const prisma = await getPrisma();

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { preferences: true },
  });

  if (!user?.preferences) {
    return DEFAULT_PREFERENCES;
  }

  try {
    const prefs = JSON.parse(user.preferences) as {
      notifications?: NotificationPreferences;
    };
    return prefs.notifications || DEFAULT_PREFERENCES;
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

/** Update user notification preferences */
export async function updateUserPreferences(
  userId: string,
  preferences: Partial<NotificationPreferences>,
): Promise<NotificationPreferences> {
  const prisma = await getPrisma();

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { preferences: true },
  });

  const currentPrefs = user?.preferences ? JSON.parse(user.preferences) : {};
  const updatedNotificationPrefs = {
    ...DEFAULT_PREFERENCES,
    ...(currentPrefs.notifications || {}),
    ...preferences,
  };

  await prisma.user.update({
    where: { id: userId },
    data: {
      preferences: JSON.stringify({
        ...currentPrefs,
        notifications: updatedNotificationPrefs,
      }),
    },
  });

  return updatedNotificationPrefs;
}

/** Get channels for a notification event */
export function getChannelsForEvent(
  category: NotificationCategory,
  type: string,
  prefs: NotificationPreferences,
): NotificationChannel[] {
  // Check event-specific override
  const override =
    prefs.eventOverrides?.[type as keyof typeof prefs.eventOverrides];
  if (override) {
    if (!override.enabled) return [];
    if (override.channels) return override.channels;
  }

  // Fall back to category-level settings
  return prefs.channels[category] || ["IN_APP"];
}
