/**
 * CI/CD API - Webhook Handler Routes
 */
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import {
  handleGitHubWebhook,
  handleGitLabWebhook,
  handleBitbucketWebhook,
  verifyGitLabToken,
} from "../../../services/ci-feedback/index.js";
import { verifyGitHubSignature, getOrgCiWebhookSecret } from "../helpers.js";
import { signedBody } from "../../../utils/raw-body.js";
import {
  sendSuccess,
  sendNotFound,
  sendBadRequest,
  sendForbidden,
  sendUnauthorized,
  sendInternalError,
} from "../../../utils/api-response.js";

export const webhookRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * POST /api/ci/webhooks/github/:organizationId
   * GitHub webhook handler for check_suite and pull_request events
   */
  fastify.post<{ Params: { organizationId: string } }>(
    "/api/ci/webhooks/github/:organizationId",
    {
      config: {
        skipAuth: true,
        authz: {
          public: "HMAC-signed with the org CI webhook secret; 403 when unset",
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: { organizationId: string } }>,
      reply: FastifyReply,
    ) => {
      const event = request.headers["x-github-event"] as string;
      const signature = request.headers["x-hub-signature-256"] as string;
      const { organizationId } = request.params;

      if (!event) {
        return sendBadRequest(reply, "Missing X-GitHub-Event header");
      }

      const ciSecret = await getOrgCiWebhookSecret(organizationId);
      if (ciSecret === undefined) {
        return sendNotFound(reply, "Organization");
      }

      if (ciSecret) {
        const isValid = verifyGitHubSignature(
          signedBody(request),
          signature,
          ciSecret,
        );

        if (!isValid) {
          fastify.log.warn(
            { organizationId, event },
            "Invalid webhook signature",
          );
          return sendUnauthorized(
            reply,
            "Webhook signature verification failed",
          );
        }
      } else {
        fastify.log.warn(
          { organizationId, event },
          "Webhook rejected — ciWebhookSecret not configured for this organization",
        );
        return sendForbidden(
          reply,
          "Organization must configure a webhook secret before receiving webhooks",
        );
      }

      try {
        const result = await handleGitHubWebhook(
          event,
          request.body as Record<string, unknown>,
        );
        return sendSuccess(reply, {
          processed: result.processed,
          action: result.action,
        });
      } catch (error) {
        fastify.log.error(
          { error, event, organizationId },
          "GitHub webhook processing failed",
        );
        return sendInternalError(reply, "Failed to process webhook");
      }
    },
  );

  /**
   * POST /api/ci/webhooks/github (Legacy - REMOVED)
   * Redirect to org-scoped endpoint for security.
   */
  fastify.post(
    "/api/ci/webhooks/github",
    {
      config: {
        skipAuth: true,
        authz: { public: "always 410 Gone, no processing" },
      },
    },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      return reply.status(410).send({
        error:
          "This endpoint has been removed for security. Use /api/ci/webhooks/github/:organizationId with signature verification.",
        code: "ENDPOINT_REMOVED",
      });
    },
  );

  /**
   * POST /api/ci/webhooks/gitlab/:organizationId
   * GitLab webhook handler for merge_request and pipeline events
   */
  fastify.post<{ Params: { organizationId: string } }>(
    "/api/ci/webhooks/gitlab/:organizationId",
    {
      config: {
        skipAuth: true,
        authz: {
          public:
            "X-Gitlab-Token checked against the org CI webhook secret; 403 when unset",
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: { organizationId: string } }>,
      reply: FastifyReply,
    ) => {
      const event = request.headers["x-gitlab-event"] as string;
      const token = request.headers["x-gitlab-token"] as string;
      const { organizationId } = request.params;

      if (!event) {
        return sendBadRequest(reply, "Missing X-Gitlab-Event header");
      }

      const ciSecret = await getOrgCiWebhookSecret(organizationId);
      if (ciSecret === undefined) {
        return sendNotFound(reply, "Organization");
      }

      if (ciSecret) {
        if (!verifyGitLabToken(token, ciSecret)) {
          fastify.log.warn(
            { organizationId, event },
            "Invalid GitLab webhook token",
          );
          return sendUnauthorized(reply, "Webhook token verification failed");
        }
      } else {
        fastify.log.warn(
          { organizationId, event },
          "Webhook rejected — ciWebhookSecret not configured for this organization",
        );
        return sendForbidden(
          reply,
          "Organization must configure a webhook secret before receiving webhooks",
        );
      }

      try {
        const result = await handleGitLabWebhook(
          event,
          request.body as Record<string, unknown>,
        );
        return sendSuccess(reply, {
          processed: result.processed,
          action: result.action,
        });
      } catch (error) {
        fastify.log.error(
          { error, event, organizationId },
          "GitLab webhook processing failed",
        );
        return sendInternalError(reply, "Failed to process webhook");
      }
    },
  );

  /**
   * POST /api/ci/webhooks/bitbucket/:organizationId
   * Bitbucket webhook handler for pullrequest and repo:push events
   */
  fastify.post<{ Params: { organizationId: string } }>(
    "/api/ci/webhooks/bitbucket/:organizationId",
    {
      config: {
        skipAuth: true,
        authz: {
          public: "HMAC-SHA256 X-Hub-Signature with the org CI webhook secret",
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: { organizationId: string } }>,
      reply: FastifyReply,
    ) => {
      const event = request.headers["x-event-key"] as string;
      const { organizationId } = request.params;

      if (!event) {
        return sendBadRequest(reply, "Missing X-Event-Key header");
      }

      const ciSecret = await getOrgCiWebhookSecret(organizationId);
      if (ciSecret === undefined) {
        return sendNotFound(reply, "Organization");
      }

      if (!ciSecret) {
        fastify.log.warn(
          { organizationId, event },
          "Webhook rejected — ciWebhookSecret not configured for this organization",
        );
        return sendForbidden(
          reply,
          "Organization must configure a webhook secret before receiving webhooks",
        );
      }

      // Bitbucket signs deliveries with the webhook secret as
      // `X-Hub-Signature: sha256=<hex>` (HMAC-SHA256 of the body)
      const signature = request.headers["x-hub-signature"] as string;
      if (!verifyGitHubSignature(signedBody(request), signature, ciSecret)) {
        fastify.log.warn(
          { organizationId, event },
          "Invalid Bitbucket webhook signature",
        );
        return sendUnauthorized(reply, "Webhook signature verification failed");
      }

      try {
        const result = await handleBitbucketWebhook(
          event,
          request.body as Record<string, unknown>,
        );
        return sendSuccess(reply, {
          processed: result.processed,
          action: result.action,
        });
      } catch (error) {
        fastify.log.error(
          { error, event, organizationId },
          "Bitbucket webhook processing failed",
        );
        return sendInternalError(reply, "Failed to process webhook");
      }
    },
  );
};
