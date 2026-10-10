/**
 * Document Import Types
 *
 * Types for document import, parsing, and architecture extraction.
 */

import type { StrideCategory } from "@/types/canvas";

// Document format types
export type DocumentFormat =
  | "pdf"
  | "docx"
  | "md"
  | "html"
  | "txt"
  | "terraform"
  | "docker-compose"
  | "unknown";
export type ImportSource = "file" | "url" | "paste";

// Component types that can be extracted
export type ExtractedComponentType =
  | "webServer"
  | "api"
  | "apiGateway"
  | "database"
  | "cache"
  | "queue"
  | "storage"
  | "authService"
  | "externalService"
  | "client"
  | "actor"
  | "service"
  | "loadBalancer"
  | "cdn"
  | "firewall"
  | "mlModel"
  | "trainingPipeline"
  | "featureStore"
  | "vectorDb"
  | "llmApi"
  | "embeddingService";

// Data classification types
type DataClassification =
  | "pii"
  | "phi"
  | "pci"
  | "credentials"
  | "internal"
  | "public";

// Imported document metadata
export interface DocumentMetadata {
  title?: string;
  author?: string;
  lastModified?: string;
  pageCount?: number;
  wordCount: number;
  sections?: string[];
}

// Main imported document interface
export interface ImportedDocument {
  id: string;
  source: ImportSource;
  format: DocumentFormat;
  filename?: string;
  url?: string;
  rawContent: string;
  extractedText: string;
  metadata: DocumentMetadata;
  importedAt: string;
}

// Import progress tracking
export interface ImportProgress {
  stage: "idle" | "uploading" | "parsing" | "extracting" | "complete" | "error";
  progress: number;
  message: string;
  error?: string;
}

// Extracted component from AI analysis
export interface ExtractedComponent {
  id: string;
  name: string;
  type: ExtractedComponentType;
  description: string;
  technology?: string;
  dataHandled?: string[];
  confidence: number;
  sourceText?: string;
  selected: boolean;
  // Rich metadata from extraction-agent (preserved through to canvas + DB)
  dataClassification?: string[];
  trustLevel?: string;
  sourceDocument?: string;
}

// Extracted data flow between components
export interface ExtractedDataFlow {
  id: string;
  sourceId: string;
  targetId: string;
  label: string;
  protocol?: string;
  dataTypes?: string[];
  encrypted?: boolean;
  confidence: number;
  selected: boolean;
}

// Extracted trust boundary
export interface ExtractedBoundary {
  id: string;
  name: string;
  type: "trust" | "network" | "vpc" | "organization";
  trustLevel?: "PUBLIC" | "INTERNAL" | "CONFIDENTIAL" | "RESTRICTED";
  componentIds: string[];
  description?: string;
  confidence: number;
  selected: boolean;
}

// Requirement extracted from a document (SRS, SAD, etc.)
interface ExtractedRequirement {
  id: string;
  reqId: string; // e.g. "FR-12", "SEC-3"
  text: string; // e.g. "System shall use TLS 1.3 for all external connections"
  docId: string; // source document label, e.g. "SRS", "SAD"
  category?: string; // "security" | "functional" | "compliance"
}

// A single step in an extracted sequence
interface ExtractedSequenceStep {
  from: string; // component id
  to: string; // component id
  message: string; // e.g. "POST /api/sensor-data"
  notes?: string; // optional details
}

// A named interaction sequence (for sequence diagrams)
interface ExtractedSequence {
  id: string;
  name: string; // e.g. "Telemetry Ingestion"
  description?: string;
  steps: ExtractedSequenceStep[];
}

// Full extracted architecture from AI
export interface ExtractedArchitecture {
  components: ExtractedComponent[];
  dataFlows: ExtractedDataFlow[];
  boundaries: ExtractedBoundary[];
  requirements?: ExtractedRequirement[];
  sequences?: ExtractedSequence[];
  technologies: string[];
  dataTypes: DataClassification[];
  confidence: number;
  warnings: string[];
}

// Suggested threat based on extraction
export interface ExtractionSuggestedThreat {
  componentId: string;
  strideCategory: StrideCategory;
  title: string;
  description: string;
  likelihood: "low" | "medium" | "high";
  impact: "low" | "medium" | "high";
  source:
    | "component-type"
    | "data-flow"
    | "data-sensitivity"
    | "boundary-crossing";
}

// Layout options for auto-layout
export interface LayoutOptions {
  type: "hierarchical" | "force" | "grid";
  direction?: "TB" | "LR" | "BT" | "RL";
  spacing?: { x: number; y: number };
  boundaryPadding?: number;
}

// Generated model from extraction
export interface GeneratedModel {
  nodes: GeneratedNode[];
  edges: GeneratedEdge[];
  suggestedThreats: ExtractionSuggestedThreat[];
  layoutType: LayoutOptions["type"];
}

// Generated node for canvas
export interface GeneratedNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: {
    label: string;
    type?: string;
    componentType?: ExtractedComponentType | string;
    description?: string;
    technology?: string;
    trustLevel?: string;
    color?: string;
    opacity?: number;
  };
  parentId?: string;
  extent?: "parent";
  style?: { width?: number; height?: number };
}

// Generated edge for canvas
export interface GeneratedEdge {
  id: string;
  source: string;
  target: string;
  type?: string;
  label?: string;
  data?: {
    protocol?: string;
    encrypted?: boolean;
    dataTypes?: string[];
    style?: { lineStyle?: string };
  };
}

// Parse result from document parser
export interface ParseResult {
  text: string;
  metadata: DocumentMetadata;
  format: DocumentFormat;
}
