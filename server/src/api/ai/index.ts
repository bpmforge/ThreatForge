/**
 * AI API - Modular Entry Point
 *
 * AI suggestions, chat, streaming, analysis, and provider health.
 * All routes require authentication.
 */
import type { FastifyPluginAsync } from "fastify";
import { healthRoutes } from "./routes/health.js";
import { suggestionRoutes } from "./routes/suggestions.js";
import { chatRoutes } from "./routes/chat.js";
import { severityRoutes } from "./routes/severity.js";
import { extractionRoutes } from "./routes/extraction.js";
import { contextAnalyzeRoutes } from "./routes/context-analyze.js";
import { attackTreeRoutes } from "./routes/attack-tree.js";
import { refinementRoutes } from "./routes/refinement.js";
import { expertAnalysisRoutes } from "./routes/expert-analysis.js";
import { agenticAnalysisRoutes } from "./routes/agentic-analysis.js";
import { rescoreRoutes } from "./routes/rescore.js";
import { planDiagramsRoutes } from "./routes/plan-diagrams.js";
import { synthesizeHLARoutes } from "./routes/synthesize-hla.js";
import { synthesizeRoutes } from "./routes/synthesize.js";

export const aiRoutes: FastifyPluginAsync = async (fastify) => {
  await fastify.register(healthRoutes);
  await fastify.register(suggestionRoutes);
  await fastify.register(chatRoutes);
  await fastify.register(severityRoutes);
  await fastify.register(extractionRoutes);
  await fastify.register(contextAnalyzeRoutes);
  await fastify.register(attackTreeRoutes);
  await fastify.register(refinementRoutes);
  await fastify.register(expertAnalysisRoutes);
  await fastify.register(agenticAnalysisRoutes);
  await fastify.register(rescoreRoutes);
  await fastify.register(planDiagramsRoutes);
  await fastify.register(synthesizeHLARoutes);
  await fastify.register(synthesizeRoutes);
};

// Re-export types and helpers
export * from "./helpers.js";
