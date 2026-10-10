/**
 * Keep the exact JSON request body for signature checks.
 *
 * Webhook senders (GitHub, Bitbucket, Jira, infrastructure hooks) sign the
 * bytes they send. Re-serialising the parsed body with JSON.stringify gives
 * different bytes whenever the sender's formatting differs (spacing, key
 * order, unicode escapes), so a correctly signed delivery fails. This parser
 * behaves exactly like Fastify's default JSON parser and also stores the raw
 * text on `request.rawBody`.
 */
import type { FastifyInstance, FastifyRequest } from "fastify";

declare module "fastify" {
  interface FastifyRequest {
    /** The JSON request body exactly as received (set for application/json). */
    rawBody?: string;
  }
}

export function keepRawJsonBody(app: FastifyInstance): void {
  const parse = app.getDefaultJsonParser("error", "error");
  app.removeContentTypeParser("application/json");
  app.addContentTypeParser(
    "application/json",
    { parseAs: "string" },
    (request, body, done) => {
      request.rawBody = body as string;
      parse(request, body as string, done);
    },
  );
}

/** The body a webhook signature covers, or undefined (verification then fails). */
export function signedBody(request: FastifyRequest): string | undefined {
  return request.rawBody;
}
