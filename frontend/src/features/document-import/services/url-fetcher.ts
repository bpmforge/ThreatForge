/**
 * URL Fetcher Service
 *
 * Fetches content from URLs for import.
 * Uses a proxy API route to avoid CORS issues.
 */

import type { ParseResult } from "../types";
import { parseHtml, htmlToStructuredText } from "./parsers/html-parser";
import { parseMarkdown } from "./parsers/markdown-parser";
import { detectFormat } from "./document-parser";
import { apiPost } from "@/lib/api-client";

interface FetchUrlResult {
  content: string;
  contentType: string;
  url: string;
  finalUrl: string; // After redirects
}

/**
 * Fetch content from a URL via proxy API
 */
async function fetchUrl(url: string): Promise<FetchUrlResult> {
  // Validate URL
  try {
    new URL(url);
  } catch {
    throw new Error("Invalid URL format");
  }

  // Use proxy API to avoid CORS
  const data = await apiPost<{
    content: string;
    contentType?: string;
    finalUrl?: string;
  }>("/api/proxy/fetch", { url });

  return {
    content: data.content,
    contentType: data.contentType || "text/html",
    url,
    finalUrl: data.finalUrl || url,
  };
}

/**
 * Fetch and parse a URL
 */
export async function fetchAndParseUrl(url: string): Promise<ParseResult> {
  const result = await fetchUrl(url);

  // Detect format from content type and URL
  const format = detectFormat(result.finalUrl, result.contentType);

  // Parse based on format
  if (format === "md") {
    return parseMarkdown(result.content);
  }

  if (format === "html" || result.contentType.includes("html")) {
    // Convert HTML to structured text for better AI processing
    const structuredText = htmlToStructuredText(result.content);
    const htmlResult = parseHtml(result.content, result.finalUrl);

    return {
      ...htmlResult,
      text: structuredText,
    };
  }

  // Default to treating as plain text
  return {
    text: result.content,
    metadata: {
      title: result.finalUrl,
      wordCount: result.content.split(/\s+/).length,
    },
    format: "txt",
  };
}

/**
 * Extract domain from URL for display
 */
export function extractDomain(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname;
  } catch {
    return url;
  }
}

/**
 * Check if URL is from a known documentation platform
 */
export function isKnownDocPlatform(url: string): {
  platform: string;
  type: string;
} | null {
  const lowerUrl = url.toLowerCase();

  if (lowerUrl.includes("confluence")) {
    return { platform: "Confluence", type: "wiki" };
  }
  if (lowerUrl.includes("notion.site") || lowerUrl.includes("notion.so")) {
    return { platform: "Notion", type: "wiki" };
  }
  if (lowerUrl.includes("github.com") && lowerUrl.includes("/blob/")) {
    return { platform: "GitHub", type: "file" };
  }
  if (lowerUrl.includes("github.com") && lowerUrl.includes("/wiki/")) {
    return { platform: "GitHub Wiki", type: "wiki" };
  }
  if (lowerUrl.includes("docs.google.com")) {
    return { platform: "Google Docs", type: "document" };
  }
  if (lowerUrl.includes("sharepoint.com")) {
    return { platform: "SharePoint", type: "document" };
  }

  return null;
}
