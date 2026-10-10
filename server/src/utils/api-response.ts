/**
 * Standardized API Response Utilities
 *
 * Provides consistent response formats across all API endpoints.
 * All responses follow the pattern:
 * - Success: { data, meta? }
 * - List: { data, pagination }
 * - Error: { error, code, details?, requestId }
 */
import type { FastifyReply } from "fastify";

// =============================================================================
// Types
// =============================================================================

/** Pagination metadata for list responses */
interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

/** Standard success response */
export interface ApiResponse<T> {
  data: T;
  meta?: Record<string, unknown>;
}

/** Standard list response with pagination */
export interface ApiListResponse<T> {
  data: T[];
  pagination: PaginationMeta;
}

/** Standard error response */
export interface ApiErrorResponse {
  error: string;
  code: string;
  details?: Record<string, unknown>;
  requestId?: string;
}

// =============================================================================
// Response Builders
// =============================================================================

/**
 * Build a successful single-item response
 */
function successResponse<T>(
  data: T,
  meta?: Record<string, unknown>,
): ApiResponse<T> {
  const response: ApiResponse<T> = { data };
  if (meta) {
    response.meta = meta;
  }
  return response;
}

/**
 * Build a paginated list response
 */
function listResponse<T>(
  data: T[],
  pagination: {
    page: number;
    limit: number;
    total: number;
  },
): ApiListResponse<T> {
  const { page, limit, total } = pagination;
  const totalPages = Math.ceil(total / limit);

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  };
}

/**
 * Build an error response
 */
export function errorResponse(
  error: string,
  code: string,
  details?: Record<string, unknown>,
  requestId?: string,
): ApiErrorResponse {
  const response: ApiErrorResponse = { error, code };
  if (details) {
    response.details = details;
  }
  if (requestId) {
    response.requestId = requestId;
  }
  return response;
}

// =============================================================================
// Reply Helpers
// =============================================================================

/**
 * Send a 200 OK response with data
 */
export function sendSuccess<T>(
  reply: FastifyReply,
  data: T,
  meta?: Record<string, unknown>,
) {
  return reply.status(200).send(successResponse(data, meta));
}

/**
 * Send a 201 Created response with data
 */
export function sendCreated<T>(
  reply: FastifyReply,
  data: T,
  meta?: Record<string, unknown>,
) {
  return reply.status(201).send(successResponse(data, meta));
}

/**
 * Send a 200 OK response with paginated list
 */
export function sendList<T>(
  reply: FastifyReply,
  data: T[],
  pagination: { page: number; limit: number; total: number },
) {
  return reply.status(200).send(listResponse(data, pagination));
}

/**
 * Send a 204 No Content response
 */
export function sendNoContent(reply: FastifyReply) {
  return reply.status(204).send();
}

/**
 * Send a 400 Bad Request error
 */
export function sendBadRequest(
  reply: FastifyReply,
  message: string,
  details?: Record<string, unknown>,
) {
  return reply
    .status(400)
    .send(errorResponse(message, "BAD_REQUEST", details, reply.request.id));
}

/**
 * Send a 401 Unauthorized error
 */
export function sendUnauthorized(
  reply: FastifyReply,
  message = "Authentication required",
) {
  return reply
    .status(401)
    .send(errorResponse(message, "UNAUTHORIZED", undefined, reply.request.id));
}

/**
 * Send a 403 Forbidden error
 */
export function sendForbidden(reply: FastifyReply, message = "Access denied") {
  return reply
    .status(403)
    .send(errorResponse(message, "FORBIDDEN", undefined, reply.request.id));
}

/**
 * Send a 404 Not Found error
 */
export function sendNotFound(
  reply: FastifyReply,
  resource: string,
  id?: string,
) {
  const message = id
    ? `${resource} with ID '${id}' not found`
    : `${resource} not found`;
  return reply
    .status(404)
    .send(errorResponse(message, "NOT_FOUND", undefined, reply.request.id));
}

/**
 * Send a 409 Conflict error
 */
export function sendConflict(
  reply: FastifyReply,
  message: string,
  details?: Record<string, unknown>,
) {
  return reply
    .status(409)
    .send(errorResponse(message, "CONFLICT", details, reply.request.id));
}

/**
 * Send a 422 Unprocessable Entity error (validation failed)
 */
export function sendValidationError(
  reply: FastifyReply,
  errors: Array<{ field: string; message: string }>,
) {
  return reply
    .status(422)
    .send(
      errorResponse(
        "Validation failed",
        "VALIDATION_ERROR",
        { errors },
        reply.request.id,
      ),
    );
}

/**
 * Send a 500 Internal Server Error
 */
export function sendInternalError(
  reply: FastifyReply,
  message = "An unexpected error occurred",
) {
  return reply
    .status(500)
    .send(
      errorResponse(message, "INTERNAL_ERROR", undefined, reply.request.id),
    );
}

// =============================================================================
// Pagination Helpers
// =============================================================================

/**
 * Parse pagination params from query string
 */
export function parsePagination(query: { page?: string; limit?: string }): {
  page: number;
  limit: number;
  skip: number;
} {
  const page = Math.max(1, parseInt(query.page || "1", 10) || 1);
  const limit = Math.min(
    100,
    Math.max(1, parseInt(query.limit || "50", 10) || 50),
  );
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}
