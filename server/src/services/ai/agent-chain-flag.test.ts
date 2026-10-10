/**
 * agent-chain-v2 org flag accessor tests.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  isAgentChainV2Enabled,
  readAgentChainV2,
  AGENT_CHAIN_V2_FLAG,
} from "./agent-chain-flag.js";
import { DEFAULT_AI_SETTINGS } from "../../types/settings.js";

const mockPrisma = {
  organization: {
    findUnique: vi.fn(),
  },
  promptPipeline: {
    findFirst: vi.fn(),
  },
};

vi.mock("../../db.js", () => ({
  getPrisma: vi.fn(() => Promise.resolve(mockPrisma)),
}));

describe("agent-chain-v2 flag", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exposes the public flag name", () => {
    expect(AGENT_CHAIN_V2_FLAG).toBe("agent-chain-v2");
  });

  it("defaults ON in DEFAULT_AI_SETTINGS (1.0.0)", () => {
    expect(DEFAULT_AI_SETTINGS.features.agentChainV2).toBe(true);
  });

  it("reads true for null, legacy blobs without the key, and bad JSON", () => {
    expect(readAgentChainV2(null)).toBe(true);
    expect(
      readAgentChainV2(
        JSON.stringify({ enabled: true, features: { enableChat: true } }),
      ),
    ).toBe(true);
    expect(readAgentChainV2("not-json{")).toBe(true);
  });

  it("reads false only when an org explicitly sets features.agentChainV2 === false", () => {
    expect(
      readAgentChainV2(JSON.stringify({ features: { agentChainV2: false } })),
    ).toBe(false);
    expect(
      readAgentChainV2(JSON.stringify({ features: { agentChainV2: true } })),
    ).toBe(true);
  });

  it("isAgentChainV2Enabled reads the org aiSettings blob (where ai-worker runs)", async () => {
    mockPrisma.organization.findUnique.mockResolvedValue({
      aiSettings: JSON.stringify({
        ...DEFAULT_AI_SETTINGS,
        features: { ...DEFAULT_AI_SETTINGS.features, agentChainV2: false },
      }),
    });
    await expect(isAgentChainV2Enabled("org-1")).resolves.toBe(false);
    expect(mockPrisma.organization.findUnique).toHaveBeenCalledWith({
      where: { id: "org-1" },
      select: { aiSettings: true },
    });
  });

  it("isAgentChainV2Enabled: unset flag is ON only when the v2 pipeline is seeded", async () => {
    mockPrisma.organization.findUnique.mockResolvedValue({ aiSettings: null });

    mockPrisma.promptPipeline.findFirst.mockResolvedValue({ id: "p1" });
    await expect(isAgentChainV2Enabled("org-2")).resolves.toBe(true);

    // Deployment that never ran `npm run seed:pipelines`: legacy, not a failure.
    mockPrisma.promptPipeline.findFirst.mockResolvedValue(null);
    await expect(isAgentChainV2Enabled("org-2")).resolves.toBe(false);

    mockPrisma.organization.findUnique.mockResolvedValue(null);
    await expect(isAgentChainV2Enabled("missing-org")).resolves.toBe(false);
  });

  it("isAgentChainV2Enabled honours an explicit true even if the pipeline is not seeded", async () => {
    mockPrisma.organization.findUnique.mockResolvedValue({
      aiSettings: JSON.stringify({ features: { agentChainV2: true } }),
    });
    mockPrisma.promptPipeline.findFirst.mockResolvedValue(null);
    await expect(isAgentChainV2Enabled("org-3")).resolves.toBe(true);
    expect(mockPrisma.promptPipeline.findFirst).not.toHaveBeenCalled();
  });
});
