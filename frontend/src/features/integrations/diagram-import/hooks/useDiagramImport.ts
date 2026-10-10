"use client";

import { useState, useCallback } from "react";
import type { Node, Edge } from "@xyflow/react";
import type {
  DiagramSource,
  ParsedDiagram,
  DiagramImportResult,
} from "../types";
import { parseDrawioXml } from "../services/parsers/drawio-parser";
import { parseMermaidDiagram } from "../services/parsers/mermaid-parser";
import { parseLucidchartCsv } from "../services/parsers/lucidchart-parser";
import { parseThreatDragon } from "../services/parsers/threat-dragon-parser";
import {
  convertDiagramToCanvas,
  type ConversionOptions,
  type ConversionResult,
} from "../services/diagram-to-canvas";
import {
  convertDiagramToDFD,
  type DFDConversionResult,
} from "../services/dfd-converter";
import { getErrorMessage } from "@/lib/errors";

export interface DiagramImportOptions extends ConversionOptions {
  /** Auto-detect source format from file extension or content */
  autoDetect?: boolean;
}

export function useDiagramImport() {
  const [result, setResult] = useState<DiagramImportResult | null>(null);
  const [canvasResult, setCanvasResult] = useState<ConversionResult | null>(
    null,
  );
  const [dfdResult, setDfdResult] = useState<DFDConversionResult | null>(null);
  const [parsedDiagram, setParsedDiagram] = useState<ParsedDiagram | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const detectSource = useCallback(
    (content: string, filename?: string): DiagramSource => {
      // Check filename extension first
      if (filename) {
        const ext = filename.toLowerCase().split(".").pop();
        if (ext === "drawio" || ext === "xml") return "drawio";
        if (ext === "csv") return "lucidchart";
        if (ext === "md" || ext === "mmd" || ext === "mermaid")
          return "mermaid";
      }

      // Check content patterns
      const trimmed = content.trim();

      // Draw.io XML
      if (
        trimmed.includes("<mxfile") ||
        trimmed.includes("<mxGraphModel") ||
        trimmed.includes("<mxCell")
      ) {
        return "drawio";
      }

      // Mermaid
      if (
        /^(flowchart|graph|sequenceDiagram|classDiagram|stateDiagram|erDiagram|C4Context|C4Container|C4Component)/im.test(
          trimmed,
        )
      ) {
        return "mermaid";
      }

      // Lucidchart CSV (has specific headers)
      if (
        trimmed.startsWith("Id,") ||
        trimmed.includes('"Id"') ||
        trimmed.includes("Shape Library")
      ) {
        return "lucidchart";
      }

      // Default to drawio for XML-like content
      if (trimmed.startsWith("<") || trimmed.startsWith("<?xml")) {
        return "drawio";
      }

      return "drawio";
    },
    [],
  );

  const importDiagram = useCallback(
    async (
      sourceOrFile: DiagramSource | File,
      dataOrOptions?: string | File | DiagramImportOptions,
      options?: DiagramImportOptions,
    ): Promise<DiagramImportResult> => {
      setLoading(true);
      setError(null);
      setCanvasResult(null);
      setDfdResult(null);
      setParsedDiagram(null);

      try {
        let content: string;
        let source: DiagramSource;
        let opts: DiagramImportOptions = {};
        let filename: string | undefined;

        // Handle different call signatures
        if (sourceOrFile instanceof File) {
          // Called with File as first argument
          content = await sourceOrFile.text();
          filename = sourceOrFile.name;
          source = detectSource(content, filename);
          opts = (dataOrOptions as DiagramImportOptions) || {};
        } else if (dataOrOptions instanceof File) {
          // Called with source and File
          source = sourceOrFile;
          content = await dataOrOptions.text();
          filename = dataOrOptions.name;
          opts = options || {};
        } else {
          // Called with source and string content
          source = sourceOrFile;
          content = dataOrOptions as string;
          opts = options || {};

          // Auto-detect if requested and source seems wrong
          if (opts.autoDetect) {
            source = detectSource(content);
          }
        }

        let diagram: ParsedDiagram;

        // Parse based on detected/specified source
        switch (source) {
          case "drawio":
            diagram = parseDrawioXml(content);
            break;
          case "mermaid":
          case "plantuml":
            diagram = parseMermaidDiagram(content);
            break;
          case "lucidchart":
            diagram = parseLucidchartCsv(content);
            break;
          case "threat-dragon":
            diagram = parseThreatDragon(content);
            break;
          case "miro":
          case "structurizr":
          case "image":
            throw new Error(`${source} import is not yet supported`);
          default:
            throw new Error(`Unsupported diagram source: ${source}`);
        }

        // Store parsed diagram for later conversion
        setParsedDiagram(diagram);

        // Convert to architecture canvas format by default
        const conversion = convertDiagramToCanvas(diagram, opts);
        setCanvasResult(conversion);

        // Also convert to DFD format
        const dfdConversion = convertDiagramToDFD(diagram, opts);
        setDfdResult(dfdConversion);

        const importResult: DiagramImportResult = {
          success: true,
          diagram,
        };

        setResult(importResult);
        return importResult;
      } catch (err) {
        const message = getErrorMessage(err, "Import failed");
        setError(message);
        const failResult: DiagramImportResult = {
          success: false,
          errors: [message],
        };
        setResult(failResult);
        return failResult;
      } finally {
        setLoading(false);
      }
    },
    [detectSource],
  );

  const getCanvasData = useCallback((): {
    nodes: Node[];
    edges: Edge[];
  } | null => {
    if (!canvasResult) return null;
    return {
      nodes: canvasResult.nodes,
      edges: canvasResult.edges,
    };
  }, [canvasResult]);

  const clearResult = useCallback(() => {
    setResult(null);
    setCanvasResult(null);
    setDfdResult(null);
    setParsedDiagram(null);
    setError(null);
  }, []);

  return {
    result,
    canvasResult,
    dfdResult,
    parsedDiagram,
    loading,
    error,
    importDiagram,
    getCanvasData,
    clearResult,
    detectSource,
  };
}
