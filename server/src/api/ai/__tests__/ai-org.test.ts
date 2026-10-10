/**
 * Org-less AI routes (document/diagram extraction, vision support, provider
 * health, agentic extraction) used the caller's first ACTIVE membership in
 * whatever order the DB returned, so multi-org users spent the wrong org's
 * AI budget and used its provider settings.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

const prisma = {
  membership: { findFirst: vi.fn() },
  user: { findUnique: vi.fn() },
};
vi.mock("../../../db.js", () => ({ getPrisma: vi.fn(async () => prisma) }));

const { resolveAiOrganization, requestedOrganizationId } = await import(
  "../ai-org.js"
);

const org = (id: string) => ({ organization: { id, aiSettings: null } });

describe("resolveAiOrganization", () => {
  beforeEach(() => vi.clearAllMocks());

  it("uses the requested org when the caller is an ACTIVE member", async () => {
    prisma.membership.findFirst.mockResolvedValue(org("org-b"));
    expect(await resolveAiOrganization("u", "org-b")).toEqual({
      id: "org-b",
      aiSettings: null,
    });
    expect(prisma.membership.findFirst.mock.calls[0][0].where).toEqual({
      userId: "u",
      organizationId: "org-b",
      status: "ACTIVE",
    });
  });

  it("refuses a requested org the caller is not an ACTIVE member of", async () => {
    prisma.membership.findFirst.mockResolvedValue(null);
    expect(await resolveAiOrganization("u", "org-x")).toBeNull();
    expect(prisma.membership.findFirst).toHaveBeenCalledTimes(1);
  });

  it("falls back to the user's default org", async () => {
    prisma.user.findUnique.mockResolvedValue({
      defaultOrganizationId: "org-d",
    });
    prisma.membership.findFirst.mockResolvedValueOnce(org("org-d"));
    expect((await resolveAiOrganization("u", undefined))?.id).toBe("org-d");
  });

  it("then to the oldest ACTIVE membership", async () => {
    prisma.user.findUnique.mockResolvedValue({ defaultOrganizationId: null });
    prisma.membership.findFirst.mockResolvedValueOnce(org("org-old"));
    expect((await resolveAiOrganization("u", undefined))?.id).toBe("org-old");
    expect(prisma.membership.findFirst.mock.calls[0][0].orderBy).toEqual({
      createdAt: "asc",
    });
  });
});

describe("requestedOrganizationId", () => {
  it("reads body first, then query", () => {
    expect(
      requestedOrganizationId({
        body: { organizationId: "b" },
        query: { organizationId: "q" },
      }),
    ).toBe("b");
    expect(
      requestedOrganizationId({ body: {}, query: { organizationId: "q" } }),
    ).toBe("q");
    expect(
      requestedOrganizationId({ body: undefined, query: {} }),
    ).toBeUndefined();
  });
});
