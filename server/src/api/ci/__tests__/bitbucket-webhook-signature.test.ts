/**
 * POST /api/ci/webhooks/bitbucket/:organizationId must verify the delivery's
 * HMAC-SHA256 signature (Bitbucket sends `X-Hub-Signature: sha256=<hex>`)
 * against the org's CI webhook secret before processing it.
 */
import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  vi,
} from "vitest";
import { keepRawJsonBody } from "../../../utils/raw-body.js";
import Fastify, { type FastifyInstance } from "fastify";
import { createHmac } from "node:crypto";

const { mockGetSecret, mockHandleBitbucket } = vi.hoisted(() => ({
  mockGetSecret: vi.fn(),
  mockHandleBitbucket: vi.fn(),
}));

vi.mock("../helpers.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../helpers.js")>()),
  getOrgCiWebhookSecret: mockGetSecret,
}));
vi.mock("../../../services/ci-feedback/index.js", () => ({
  handleGitHubWebhook: vi.fn(),
  handleGitLabWebhook: vi.fn(),
  handleBitbucketWebhook: mockHandleBitbucket,
  verifyGitLabToken: vi.fn(),
}));

const { webhookRoutes } = await import("../routes/webhooks.js");

const SECRET = "org-secret";
const body = { pullrequest: { id: 7 }, repository: { full_name: "a/b" } };
const sign = (secret: string) =>
  "sha256=" +
  createHmac("sha256", secret).update(JSON.stringify(body)).digest("hex");

describe("Bitbucket CI webhook signature", () => {
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

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSecret.mockResolvedValue(SECRET);
    mockHandleBitbucket.mockResolvedValue({ processed: true, action: "x" });
  });

  const post = (headers: Record<string, string>) =>
    app.inject({
      method: "POST",
      url: "/api/ci/webhooks/bitbucket/org-1",
      headers: { "x-event-key": "pullrequest:created", ...headers },
      payload: body,
    });

  it("rejects a delivery with no signature", async () => {
    const res = await post({});
    expect(res.statusCode).toBe(401);
    expect(mockHandleBitbucket).not.toHaveBeenCalled();
  });

  it("rejects a delivery signed with the wrong secret", async () => {
    const res = await post({ "x-hub-signature": sign("attacker") });
    expect(res.statusCode).toBe(401);
    expect(mockHandleBitbucket).not.toHaveBeenCalled();
  });

  it("processes a correctly signed delivery", async () => {
    const res = await post({ "x-hub-signature": sign(SECRET) });
    expect(res.statusCode).toBe(200);
    expect(mockHandleBitbucket).toHaveBeenCalledWith(
      "pullrequest:created",
      body,
    );
  });

  it("still refuses when the org has no secret configured", async () => {
    mockGetSecret.mockResolvedValue(null);
    const res = await post({ "x-hub-signature": sign(SECRET) });
    expect(res.statusCode).toBe(403);
    expect(mockHandleBitbucket).not.toHaveBeenCalled();
  });
});
