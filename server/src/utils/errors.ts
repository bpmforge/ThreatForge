/**
 * Centralized Error Handling Utilities
 *
 * Provides standardized error classes and response formatting
 * for consistent API error responses.
 */

/**
 * Standard error response format
 */
export interface ApiErrorResponse {
  error: string;
  code?: string;
  details?: Record<string, unknown>;
  requestId?: string;
}

/**
 * Base application error class
 */
export class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 500,
    public readonly code?: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "AppError";
    Error.captureStackTrace(this, this.constructor);
  }

  toResponse(): ApiErrorResponse {
    const response: ApiErrorResponse = { error: this.message };
    if (this.code) response.code = this.code;
    if (this.details) response.details = this.details;
    return response;
  }
}
