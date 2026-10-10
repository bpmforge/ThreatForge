/**
 * Threat Model API - Modular Entry Point
 *
 * CRUD operations for threat models including canvas state.
 * All routes require authentication.
 */
import type { FastifyPluginAsync } from "fastify";
import { listRoutes } from "./routes/list.js";
import { crudRoutes } from "./routes/crud.js";
import { canvasRoutes } from "./routes/canvas.js";
import { metadataRoutes } from "./routes/metadata.js";
import { statsRoutes } from "./routes/stats.js";
import { normalizedRoutes } from "./routes/normalized.js";
import { importRoutes } from "./routes/import.js";
import { exportImportRoutes } from "./routes/export-import.js";
import { requirementsRoutes } from "./routes/requirements.js";
import { requirementsImportRoutes } from "./routes/requirements-import.js";
import { scanCodeRoutes } from "./routes/scan-code.js";
import { gapAnalysisRoutes } from "./routes/gap-analysis.js";
import { scanFromGithubRoutes } from "./routes/scan-from-github.js";
import { createFromGithubRoutes } from "./routes/create-from-github.js";
import { requirementsCoverageRoutes } from "./routes/requirements-coverage.js";
import { documentsRoutes } from "./routes/documents.js";
import { inheritRoutes } from "./routes/inherit.js";
import { businessContextRoutes } from "./routes/business-context.js";
import { attestationRoutes } from "./routes/attestations.js";
import { findingsImportRoutes } from "./routes/findings-import.js";

export const threatModelRoutes: FastifyPluginAsync = async (fastify) => {
  await fastify.register(listRoutes);
  await fastify.register(crudRoutes);
  await fastify.register(canvasRoutes);
  await fastify.register(metadataRoutes);
  await fastify.register(statsRoutes);
  await fastify.register(normalizedRoutes);
  await fastify.register(importRoutes);
  await fastify.register(exportImportRoutes);
  await fastify.register(requirementsRoutes);
  await fastify.register(requirementsImportRoutes);
  await fastify.register(scanCodeRoutes);
  await fastify.register(gapAnalysisRoutes);
  await fastify.register(scanFromGithubRoutes);
  await fastify.register(createFromGithubRoutes);
  await fastify.register(requirementsCoverageRoutes);
  await fastify.register(documentsRoutes);
  await fastify.register(inheritRoutes);
  await fastify.register(businessContextRoutes);
  await fastify.register(attestationRoutes);
  await fastify.register(findingsImportRoutes);
};

// Re-export types and helpers
export * from "./schemas.js";
export * from "./helpers.js";
