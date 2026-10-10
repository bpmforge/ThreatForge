/**
 * Markdown Parser
 *
 * Parses markdown files and extracts text content.
 */

import type { ParseResult, DocumentMetadata } from "../../types";

/**
 * Parse markdown content and extract text
 */
export function parseMarkdown(content: string, filename?: string): ParseResult {
  // Extract title from first H1 if present
  const titleMatch = content.match(/^#\s+(.+)$/m);
  const title = titleMatch
    ? titleMatch[1].trim()
    : filename?.replace(/\.md$/i, "");

  // Extract sections (H2 headers)
  const sectionMatches = content.matchAll(/^##\s+(.+)$/gm);
  const sections = Array.from(sectionMatches).map((m) => m[1].trim());

  // Count words (rough estimate)
  const wordCount = content
    .replace(/[#*_`\[\]()]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 0).length;

  const metadata: DocumentMetadata = {
    title,
    wordCount,
    sections: sections.length > 0 ? sections : undefined,
  };

  // For markdown, the raw content is already text
  // Just clean up some formatting for better AI processing
  const extractedText = content
    // Remove code blocks but keep content
    .replace(/```[\s\S]*?```/g, (match) => {
      const code = match.replace(/```\w*\n?/, "").replace(/```$/, "");
      return `[Code Block]: ${code}`;
    })
    // Remove inline code backticks
    .replace(/`([^`]+)`/g, "$1")
    // Remove image syntax but keep alt text
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "[Image: $1]")
    // Remove link syntax but keep text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    // Remove bold/italic markers
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    // Clean up extra whitespace
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return {
    text: extractedText,
    metadata,
    format: "md",
  };
}
