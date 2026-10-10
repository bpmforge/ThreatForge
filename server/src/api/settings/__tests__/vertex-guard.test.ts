import { describe, it, expect, beforeEach, vi } from "vitest";
import type { AISettings } from "../../../types/settings.js";

const mockPrisma = { user: { findUnique: vi.fn() } };
vi.mock("../../../db.js", () => ({
  getPrisma: vi.fn(() => Promise.resolve(mockPrisma)),
}));
vi.mock("../../../services/ai/private-host-policy.js", () => ({
  checkTenantBaseUrl: vi.fn(async () => null),
}));
vi.mock("../../../services/access-control/access-control-service.js", () => ({
  requireOrgRole: vi.fn(),
  checkThreatModelAccess: vi.fn(),
}));

const { guardAISettingsUpdate } = await import("../helpers.js");

const current = (provider: AISettings["provider"]) =>
  ({ enabled: true, provider }) as AISettings;

describe("guardAISettingsUpdate and Vertex AI", () => {
  beforeEach(() => vi.clearAllMocks());

  it("refuses an org admin choosing vertexai", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ isSuperAdmin: false });
    const error = await guardAISettingsUpdate(
      current("claude"),
      { provider: "vertexai", projectId: "my-project-1" },
      "admin",
    );
    expect(error).toMatch(/super admin/);
  });

  it("refuses changing the project of an org already on vertexai", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ isSuperAdmin: false });
    const error = await guardAISettingsUpdate(
      current("vertexai"),
      { projectId: "other-project" },
      "admin",
    );
    expect(error).toMatch(/super admin/);
  });

  it("lets a super admin choose vertexai", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ isSuperAdmin: true });
    expect(
      await guardAISettingsUpdate(
        current("claude"),
        { provider: "vertexai" },
        "root",
      ),
    ).toBeNull();
  });

  it("does not look up the user for other providers", async () => {
    expect(
      await guardAISettingsUpdate(current("claude"), { model: "x" }, "admin"),
    ).toBeNull();
    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
  });
});
