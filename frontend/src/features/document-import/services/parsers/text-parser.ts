/**
 * Plain Text Parser
 *
 * Handles plain text input from paste or txt files.
 */

import type { ParseResult, DocumentMetadata } from "../../types";

/**
 * Parse plain text content
 */
export function parseText(content: string, filename?: string): ParseResult {
  // Try to extract title from first line if it looks like a heading
  const lines = content.split("\n").filter((l) => l.trim());
  const firstLine = lines[0]?.trim() || "";

  // Check if first line looks like a title (short, no punctuation at end except ?)
  const looksLikeTitle =
    firstLine.length < 100 &&
    firstLine.length > 0 &&
    !/[.!,;:]$/.test(firstLine);

  const title = looksLikeTitle
    ? firstLine
    : filename?.replace(/\.txt$/i, "") || "Untitled Document";

  // Count words
  const wordCount = content.split(/\s+/).filter((w) => w.length > 0).length;

  // Try to detect sections (lines that look like headers)
  const sections = lines
    .filter((line) => {
      const trimmed = line.trim();
      // Looks like a section header: short, possibly numbered, possibly all caps
      return (
        trimmed.length > 0 &&
        trimmed.length < 80 &&
        (/^\d+\.?\s+\w/.test(trimmed) || // Numbered: "1. Introduction"
          /^[A-Z][A-Z\s]+$/.test(trimmed) || // ALL CAPS
          /^[A-Z][a-z]+(\s+[A-Z][a-z]+)*:?$/.test(trimmed)) // Title Case
      );
    })
    .slice(0, 20);

  const metadata: DocumentMetadata = {
    title,
    wordCount,
    sections: sections.length > 0 ? sections : undefined,
  };

  // Clean up the text
  const extractedText = content
    .replace(/\r\n/g, "\n")
    .replace(/\t/g, "  ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return {
    text: extractedText,
    metadata,
    format: "txt",
  };
}
