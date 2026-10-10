/**
 * Organization.ciWebhookSecret was stored in plaintext. New secrets are
 * encrypted with the encryption service; a legacy plaintext secret still
 * verifies deliveries and is re-encrypted the first time it is read, so
 * existing webhooks keep working.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { createHmac } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import {
  encryptValue,
  isEncrypted,
} from "../../../services/encryption/encryption-service.js";

const prisma = {
  organization: { findUnique: vi.fn(), update: vi.fn() },
};
vi.mock("../../../db.js", () => ({ getPrisma: vi.fn(async () => prisma) }));

const { verifyOrgWebhookDelivery, sealCiWebhookSecret } = await import(
  "../helpers.js"
);

const body = { event: "push" };
const signed = (secret: string) =>
  ({
    body,
    rawBody: JSON.stringify(body),
    headers: {
      "x-hub-signature-256":
        "sha256=" +
        createHmac("sha256", secret).update(JSON.stringify(body)).digest("hex"),
    },
  }) as unknown as FastifyRequest;
const reply = () =>
  ({
    status: vi.fn().mockReturnThis(),
    send: vi.fn(),
    request: { id: "r1" },
  }) as unknown as FastifyReply;

describe("CI webhook secret at rest", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sealCiWebhookSecret stores ciphertext", () => {
    expect(isEncrypted(sealCiWebhookSecret("abc"))).toBe(true);
  });

  it("an encrypted secret verifies a delivery", async () => {
    prisma.organization.findUnique.mockResolvedValue({
      ciWebhookSecret: encryptValue("s1"),
    });
    expect(
      await verifyOrgWebhookDelivery(signed("s1"), reply(), "o1", "x"),
    ).toBe(true);
    expect(
      await verifyOrgWebhookDelivery(signed("nope"), reply(), "o1", "x"),
    ).toBe(false);
    expect(prisma.organization.update).not.toHaveBeenCalled();
  });

  it("a legacy plaintext secret verifies and is re-encrypted", async () => {
    prisma.organization.findUnique.mockResolvedValue({
      ciWebhookSecret: "legacy",
    });
    expect(
      await verifyOrgWebhookDelivery(signed("legacy"), reply(), "o1", "x"),
    ).toBe(true);
    const stored =
      prisma.organization.update.mock.calls[0][0].data.ciWebhookSecret;
    expect(isEncrypted(stored)).toBe(true);
  });
});
