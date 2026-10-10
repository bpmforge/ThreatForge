/**
 * Stage handler registration Importing this module registers
 * every implemented stage handler with the registry as a side effect —
 * the unified executor and tests import this single entry point.
 *
 * `registerStageHandlers()` is idempotent and exported so tests that call
 * `resetStageRegistry()` (the registry is module-level, shared per process)
 * can re-register without re-importing.
 */
import { registerStage } from "./registry.js";
import { architectureReaderStage } from "./architecture-reader.js";
import { complianceMapperStage } from "./compliance-mapper.js";
import { evidenceEnricherStage } from "./evidence-enricher.js";
import { mitigationSynthesizerStage } from "./mitigation-synthesizer.js";
import { severityCalibratorStage } from "./severity-calibrator.js";
import { strideClassifierStage } from "./stride-classifier.js";
import { threatIdentifierStage } from "./threat-identifier.js";
import { verifierStage } from "./verifier.js";
import { entryPointDetectorStage } from "./entry-point-detector.js";
import { targetAssetDetectorStage } from "./target-asset-detector.js";
import { pathGeneratorStage } from "./path-generator.js";
import { chainValidatorStage } from "./chain-validator.js";
import { chainScorerStage } from "./chain-scorer.js";

export function registerStageHandlers(): void {
  registerStage("ArchitectureReader", architectureReaderStage);
  registerStage("ThreatIdentifier", threatIdentifierStage);
  registerStage("EvidenceEnricher", evidenceEnricherStage);
  registerStage("StrideClassifier", strideClassifierStage);
  registerStage("MitigationSynthesizer", mitigationSynthesizerStage);
  registerStage("ComplianceMapper", complianceMapperStage);
  registerStage("SeverityCalibrator", severityCalibratorStage);
  registerStage("Verifier", verifierStage); // adversarial challenger gate
  // attack-chain pipeline (attack-chain-v1) passes 1-2.
  registerStage("EntryPointDetector", entryPointDetectorStage);
  registerStage("TargetAssetDetector", targetAssetDetectorStage);
  // attack-chain pipeline (attack-chain-v1) pass 3.
  registerStage("PathGenerator", pathGeneratorStage);
  // attack-chain pipeline (attack-chain-v1) passes 4-5.
  registerStage("ChainValidator", chainValidatorStage);
  registerStage("ChainScorer", chainScorerStage);
}

registerStageHandlers();

export * from "./registry.js";
