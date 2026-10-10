/**
 * Risk Scoring Frameworks API (v1)
 *
 * Configure and apply risk scoring frameworks (OWASP, FAIR, CVSS, DREAD, Custom).
 */
import type { FastifyPluginAsync } from "fastify";
import { frameworkRoutes } from "./framework-routes.js";
import { scoreRoutes } from "./score-routes.js";

// Re-export schemas and calculators
export * from "./schemas.js";
export * from "./calculators.js";

/**
 * Risk Scoring routes
 */
export const riskScoringRoutes: FastifyPluginAsync = async (server) => {
  await server.register(frameworkRoutes);
  await server.register(scoreRoutes);
};
