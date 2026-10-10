/**
 * Sequence Diagrams API - Shared helpers, schemas, and re-exports.
 */
import { z } from "zod";

export { getPrisma } from "../../db.js";
export { getAuthUser } from "../../utils/auth-helpers.js";
export {
  sendCreated,
  sendNotFound,
  sendBadRequest,
  sendNoContent,
  sendInternalError,
} from "../../utils/api-response.js";

export {
  canAccessThreatModel,
  requireThreatModelEdit,
} from "../threat-models/helpers.js";

// ===============================================================================
// Validation Schemas
// =============================================================================

/** Message type enum matching Prisma */
const MessageTypeSchema = z.enum([
  "SYNC",
  "ASYNC",
  "RETURN",
  "SELF",
  "CREATE",
  "DESTROY",
]);

/** Protocol enum */
const ProtocolSchema = z.enum([
  "HTTP",
  "HTTPS",
  "GRPC",
  "WEBSOCKET",
  "TCP",
  "UDP",
  "AMQP",
  "MQTT",
  "CUSTOM",
]);

/** Auth method enum */
const AuthMethodSchema = z.enum([
  "NONE",
  "API_KEY",
  "JWT",
  "OAUTH2",
  "MTLS",
  "BASIC",
  "SAML",
  "CUSTOM",
]);

/** Create sequence diagram request */
export const CreateSequenceDiagramSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
});

/** Update sequence diagram request */
export const UpdateSequenceDiagramSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  order: z.number().int().optional(),
});

/** Create participant request */
export const CreateParticipantSchema = z.object({
  label: z.string().min(1).max(255),
  order: z.number().int(),
  componentId: z.string().optional(),
});

/** Update participant request */
export const UpdateParticipantSchema = z.object({
  label: z.string().min(1).max(255).optional(),
  order: z.number().int().optional(),
  componentId: z.string().nullable().optional(),
});

/** Create message request */
export const CreateMessageSchema = z.object({
  label: z.string().min(1),
  order: z.number().int(),
  fromId: z.string(),
  toId: z.string(),
  messageType: MessageTypeSchema.optional(),
  protocol: ProtocolSchema.optional(),
  authentication: AuthMethodSchema.optional(),
  isReturn: z.boolean().optional(),
  notes: z.string().optional(),
});

/** Update message request */
export const UpdateMessageSchema = z.object({
  label: z.string().min(1).optional(),
  order: z.number().int().optional(),
  fromId: z.string().optional(),
  toId: z.string().optional(),
  messageType: MessageTypeSchema.optional(),
  protocol: ProtocolSchema.nullable().optional(),
  authentication: AuthMethodSchema.nullable().optional(),
  isReturn: z.boolean().optional(),
  notes: z.string().nullable().optional(),
});
