/**
 * Security Scanner API Routes
 *
 * Endpoints for managing scanner integrations and findings.
 */
import type { FastifyInstance } from "fastify";
import { scannerConfigurationRoutes } from "./routes/configuration.js";
import { scannerResultsRoutes } from "./routes/results.js";

export { authorizeProject } from "../projects/helpers.js";

export async function scannerRoutes(fastify: FastifyInstance) {
  await fastify.register(scannerConfigurationRoutes);
  await fastify.register(scannerResultsRoutes);
}
