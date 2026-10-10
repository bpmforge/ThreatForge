/**
 * Pipelines API - Shared helpers and re-exports.
 */
import type { FastifyReply } from "fastify";
import { getPrisma } from "../../db.js";
import { sendNotFound, sendForbidden } from "../../utils/api-response.js";

export { getPrisma };
export { getAuthUser } from "../../utils/auth-helpers.js";
export {
  getPipelineById,
  getPipelines,
  executePipeline,
  getExecutionStatus,
  getExecutionHistory,
  clearPipelineCache,
} from "../../services/ai/pipeline-service.js";
export { AIService } from "../../services/ai/ai-service.js";
export {
  sendNotFound,
  sendBadRequest,
  sendForbidden,
  sendInternalError,
  sendUnauthorized,
} from "../../utils/api-response.js";

/** Stage definition accepted when creating a pipeline or adding a stage */
export interface PipelineStageInput {
  name: string;
  description?: string;
  order: number;
  promptTemplateId: string;
  inputMapping?: Record<string, { source: string; field: string }>;
  outputFields?: string[];
  dependsOn?: string[];
  optional?: boolean;
  retryCount?: number;
  timeoutMs?: number;
  condition?: {
    field: string;
    equals?: string;
    contains?: string;
    exists?: boolean;
  };
}

/**
 * Load a pipeline and ensure it can be modified (exists and is not built-in).
 * Sends the error response itself and returns null when the request must stop.
 */
export async function loadMutablePipeline(
  reply: FastifyReply,
  pipelineId: string,
) {
  const prisma = await getPrisma();

  const pipeline = await prisma.promptPipeline.findUnique({
    where: { id: pipelineId },
  });

  if (!pipeline) {
    sendNotFound(reply, "Pipeline");
    return null;
  }

  if (pipeline.isBuiltIn) {
    sendForbidden(reply, "Cannot modify built-in pipeline");
    return null;
  }

  return pipeline;
}
