/**
 * Sequence Diagrams API - Modular Entry Point
 *
 * CRUD operations for sequence diagrams, participants, and messages.
 * All routes require authentication and model access verification.
 */
import type { FastifyPluginAsync } from "fastify";
import { diagramRoutes } from "./routes/diagrams.js";
import { entityRoutes } from "./routes/entities.js";
import { messageRoutes } from "./routes/messages.js";
import { generateRoutes } from "./routes/generate.js";

export const sequenceDiagramRoutes: FastifyPluginAsync = async (fastify) => {
  await fastify.register(diagramRoutes);
  await fastify.register(entityRoutes);
  await fastify.register(messageRoutes);
  await fastify.register(generateRoutes);
};

// Re-export helpers
export * from "./helpers.js";
