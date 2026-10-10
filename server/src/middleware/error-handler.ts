/**
 * Global Error Handler Middleware
 *
 * Catches unhandled errors and formats them consistently.
 */
import { SpendCapExceededError } from "../services/ai/spend-guard.js";
import type {
  FastifyInstance,
  FastifyError,
  FastifyRequest,
  FastifyReply,
} from "fastify";
import { AppError } from "../utils/errors.js";

/**
 * Register global error handler on Fastify instance
 */
export function registerErrorHandler(server: FastifyInstance): void {
  server.setErrorHandler(
    (error: FastifyError, request: FastifyRequest, reply: FastifyReply) => {
      const requestId = request.id;

      // Handle our custom AppError types
      if (error instanceof AppError) {
        const response = error.toResponse();
        response.requestId = requestId;
        return reply.status(error.statusCode).send(response);
      }

      // Handle Fastify validation errors
      if (error.validation) {
        const validationErrors = error.validation.map((err) => ({
          field: err.instancePath || err.params?.missingProperty || "unknown",
          message: err.message || "Validation failed",
        }));

        return reply.status(400).send({
          error: "Validation failed",
          code: "VALIDATION_ERROR",
          details: { errors: validationErrors },
          requestId,
        });
      }

      // Handle JWT errors
      if (
        error.code === "FST_JWT_NO_AUTHORIZATION_IN_HEADER" ||
        error.code === "FST_JWT_AUTHORIZATION_TOKEN_INVALID" ||
        error.code === "FST_JWT_AUTHORIZATION_TOKEN_EXPIRED"
      ) {
        return reply.status(401).send({
          error: "Authentication required",
          code: "UNAUTHORIZED",
          requestId,
        });
      }

      // AI quota exceeded (thrown by enqueueAiJob / createSuggestThreatsJob)
      if (error instanceof SpendCapExceededError) {
        return reply.status(429).send({
          error: error.message,
          code: error.code,
          requestId,
        });
      }

      // Handle rate limit errors
      if (error.statusCode === 429) {
        return reply.status(429).send({
          error: "Too many requests, please try again later",
          code: "RATE_LIMITED",
          requestId,
        });
      }

      // Handle known HTTP errors
      if (error.statusCode && error.statusCode < 500) {
        return reply.status(error.statusCode).send({
          error: error.message || "Request failed",
          code: error.code || "ERROR",
          requestId,
        });
      }

      // Log unexpected errors
      server.log.error(
        {
          err: error,
          requestId,
          url: request.url,
          method: request.method,
        },
        "Unhandled error",
      );

      // Don't leak internal errors in production
      const message =
        process.env.NODE_ENV === "production"
          ? "An unexpected error occurred"
          : error.message;

      return reply.status(500).send({
        error: message,
        code: "INTERNAL_ERROR",
        requestId,
      });
    },
  );
}

/**
 * Register 404 handler for unknown routes
 */
export function registerNotFoundHandler(server: FastifyInstance): void {
  server.setNotFoundHandler((request: FastifyRequest, reply: FastifyReply) => {
    return reply.status(404).send({
      error: `Route ${request.method} ${request.url} not found`,
      code: "NOT_FOUND",
      requestId: request.id,
    });
  });
}
