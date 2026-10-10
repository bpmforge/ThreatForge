/**
 * Stage registry tests — verifies the stage registration contract.
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  STAGE_NAMES,
  THREAT_ANALYSIS_STAGE_NAMES,
  registerStage,
  getStage,
  resetStageRegistry,
  type StageHandler,
  type StageResult,
} from "./registry.js";

const noopHandler: StageHandler = async () => {
  const result: StageResult = { outputs: {}, tokensUsed: 0, parseFailures: [] };
  return result;
};

describe("stage registry", () => {
  beforeEach(() => {
    resetStageRegistry();
  });

  it("exposes the 8 threat-analysis stage names in pipeline order", () => {
    expect(THREAT_ANALYSIS_STAGE_NAMES).toEqual([
      "ArchitectureReader",
      "ThreatIdentifier",
      "EvidenceEnricher",
      "StrideClassifier",
      "MitigationSynthesizer",
      "ComplianceMapper",
      "SeverityCalibrator",
      "Verifier",
    ]);
  });

  it("STAGE_NAMES adds the attack-chain (Wave A5) stages after the 8", () => {
    expect(STAGE_NAMES).toEqual([
      ...THREAT_ANALYSIS_STAGE_NAMES,
      "EntryPointDetector",
      "TargetAssetDetector",
      "PathGenerator",
      "ChainValidator",
      "ChainScorer",
    ]);
  });

  it("getStage on an unregistered name throws listing registered names", () => {
    registerStage("ArchitectureReader", noopHandler);
    registerStage("ThreatIdentifier", noopHandler);

    expect(() => getStage("Verifier")).toThrowError(
      /Stage "Verifier" is not registered\. Registered stages: ArchitectureReader, ThreatIdentifier/,
    );
  });

  it("getStage with nothing registered reports (none)", () => {
    expect(() => getStage("Verifier")).toThrowError(
      /Registered stages: \(none\)/,
    );
  });

  it("returns the registered handler", async () => {
    registerStage("ThreatIdentifier", noopHandler);
    const handler = getStage("ThreatIdentifier");
    expect(handler).toBe(noopHandler);
    await expect(
      handler({
        executionId: "exec-1",
        threatModelId: "tm-1",
        organizationId: "org-1",
        sessionId: "session-1",
        inputs: {},
        aiCall: async () => "{}",
        progress: async () => undefined,
        checkpoint: async () => undefined,
        signal: new AbortController().signal,
      }),
    ).resolves.toEqual({ outputs: {}, tokensUsed: 0, parseFailures: [] });
  });

  it("re-registering a name replaces the handler", () => {
    const replacement: StageHandler = async () => ({
      outputs: { marker: true },
      tokensUsed: 0,
      parseFailures: [],
    });
    registerStage("EvidenceEnricher", noopHandler);
    registerStage("EvidenceEnricher", replacement);
    expect(getStage("EvidenceEnricher")).toBe(replacement);
  });
});
