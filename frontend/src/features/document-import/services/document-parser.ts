/**
 * Document Parser Service
 *
 * Main orchestrator for parsing various document formats.
 * PDF and DOCX parsing is handled server-side due to library requirements.
 */

import type {
  DocumentFormat,
  ImportedDocument,
  ImportSource,
  ParseResult,
} from "../types";
import { parseMarkdown } from "./parsers/markdown-parser";
import { parseHtml } from "./parsers/html-parser";
import { parseText } from "./parsers/text-parser";

/**
 * Detect document format from filename or content type
 */
export function detectFormat(
  filename?: string,
  contentType?: string,
): DocumentFormat {
  // Check content type first
  if (contentType) {
    if (contentType.includes("pdf")) return "pdf";
    if (
      contentType.includes("wordprocessingml") ||
      contentType.includes("msword")
    )
      return "docx";
    if (contentType.includes("markdown")) return "md";
    if (contentType.includes("html")) return "html";
    if (contentType.includes("text/plain")) return "txt";
  }

  // Fall back to filename extension
  if (filename) {
    const base = filename.split("/").pop() ?? filename;
    const ext = base.split(".").pop()?.toLowerCase();

    // Docker Compose detection by filename pattern
    if (
      base === "docker-compose.yml" ||
      base === "docker-compose.yaml" ||
      base.startsWith("docker-compose.") ||
      base === "compose.yml" ||
      base === "compose.yaml"
    ) {
      return "docker-compose";
    }

    switch (ext) {
      case "tf":
        return "terraform";
      case "pdf":
        return "pdf";
      case "docx":
      case "doc":
        return "docx";
      case "md":
      case "markdown":
        return "md";
      case "html":
      case "htm":
        return "html";
      case "txt":
        return "txt";
    }
  }

  return "unknown";
}

/**
 * Parse document content based on format
 * For PDF/DOCX, this should be called with server-parsed text
 */
export function parseDocument(
  content: string,
  format: DocumentFormat,
  filename?: string,
): ParseResult {
  switch (format) {
    case "md":
      return parseMarkdown(content, filename);
    case "html":
      return parseHtml(content);
    case "txt":
    case "unknown":
      return parseText(content, filename);
    case "pdf":
    case "docx":
      // These should be pre-parsed by server
      // If we get raw content, treat as text
      return parseText(content, filename);
    case "terraform":
    case "docker-compose":
      // IaC formats — return raw content as text; architecture-extractor handles parsing
      return parseText(content, filename);
  }
}

/**
 * Create an ImportedDocument from parsed content
 */
export function createImportedDocument(
  parseResult: ParseResult,
  source: ImportSource,
  options: {
    filename?: string;
    url?: string;
    rawContent?: string;
  },
): ImportedDocument {
  return {
    id: crypto.randomUUID(),
    source,
    format: parseResult.format,
    filename: options.filename,
    url: options.url,
    rawContent: options.rawContent || parseResult.text,
    extractedText: parseResult.text,
    metadata: parseResult.metadata,
    importedAt: new Date().toISOString(),
  };
}

/**
 * Parse file content (client-side)
 * Returns null if file needs server-side parsing
 */
export async function parseFile(file: File): Promise<ParseResult | null> {
  const format = detectFormat(file.name, file.type);

  // PDF and DOCX need server-side parsing
  if (format === "pdf" || format === "docx") {
    return null;
  }

  const content = await file.text();
  return parseDocument(content, format, file.name);
}

/**
 * Estimate reading/processing time for content
 */
export function estimateProcessingTime(wordCount: number): string {
  // Rough estimate: AI can process ~500 words/second
  const seconds = Math.ceil(wordCount / 500);

  if (seconds < 5) return "a few seconds";
  if (seconds < 30) return "less than 30 seconds";
  if (seconds < 60) return "about a minute";
  if (seconds < 120) return "1-2 minutes";
  return `about ${Math.ceil(seconds / 60)} minutes`;
}
