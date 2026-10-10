/**
 * User Preferences Routes
 *
 * GET and PATCH user preferences.
 */
import type { FastifyPluginAsync } from "fastify";
import { getPrisma } from "../../../db.js";
import {
  UserPreferences,
  DEFAULT_USER_PREFERENCES,
} from "../../../types/settings.js";
import { sendSuccess, sendNotFound } from "../../../utils/api-response.js";
import { getAuthUser } from "../../../utils/auth-helpers.js";
import { routeAuthz } from "../../../middleware/authz-policy.js";

const AUTHENTICATED = routeAuthz("authenticated");

export const preferencesRoutes: FastifyPluginAsync = async (server) => {
  /** Get user preferences */
  server.get<{ Params: { userId: string } }>(
    "/api/users/:userId/preferences",
    AUTHENTICATED,
    async (request, reply) => {
      const authUser = getAuthUser(request);
      const prisma = await getPrisma();
      const { userId } = request.params;

      // Users can only access their own preferences
      if (authUser.id !== userId) {
        return sendNotFound(reply, "User");
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { preferences: true },
      });

      if (!user) {
        return sendNotFound(reply, "User");
      }

      const preferences: UserPreferences = user.preferences
        ? JSON.parse(user.preferences)
        : DEFAULT_USER_PREFERENCES;

      return sendSuccess(reply, preferences);
    },
  );

  /** Update user preferences */
  server.patch<{ Params: { userId: string }; Body: Partial<UserPreferences> }>(
    "/api/users/:userId/preferences",
    AUTHENTICATED,
    async (request, reply) => {
      const authUser = getAuthUser(request);
      const prisma = await getPrisma();
      const { userId } = request.params;
      const updates = request.body;

      // Users can only update their own preferences
      if (authUser.id !== userId) {
        return sendNotFound(reply, "User");
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { preferences: true },
      });

      if (!user) {
        return sendNotFound(reply, "User");
      }

      const currentPrefs: UserPreferences = user.preferences
        ? JSON.parse(user.preferences)
        : DEFAULT_USER_PREFERENCES;

      const newPrefs: UserPreferences = {
        ...currentPrefs,
        ...updates,
        ai: {
          ...currentPrefs.ai,
          ...(updates.ai || {}),
        },
        canvas: {
          ...currentPrefs.canvas,
          ...(updates.canvas || {}),
        },
      };

      await prisma.user.update({
        where: { id: userId },
        data: { preferences: JSON.stringify(newPrefs) },
      });

      return sendSuccess(reply, newPrefs);
    },
  );
};
