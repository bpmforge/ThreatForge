/**
 * Code Control Scanner
 *
 * Pure function: takes file contents, runs pattern matching per-line,
 * returns DetectedControl[] with file path, 1-indexed line, snippet,
 * and the mitigation template to create.
 */

import { CONTROL_PATTERNS } from "./patterns.js";

export interface SourceFile {
  path: string;
  content: string;
}

export interface DetectedControl {
  patternId: string;
  patternName: string;
  file: string;
  /** 1-indexed */
  line: number;
  snippet: string;
  /** GitHub permalink when repoUrl is provided */
  evidenceUrl: string | null;
  evidenceTitle: string;
  controlCategory: string;
  cwe?: string;
  mitigationDescription: string;
}

/** Max snippet length to avoid bloated records */
const MAX_SNIPPET = 120;

/**
 * Scan an array of source files for known security controls.
 *
 * @param files     Array of {path, content} objects
 * @param repoUrl   Optional GitHub repo URL (e.g. "https://github.com/org/repo").
 *                  When provided, evidence URLs are formatted as blob permalinks.
 * @param branch    Branch name for the permalink (default: "main")
 * @returns         Deduplicated list of detected controls (one per pattern per file)
 */
export function scanFiles(
  files: SourceFile[],
  repoUrl?: string,
  branch = "main",
): DetectedControl[] {
  const results: DetectedControl[] = [];
  // Track (patternId, file) pairs already emitted — only keep first match per file
  const seen = new Set<string>();

  for (const file of files) {
    const lines = file.content.split("\n");

    for (const pattern of CONTROL_PATTERNS) {
      const key = `${pattern.id}:${file.path}`;
      if (seen.has(key)) continue;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!pattern.regex.test(line)) continue;

        seen.add(key);
        const lineNumber = i + 1;
        const snippet = line.trim().slice(0, MAX_SNIPPET);
        const evidenceUrl = repoUrl
          ? `${repoUrl}/blob/${branch}/${file.path}#L${lineNumber}`
          : null;

        results.push({
          patternId: pattern.id,
          patternName: pattern.name,
          file: file.path,
          line: lineNumber,
          snippet,
          evidenceUrl,
          evidenceTitle: pattern.evidenceTitle ?? pattern.name,
          controlCategory: pattern.controlCategory,
          cwe: pattern.cwe,
          mitigationDescription: pattern.mitigationDescription,
        });

        break; // first match per file is enough
      }
    }
  }

  return results;
}

/**
 * Convenience: group detected controls by controlCategory.
 */
export function groupByCategory(
  controls: DetectedControl[],
): Record<string, DetectedControl[]> {
  return controls.reduce(
    (acc, c) => {
      (acc[c.controlCategory] ??= []).push(c);
      return acc;
    },
    {} as Record<string, DetectedControl[]>,
  );
}
