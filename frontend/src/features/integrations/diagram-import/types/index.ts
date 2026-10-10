import type { ComponentType } from "@/types/canvas";

export type DiagramSource =
  | "drawio"
  | "lucidchart"
  | "mermaid"
  | "miro"
  | "plantuml"
  | "structurizr"
  | "image"
  | "threat-dragon";

export interface ParsedDiagram {
  source: DiagramSource;
  shapes: ParsedShape[];
  connections: ParsedConnection[];
  groups: ParsedGroup[];
  metadata: DiagramMetadata;
}

export interface ParsedShape {
  id: string;
  label: string;
  type: string;
  inferredType?: ComponentType;
  position: { x: number; y: number };
  size: { width: number; height: number };
  style?: Record<string, string>;
  properties?: Record<string, unknown>;
}

export interface ParsedConnection {
  id: string;
  sourceId: string;
  targetId: string;
  label?: string;
  style?: Record<string, string>;
}

export interface ParsedGroup {
  id: string;
  label: string;
  childIds: string[];
  bounds: { x: number; y: number; width: number; height: number };
}

interface DiagramMetadata {
  pageCount?: number;
  title?: string;
  source?: string;
}

export interface DiagramImportResult {
  success: boolean;
  diagram?: ParsedDiagram;
  errors?: string[];
}
