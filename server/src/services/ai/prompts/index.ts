/**
 * AI Prompts - Modular Entry Point
 *
 * Re-exports all prompt constants and builder functions.
 */

// Threat analysis prompts
export {
  THREAT_ANALYSIS_SYSTEM_PROMPT,
  MITIGATION_SYSTEM_PROMPT,
  COMPONENT_THREAT_SYSTEM_PROMPT,
  SEVERITY_CALCULATION_SYSTEM_PROMPT,
} from "./threat-prompts.js";

// Document detection
export { detectDocumentType } from "./document-detection.js";
export type { DocumentType } from "./document-detection.js";

// Extraction prompts
export {
  DIAGRAM_IMAGE_SYSTEM_PROMPT,
  DIAGRAM_IMAGE_USER_PROMPT,
} from "./extraction-prompts.js";

// Chat prompts

// Builder functions
export {
  buildThreatAnalysisPrompt,
  buildMitigationPrompt,
  buildComponentThreatPrompt,
  buildSeverityPrompt,
  buildChatSystemPrompt,
  buildExtractionPrompt,
  getExtractionSystemPrompt,
} from "./builders.js";
