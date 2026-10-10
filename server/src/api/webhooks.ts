/**
 * Webhooks API - Re-export shim
 *
 * All logic has moved to webhooks/ directory.
 * This file exists for backward-compatible imports.
 */
export {
  webhookRoutes,
  WEBHOOK_EVENTS,
  type WebhookEvent,
} from "./webhooks/index.js";
