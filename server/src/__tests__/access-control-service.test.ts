/**
 * Unit tests for access-control-service.ts
 *
 * Covers these helpers:
 *   - getOrgIdFromModel: returns org ID or null
 *   - getOrgIdFromThreat: returns org ID or null
 *   - canAccessThreat: returns true/false based on membership
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mock dependencies before importing the module under test
// ---------------------------------------------------------------------------

const mockPrisma = {
  membership: {
    findUnique: vi.fn(),
  },
  project: {
    findUnique: vi.fn(),
  },
  threatModel: {
    findUnique: vi.fn(),
  },
  modelAccess: {
    findFirst: vi.fn(),
    update: vi.fn(),
  },
  threat: {
    findUnique: vi.fn(),
  },
};

vi.mock("../db.js", () => ({
  getPrisma: vi.fn(() => Promise.resolve(mockPrisma)),
}));

import {
  getOrgIdFromModel,
  getOrgIdFromThreat,
  canAccessThreat,
} from "../services/access-control/access-control-service.js";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("getOrgIdFromModel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the organization ID when the threat model exists", async () => {
    mockPrisma.threatModel.findUnique.mockResolvedValue({
      project: { organizationId: "org-42" },
    });

    const result = await getOrgIdFromModel("model-1");

    expect(result).toBe("org-42");
    expect(mockPrisma.threatModel.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "model-1" } }),
    );
  });

  it("returns null when the threat model does not exist", async () => {
    mockPrisma.threatModel.findUnique.mockResolvedValue(null);

    const result = await getOrgIdFromModel("model-missing");

    expect(result).toBeNull();
  });
});

describe("getOrgIdFromThreat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the organization ID when the threat and its model chain exist", async () => {
    mockPrisma.threat.findUnique.mockResolvedValue({
      threatModel: {
        project: { organizationId: "org-99" },
      },
    });

    const result = await getOrgIdFromThreat("threat-1");

    expect(result).toBe("org-99");
    expect(mockPrisma.threat.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "threat-1" } }),
    );
  });

  it("returns null when the threat does not exist", async () => {
    mockPrisma.threat.findUnique.mockResolvedValue(null);

    const result = await getOrgIdFromThreat("threat-missing");

    expect(result).toBeNull();
  });
});

describe("canAccessThreat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns true when the user is a member of the threat model's organization", async () => {
    mockPrisma.threat.findUnique.mockResolvedValue({
      threatModel: {
        project: {
          organization: {
            memberships: [{ userId: "user-1", role: "VIEWER" }],
          },
        },
      },
    });

    const result = await canAccessThreat("user-1", "threat-1");

    expect(result).toBe(true);
  });

  it("returns false when the user is NOT a member of the organization", async () => {
    mockPrisma.threat.findUnique.mockResolvedValue({
      threatModel: {
        project: {
          organization: {
            memberships: [], // no matching membership
          },
        },
      },
    });

    const result = await canAccessThreat("user-outsider", "threat-1");

    expect(result).toBe(false);
  });

  it("only counts ACTIVE memberships (a suspended member is refused)", async () => {
    mockPrisma.threat.findUnique.mockResolvedValue(null);

    await canAccessThreat("user-1", "threat-1");

    const include = mockPrisma.threat.findUnique.mock.calls[0][0].include;
    expect(
      include.threatModel.include.project.include.organization.include
        .memberships.where,
    ).toEqual({ userId: "user-1", status: "ACTIVE" });
  });

  it("returns false when the threat does not exist", async () => {
    mockPrisma.threat.findUnique.mockResolvedValue(null);

    const result = await canAccessThreat("user-1", "threat-missing");

    expect(result).toBe(false);
  });
});
