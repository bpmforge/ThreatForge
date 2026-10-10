/**
 * AI Feature Types
 */

/** Message in AI conversation */
export interface AIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/** Suggested threat from AI */
export interface AISuggestedThreat {
  title: string;
  description: string;
  category:
    | "SPOOFING"
    | "TAMPERING"
    | "REPUDIATION"
    | "INFO_DISCLOSURE"
    | "DENIAL_OF_SERVICE"
    | "ELEVATION_OF_PRIVILEGE";
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";
  targetComponentId?: string;
  targetConnectionId?: string;
  mitigation?: string;
  confidence: number;
  /**
   * Citation-verifier preview attached server-side. Lets the suggestion
   * UI render a verification badge before the user accepts the threat.
   */
  verification?: {
    status: "PENDING" | "VERIFIED" | "UNVERIFIED" | "PHANTOM" | "EXEMPT";
    citations: Array<{
      type: "DOCUMENT" | "REFERENCE" | "COMPONENT" | "REQUIREMENT" | "NONE";
      documentName?: string;
      sectionAnchor?: string;
      pageNumber?: number;
      referenceId?: string;
      componentNodeId?: string;
      requirementId?: string;
      confidence?: number;
      rationale: string;
    }>;
  };
}

/** Suggested mitigation from AI */
export interface AISuggestedMitigation {
  title: string;
  description: string;
  implementation?: string;
  effectivenessScore: number;
}

/** AI availability status */
export interface AIAvailability {
  available: boolean;
  reason?: string;
}

/** AI chat response */
export interface AIChatResponse {
  message: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/** Expert analysis threat (enriched with analysis metadata) */
export interface ExpertAnalysisThreat extends AISuggestedThreat {
  attackVector?: string;
  prerequisites?: string;
  references?: string[];
  analysisType?:
    | "component_risk"
    | "data_flow"
    | "missing_control"
    | "attack_chain";
  verifiedInPass5?: boolean;
  /** Set when the Pass 5 verification reply for this threat failed to parse. */
  verificationFailed?: boolean;
  mitigationEffectiveness?: number; // 0.0-0.85 realistic score
  residualRisk?: string; // What risk remains after mitigation
}

/** Expert analysis consolidated result */
export interface ExpertAnalysisResult {
  threats: ExpertAnalysisThreat[];
  summary: {
    totalThreats: number;
    strideCoverage: string[];
    analysisTypes: string[];
    passesCompleted: number;
    verificationLoops: number;
    duration: number;
  };
  architectureUnderstanding?: string;
  dataFlowFindings?: string;
  attackChains?: string;
}

/** Refinement question from AI */
interface RefinementQuestion {
  question: string;
  category:
    | "authentication"
    | "data"
    | "network"
    | "encryption"
    | "integration"
    | "deployment";
  impact: string;
}

/** Refinement questions response */
export interface RefinementResponse {
  questions: RefinementQuestion[];
  completeness: number;
  summary: string;
}
