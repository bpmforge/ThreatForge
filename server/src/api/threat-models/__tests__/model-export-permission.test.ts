/**
 * Exporting a model (YAML, DOCX) honours the export right on guest shares:
 * members with view access may export; guests need canExport.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

const { mockCheck } = vi.hoisted(() => ({ mockCheck: vi.fn() }));
vi.mock(
  "../../../services/access-control/access-control-service.js",
  async (orig) => ({
    ...(await orig<Record<string, unknown>>()),
    checkThreatModelAccess: mockCheck,
  }),
);

const { authorizeModelExport } = await import("../helpers.js");

function reply() {
  const r = { status: vi.fn(), send: vi.fn(), request: { id: "r" } };
  r.status.mockReturnValue(r);
  r.send.mockReturnValue(r);
  return r;
}

describe("authorizeModelExport", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lets a VIEWER member export", async () => {
    mockCheck.mockResolvedValue({
      hasAccess: true,
      isGuest: false,
      permissions: ["view"],
    });
    expect(await authorizeModelExport(reply() as never, "u", "m")).toBe(true);
  });

  it("refuses a guest whose share does not allow export", async () => {
    mockCheck.mockResolvedValue({
      hasAccess: true,
      isGuest: true,
      permissions: ["view"],
    });
    const r = reply();
    expect(await authorizeModelExport(r as never, "u", "m")).toBe(false);
    expect(r.status).toHaveBeenCalledWith(403);
  });

  it("lets a guest with export rights export", async () => {
    mockCheck.mockResolvedValue({
      hasAccess: true,
      isGuest: true,
      permissions: ["view", "export"],
    });
    expect(await authorizeModelExport(reply() as never, "u", "m")).toBe(true);
  });

  it("answers 404 without access", async () => {
    mockCheck.mockResolvedValue({
      hasAccess: false,
      isGuest: false,
      permissions: [],
    });
    const r = reply();
    expect(await authorizeModelExport(r as never, "u", "m")).toBe(false);
    expect(r.status).toHaveBeenCalledWith(404);
  });
});
