/**
 * HTML Parser
 *
 * Parses HTML content and extracts text.
 * Works for web pages fetched via URL import.
 */

import type { ParseResult, DocumentMetadata } from "../../types";

/**
 * Parse HTML content and extract text
 */
export function parseHtml(html: string, url?: string): ParseResult {
  // Create a DOM parser (works in browser)
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");

  // Extract title
  const titleEl = doc.querySelector("title");
  const h1El = doc.querySelector("h1");
  const title =
    titleEl?.textContent?.trim() || h1El?.textContent?.trim() || url;

  // Extract sections from headings
  const headings = doc.querySelectorAll("h2, h3");
  const sections = Array.from(headings)
    .map((h) => h.textContent?.trim())
    .filter((s): s is string => !!s)
    .slice(0, 20); // Limit to 20 sections

  // Remove scripts, styles, nav, footer, etc.
  const elementsToRemove = doc.querySelectorAll(
    "script, style, nav, footer, header, aside, noscript, iframe, svg, canvas",
  );
  elementsToRemove.forEach((el) => el.remove());

  // Get main content area if it exists
  const mainContent =
    doc.querySelector("main") ||
    doc.querySelector("article") ||
    doc.querySelector('[role="main"]') ||
    doc.body;

  // Extract text content
  let text = mainContent?.textContent || "";

  // Clean up whitespace
  text = text
    .replace(/\s+/g, " ")
    .replace(/\n\s*\n/g, "\n\n")
    .trim();

  // Count words
  const wordCount = text.split(/\s+/).filter((w) => w.length > 0).length;

  const metadata: DocumentMetadata = {
    title,
    wordCount,
    sections: sections.length > 0 ? sections : undefined,
  };

  return {
    text,
    metadata,
    format: "html",
  };
}

/**
 * Convert HTML to a more readable format
 * Preserves some structure for better AI understanding
 */
export function htmlToStructuredText(html: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");

  // Remove unwanted elements
  const elementsToRemove = doc.querySelectorAll(
    "script, style, nav, footer, header, aside, noscript, iframe",
  );
  elementsToRemove.forEach((el) => el.remove());

  const lines: string[] = [];

  function processNode(node: Node, depth = 0): void {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent?.trim();
      if (text) {
        lines.push(text);
      }
      return;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return;

    const el = node as Element;
    const tagName = el.tagName.toLowerCase();

    // Handle headings
    if (/^h[1-6]$/.test(tagName)) {
      const level = parseInt(tagName[1], 10);
      const prefix = "#".repeat(level);
      lines.push(`\n${prefix} ${el.textContent?.trim()}\n`);
      return;
    }

    // Handle lists
    if (tagName === "li") {
      lines.push(`- ${el.textContent?.trim()}`);
      return;
    }

    // Handle paragraphs
    if (tagName === "p") {
      lines.push(`\n${el.textContent?.trim()}\n`);
      return;
    }

    // Handle code blocks
    if (tagName === "pre" || tagName === "code") {
      lines.push(`\n[Code]: ${el.textContent?.trim()}\n`);
      return;
    }

    // Handle tables - extract as structured text
    if (tagName === "table") {
      lines.push("\n[Table]:");
      const rows = el.querySelectorAll("tr");
      rows.forEach((row) => {
        const cells = Array.from(row.querySelectorAll("th, td"))
          .map((cell) => cell.textContent?.trim())
          .join(" | ");
        lines.push(cells);
      });
      lines.push("");
      return;
    }

    // Process children
    node.childNodes.forEach((child) => processNode(child, depth + 1));
  }

  const mainContent =
    doc.querySelector("main") ||
    doc.querySelector("article") ||
    doc.querySelector('[role="main"]') ||
    doc.body;

  if (mainContent) {
    processNode(mainContent);
  }

  return lines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
