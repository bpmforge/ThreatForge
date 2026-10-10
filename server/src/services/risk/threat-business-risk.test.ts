import { describe, it, expect, vi, beforeEach } from "vitest";

const prisma = {
  threatModel: { findUnique: vi.fn() },
  threat: { findUnique: vi.fn(), update: vi.fn() },
};
vi.mock("../../db.js", () => ({ getPrisma: vi.fn(async () => prisma) }));

const { refreshThreatBusinessRisk } = await import("./threat-business-risk.js");

describe("refreshThreatBusinessRisk", () => {
  beforeEach(() => vi.clearAllMocks());

  it("leaves threats alone when the model has no business context", async () => {
    prisma.threatModel.findUnique.mockResolvedValue({
      businessImpact: null,
      dataClassification: null,
      regulatoryScope: "[]",
      userBase: null,
      revenueImpact: null,
    });

    await refreshThreatBusinessRisk("t1", "m1");

    expect(prisma.threat.findUnique).not.toHaveBeenCalled();
    expect(prisma.threat.update).not.toHaveBeenCalled();
  });

  it("stores the recomputed score and tier", async () => {
    prisma.threatModel.findUnique.mockResolvedValue({
      businessImpact: "CRITICAL",
      dataClassification: "RESTRICTED",
      regulatoryScope: '["GDPR"]',
      userBase: "PUBLIC",
      revenueImpact: "HIGH",
    });
    prisma.threat.findUnique.mockResolvedValue({
      severity: "HIGH",
      likelihood: "HIGH",
    });

    await refreshThreatBusinessRisk("t1", "m1");

    expect(prisma.threat.update).toHaveBeenCalledWith({
      where: { id: "t1" },
      data: {
        businessRiskScore: expect.any(Number),
        businessRiskTier: expect.any(String),
      },
    });
  });
});
