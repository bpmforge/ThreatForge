/**
 * Settings API - Modular Entry Point
 *
 * Organization AI settings, threat model AI settings, and user preferences.
 * All routes require authentication.
 */
import type { FastifyPluginAsync } from "fastify";
import { aiSettingsRoutes } from "./routes/ai-settings.js";
import { modelAiSettingsRoutes } from "./routes/model-ai-settings.js";
import { preferencesRoutes } from "./routes/preferences.js";

export const settingsRoutes: FastifyPluginAsync = async (fastify) => {
  await fastify.register(aiSettingsRoutes);
  await fastify.register(modelAiSettingsRoutes);
  await fastify.register(preferencesRoutes);
};

// Re-export helpers for use by other modules
export * from "./helpers.js";
