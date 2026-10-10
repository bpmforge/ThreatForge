/**
 * Outgoing webhooks (org webhooks and notification webhooks):
 * - never call a private/internal address, and never follow redirects;
 * - are signed with a real HMAC of the body, or not sent at all when the
 *   stored secret cannot be decrypted (never sent unsigned, never leaking
 *   part of the secret).
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { createHmac } from "node:crypto";

const prisma = {
  webhook: { findMany: vi.fn(), update: vi.fn() },
  webhookDelivery: { create: vi.fn(), update: vi.fn() },
};
vi.mock("../../db.js", () => ({ getPrisma: vi.fn(async () => prisma) }));

const { mockDecrypt, mockAssertPublic } = vi.hoisted(() => ({
  mockDecrypt: vi.fn(),
  mockAssertPublic: vi.fn(),
}));
vi.mock("../encryption/encryption-service.js", () => ({
  decryptValue: mockDecrypt,
}));
vi.mock("../../utils/outbound-url.js", () => ({
  assertPublicHttpUrl: mockAssertPublic,
}));

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

const { deliverPayload } = await import("./webhook-dispatcher.js");
const { sendWebhook } = await import(
  "../notifications/notification-webhook.js"
);

const hook = {
  id: "w1",
  url: "https://hooks.example.com/x",
  secret: "cipher",
  maxRetries: 0,
};
const payload = {
  event: "threat.created" as never,
  timestamp: "2026-10-08T00:00:00Z",
  organizationId: "org-1",
  data: { id: "t1" },
};

beforeEach(() => {
  vi.clearAllMocks();
  prisma.webhookDelivery.create.mockResolvedValue({ id: "d1" });
  mockAssertPublic.mockResolvedValue(null);
  mockDecrypt.mockReturnValue("s3cret");
  fetchMock.mockResolvedValue(new Response("ok", { status: 200 }));
});

describe("org webhook delivery", () => {
  it("refuses a private or internal URL without calling it", async () => {
    mockAssertPublic.mockResolvedValue("URL must point at a public host");
    const result = await deliverPayload(hook, payload);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.success).toBe(false);
    expect(result.error).toContain("public host");
  });

  it("is not sent when the secret cannot be decrypted", async () => {
    mockDecrypt.mockReturnValue(null);
    const result = await deliverPayload(hook, payload);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.success).toBe(false);
  });

  it("signs the exact body and does not follow redirects", async () => {
    await deliverPayload(hook, payload);
    const [, init] = fetchMock.mock.calls[0];
    expect(init.redirect).toBe("manual");
    const expected =
      "sha256=" +
      createHmac("sha256", "s3cret").update(init.body).digest("hex");
    expect(init.headers["X-Webhook-Signature"]).toBe(expected);
  });
});

describe("notification webhook delivery", () => {
  const notify = { type: "threat.created", organizationId: "org-1" } as never;
  beforeEach(() => {
    prisma.webhook.findMany.mockResolvedValue([
      { ...hook, events: '["*"]', isActive: true },
    ]);
  });

  it("refuses a private or internal URL without calling it", async () => {
    mockAssertPublic.mockResolvedValue("URL must point at a public host");
    await sendWebhook({ a: 1 }, notify);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("signs with a real HMAC and never sends part of the secret", async () => {
    await sendWebhook({ a: 1 }, notify);
    const [, init] = fetchMock.mock.calls[0];
    const expected =
      "sha256=" +
      createHmac("sha256", "s3cret").update(init.body).digest("hex");
    expect(init.headers["X-Signature-256"]).toBe(expected);
    expect(init.redirect).toBe("manual");
  });

  it("is not sent when the secret cannot be decrypted", async () => {
    mockDecrypt.mockReturnValue(null);
    await sendWebhook({ a: 1 }, notify);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
