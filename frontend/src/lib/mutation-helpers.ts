/**
 * Shared mutation error handling utilities.
 *
 * Provides consistent error handling patterns for TanStack Query mutations.
 */
import { ApiError } from "./api-client";

export type MutationErrorHandler = (error: Error, context?: string) => void;

/**
 * Default error handler that logs errors to console.
 * Can be extended to show toast notifications or other UI feedback.
 */
export const defaultMutationErrorHandler: MutationErrorHandler = (
  error,
  context,
) => {
  const prefix = context ? `[${context}]` : "[Mutation Error]";

  if (error instanceof ApiError) {
    console.error(`${prefix} API Error (${error.statusCode}):`, error.message);
    if (error.details) {
      console.error(`${prefix} Details:`, error.details);
    }
  } else {
    console.error(`${prefix}`, error.message || error);
  }
};
