/**
 * Webhook signatures are checked against the bytes the sender signed. A
 * delivery whose JSON formatting differs from JSON.stringify (here: pretty
 * printed) must verify; a tampered body must not.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import { createHmac } from "node:crypto";
import { keepRawJsonBody } from "../../utils/raw-body.js";

const SECRET = "org-secret";
const { mockGetSecret, mockHandle } = vi.hoisted(() => ({
  mockGetSecret: vi.fn(async () => "org-secret"),
  mockHandle: vi.fn(async () => ({ processed: true, action: "x" })),
}));
vi.mock("../ci/helpers.js", async (orig) => ({
  ...(await orig<typeof import("../ci/helpers.js")>()),
  getOrgCiWebhookSecret: mockGetSecret,
}));
vi.mock("../../services/ci-feedback/index.js", () => ({
  handleGitHubWebhook: mockHandle,
  handleGitLabWebhook: mockHandle,
  handleBitbucketWebhook: mockHandle,
  verifyGitLabToken: vi.fn(),
}));

const { webhookRoutes } = await import("../ci/routes/webhooks.js");

const pretty = JSON.stringify(
  { action: "opened", number: 7, title: "é" },
  null,
  2,
);
const sign = (body: string) =>
  "sha256=" + createHmac("sha256", SECRET).update(body).digest("hex");

describe("CI webhooks verify the raw body", () => {
  let app: FastifyInstance;
  beforeAll(async () => {
    app = Fastify();
    keepRawJsonBody(app);
    await app.register(webhookRoutes);
    await app.ready();
  });
  afterAll(async () => {
    await app.close();
  });

  const post = (url: string, headers: Record<string, string>, body: string) =>
    app.inject({
      method: "POST",
      url,
      headers: { "content-type": "application/json", ...headers },
      payload: body,
    });

  it("GitHub: accepts a pretty-printed delivery signed over its exact bytes", async () => {
    const res = await post(
      "/api/ci/webhooks/github/org-1",
      { "x-github-event": "pull_request", "x-hub-signature-256": sign(pretty) },
      pretty,
    );
    expect(res.statusCode).toBe(200);
  });

  it("Bitbucket: accepts a pretty-printed delivery signed over its exact bytes", async () => {
    const res = await post(
      "/api/ci/webhooks/bitbucket/org-1",
      { "x-event-key": "pullrequest:created", "x-hub-signature": sign(pretty) },
      pretty,
    );
    expect(res.statusCode).toBe(200);
  });

  it("rejects a body changed after signing", async () => {
    const res = await post(
      "/api/ci/webhooks/github/org-1",
      { "x-github-event": "pull_request", "x-hub-signature-256": sign(pretty) },
      pretty.replace("opened", "closed"),
    );
    expect(res.statusCode).toBe(401);
  });

  it("still parses the JSON body for the handler", async () => {
    mockHandle.mockClear();
    await post(
      "/api/ci/webhooks/github/org-1",
      { "x-github-event": "pull_request", "x-hub-signature-256": sign(pretty) },
      pretty,
    );
    expect(mockHandle).toHaveBeenCalledWith("pull_request", {
      action: "opened",
      number: 7,
      title: "é",
    });
  });

  it("keeps Fastify's errors for empty and invalid JSON", async () => {
    const empty = await post(
      "/api/ci/webhooks/github/org-1",
      { "x-github-event": "x" },
      "",
    );
    const bad = await post(
      "/api/ci/webhooks/github/org-1",
      { "x-github-event": "x" },
      "{nope",
    );
    expect(empty.statusCode).toBe(400);
    expect(bad.statusCode).toBe(400);
  });
});
