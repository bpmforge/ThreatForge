/**
 * AI System Prompts - Re-exports from modular structure.
 *
 * @deprecated Import from './prompts' directory instead for new code.
 * This file maintained for backwards compatibility.
 */
export {
  // Threat analysis
  THREAT_ANALYSIS_SYSTEM_PROMPT,
  MITIGATION_SYSTEM_PROMPT,
  COMPONENT_THREAT_SYSTEM_PROMPT,
  SEVERITY_CALCULATION_SYSTEM_PROMPT,

  // Document detection
  type DocumentType,
  detectDocumentType,
  // Extraction prompts
  DIAGRAM_IMAGE_SYSTEM_PROMPT,
  DIAGRAM_IMAGE_USER_PROMPT,
  // Chat prompts

  // Builder functions
  buildThreatAnalysisPrompt,
  buildMitigationPrompt,
  buildComponentThreatPrompt,
  buildSeverityPrompt,
  buildChatSystemPrompt,
  buildExtractionPrompt,
  getExtractionSystemPrompt,
} from "./prompts/index.js";
