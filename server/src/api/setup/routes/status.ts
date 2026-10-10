/**
 * Setup status route
 *
 * Check if the system has been set up.
 */
import type { FastifyPluginAsync } from "fastify";
import { getPrisma } from "../../../db.js";
import { sendSuccess } from "../../../utils/api-response.js";
import { routeAuthz } from "../../../middleware/authz-policy.js";
import { SETUP_TOKEN_REQUIRED } from "../index.js";

const SETUP_STATUS = routeAuthz({
  public: "setup booleans only, no tenant data",
});

/** Setup status response type */
interface SetupStatusResponse {
  setupComplete: boolean;
  hasUsers: boolean;
  hasSuperAdmin: boolean;
  /** The wizard must send X-Setup-Token (production installs). */
  setupTokenRequired: boolean;
}

export const setupStatusRoutes: FastifyPluginAsync = async (server) => {
  /**
   * GET /api/setup/status
   * Check if the system has been set up.
   * PUBLIC - no authentication required.
   */
  server.get("/api/setup/status", SETUP_STATUS, async (_request, reply) => {
    const prisma = await getPrisma();

    // Check if setup has been completed
    const settings = await prisma.systemSettings.findUnique({
      where: { id: "default" },
      select: { setupComplete: true },
    });

    // Check if any users exist
    const userCount = await prisma.user.count();

    // Check if there's a super admin
    const superAdminCount = await prisma.user.count({
      where: { isSuperAdmin: true },
    });

    const response: SetupStatusResponse = {
      setupComplete: settings?.setupComplete ?? false,
      hasUsers: userCount > 0,
      hasSuperAdmin: superAdminCount > 0,
      setupTokenRequired: SETUP_TOKEN_REQUIRED,
    };

    return sendSuccess(reply, response);
  });
};
