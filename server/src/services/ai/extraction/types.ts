/**
 * Multi-Step Extraction Types
 *
 * Shared types for the 4-step document extraction pipeline.
 * Mirrors frontend ExtractedArchitecture but defined server-side.
 */

export type AiCallFn = (system: string, user: string) => Promise<string>;

export interface ExtractedComponent {
  id: string;
  name: string;
  type: string;
  description?: string;
  technology?: string;
  dataHandled?: string[];
  confidence: number;
  [key: string]: unknown;
}

export interface ExtractedBoundary {
  id: string;
  name: string;
  type: string;
  trustLevel: string;
  componentIds: string[];
  description?: string;
  confidence: number;
  [key: string]: unknown;
}

export interface ExtractedDataFlow {
  id: string;
  sourceId: string;
  targetId: string;
  label: string;
  protocol?: string;
  dataTypes?: string[];
  encrypted?: boolean;
  confidence: number;
  [key: string]: unknown;
}

interface ExtractedSequenceStep {
  from: string;
  to: string;
  message: string;
  notes?: string;
}

export interface ExtractedSequence {
  id: string;
  name: string;
  description?: string;
  steps: ExtractedSequenceStep[];
}

export interface ExtractionResult {
  components: ExtractedComponent[];
  dataFlows: ExtractedDataFlow[];
  boundaries: ExtractedBoundary[];
  sequences: ExtractedSequence[];
  requirements: Array<{
    id: string;
    reqId: string;
    text: string;
    docId: string;
    category?: string;
  }>;
  technologies: string[];
  dataTypes: string[];
  confidence: number;
  warnings: string[];
}

export interface MultiStepOptions {
  minConfidence?: number;
  maxLoops?: number;
  onProgress?: (step: number, total: number, phase: string) => void;
}
