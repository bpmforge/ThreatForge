/**
 * Data Flow Diagram (DFD) API
 *
 * CRUD operations for DFDs and their entities.
 */
import type { FastifyInstance } from "fastify";
import { dfdCrudRoutes } from "./dfd-routes.js";
import { entityRoutes } from "./entity-routes.js";

// Re-export schemas and helpers
export * from "./schemas.js";
export * from "./helpers.js";

/**
 * DFD routes
 */
export async function dfdRoutes(fastify: FastifyInstance) {
  await dfdCrudRoutes(fastify);
  await entityRoutes(fastify);
}
