/**
 * Sign out everywhere.
 *
 * Sessions are stateless JWTs, so the only honest control is a cutoff time:
 * every token issued before `sessionsRevokedAt` stops working (checked in the
 * NextAuth jwt callback and in middleware/auth.ts).
 */
import type { FastifyPluginAsync } from "fastify";
import { getPrisma } from "../db.js";
import { getAuthUser } from "../utils/auth-helpers.js";
import { sendSuccess } from "../utils/api-response.js";
import { routeAuthz } from "../middleware/authz-policy.js";
import { invalidateSessionCache } from "../middleware/auth.js";

/** Only touches the caller's own user row. */
const AUTHENTICATED = routeAuthz("authenticated");

export const sessionRoutes: FastifyPluginAsync = async (server) => {
  server.post(
    "/api/users/me/sessions/revoke-all",
    AUTHENTICATED,
    async (request, reply) => {
      const authUser = getAuthUser(request);
      const prisma = await getPrisma();

      await prisma.user.update({
        where: { id: authUser.id },
        data: { sessionsRevokedAt: new Date() },
      });
      await invalidateSessionCache(authUser.id);

      return sendSuccess(reply, { message: "Signed out everywhere" });
    },
  );
};
