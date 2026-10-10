/**
 * Invitations API - Modular Entry Point
 *
 * Organization invitation management: create, accept, decline, revoke.
 * All routes require authentication.
 */
import type { FastifyPluginAsync } from "fastify";
import { crudRoutes } from "./routes/crud.js";
import { actionRoutes } from "./routes/actions.js";

export const invitationRoutes: FastifyPluginAsync = async (fastify) => {
  await fastify.register(crudRoutes);
  await fastify.register(actionRoutes);
};
