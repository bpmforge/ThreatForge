/**
 * Shared Logger
 *
 * Lightweight Pino logger for use in services that don't have
 * access to the Fastify instance. Uses the same configuration
 * as Fastify's built-in logger for consistent output.
 */
import pino from "pino";

const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  transport:
    process.env.NODE_ENV === "development"
      ? { target: "pino-pretty", options: { colorize: true } }
      : undefined,
});

export default logger;
