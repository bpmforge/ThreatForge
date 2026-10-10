/**
 * Webhooks API
 *
 * Endpoints for managing organization webhooks for external integrations.
 */
import type { FastifyPluginAsync } from "fastify";
import { webhookCrudRoutes } from "./routes/crud.js";
import { webhookDeliveryRoutes } from "./routes/delivery.js";

// Available webhook events
export const WEBHOOK_EVENTS = [
  "threat.created",
  "threat.updated",
  "threat.deleted",
  "mitigation.created",
  "mitigation.updated",
  "mitigation.deleted",
  "model.created",
  "model.updated",
  "model.deleted",
  "model.exported",
  "member.invited",
  "member.joined",
  "member.removed",
  "project.created",
  "project.deleted",
  "compliance.reviewed",
  "mitigation.evidence_linked",
  "review.submitted",
  "review.approved",
  "model.shared",
  "ai_job.completed",
  "ai_job.failed",
  "model.version_created",
  "scan.completed",
  "scan.failed",
  "attack_chain.analyzed",
] as const;

export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

export function getEventDescription(event: string): string {
  const descriptions: Record<string, string> = {
    "threat.created": "A new threat is added to a model",
    "threat.updated": "A threat is modified",
    "threat.deleted": "A threat is removed from a model",
    "mitigation.created": "A new mitigation is added",
    "mitigation.updated": "A mitigation is modified",
    "mitigation.deleted": "A mitigation is removed",
    "model.created": "A new threat model is created",
    "model.updated": "A threat model is modified",
    "model.deleted": "A threat model is deleted",
    "model.exported": "A threat model is exported",
    "member.invited": "A user is invited to the organization",
    "member.joined": "A user joins the organization",
    "member.removed": "A user is removed from the organization",
    "project.created": "A new project is created",
    "project.deleted": "A project is deleted",
    "compliance.reviewed":
      "A compliance framework mapping is reviewed or updated",
    "mitigation.evidence_linked": "Evidence is linked to a mitigation",
    "review.submitted": "A threat model review is submitted",
    "review.approved": "A threat model review is approved",
    "model.shared": "A threat model is shared via public link",
    "ai_job.completed":
      "An AI job (threat suggestion, expert analysis, etc.) finishes successfully",
    "ai_job.failed": "An AI job errors after exhausting retries",
    "model.version_created": "A version snapshot of a threat model is saved",
    "scan.completed": "A CI or code-security scan result is available",
    "scan.failed": "A CI or code-security scan encounters an error",
    "attack_chain.analyzed":
      "Attack chain analysis has completed for a threat model",
  };
  return descriptions[event] || event;
}

export const webhookRoutes: FastifyPluginAsync = async (server) => {
  await server.register(webhookCrudRoutes);
  await server.register(webhookDeliveryRoutes);
};
