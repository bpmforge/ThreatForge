"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";
import type { CatalogThreat, ThreatSource } from "../types";
import type { StrideCategory, Severity } from "@/types/canvas";

interface ParseResult {
  threats: CatalogThreat[];
  errors: string[];
  warnings: string[];
}

export const SAMPLE_JSON = `[
  {
    "id": "CUSTOM-001",
    "name": "Custom Threat Example",
    "description": "Description of the threat",
    "strideCategories": ["TAMPERING", "INFORMATION_DISCLOSURE"],
    "severity": "HIGH",
    "tags": ["custom", "example"]
  }
]`;

export const SAMPLE_CSV = `id,name,description,strideCategories,severity,tags
CUSTOM-001,Custom Threat,Description here,TAMPERING;INFORMATION_DISCLOSURE,HIGH,custom;example`;

const VALID_SEVERITIES: Severity[] = [
  "CRITICAL",
  "HIGH",
  "MEDIUM",
  "LOW",
  "INFO",
];
const VALID_CATEGORIES: StrideCategory[] = [
  "SPOOFING",
  "TAMPERING",
  "REPUDIATION",
  "INFORMATION_DISCLOSURE",
  "DENIAL_OF_SERVICE",
  "ELEVATION_OF_PRIVILEGE",
];

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function validateAndTransform(
  item: Record<string, unknown>,
  index: number,
  errors: string[],
  warnings: string[],
): CatalogThreat | null {
  const prefix = `Row ${index + 1}:`;
  if (!item.id || typeof item.id !== "string") {
    errors.push(`${prefix} Missing or invalid 'id'`);
    return null;
  }
  if (!item.name || typeof item.name !== "string") {
    errors.push(`${prefix} Missing or invalid 'name'`);
    return null;
  }
  const severity = String(item.severity || "MEDIUM").toUpperCase() as Severity;
  if (!VALID_SEVERITIES.includes(severity)) {
    warnings.push(
      `${prefix} Invalid severity '${item.severity}', defaulting to MEDIUM`,
    );
  }
  const categories = (
    Array.isArray(item.strideCategories) ? item.strideCategories : []
  )
    .map((c) => String(c).toUpperCase())
    .filter((c): c is StrideCategory =>
      VALID_CATEGORIES.includes(c as StrideCategory),
    );
  if (categories.length === 0) {
    warnings.push(
      `${prefix} No valid STRIDE categories, defaulting to TAMPERING`,
    );
    categories.push("TAMPERING");
  }
  return {
    id: `CUSTOM-${item.id}`,
    source: "BUILT_IN" as ThreatSource,
    name: String(item.name),
    description: String(item.description || ""),
    strideCategories: categories,
    severity: VALID_SEVERITIES.includes(severity) ? severity : "MEDIUM",
    applicableTo: [],
    tags: Array.isArray(item.tags)
      ? item.tags.map(String)
      : typeof item.tags === "string"
        ? item.tags.split(";")
        : ["custom"],
    references: [],
  };
}

export function useCustomSourceImport(
  onImport: (threats: CatalogThreat[], sourceName: string) => void,
  onOpenChange: (open: boolean) => void,
) {
  const [sourceName, setSourceName] = useState("");
  const [jsonInput, setJsonInput] = useState("");
  const [csvInput, setCsvInput] = useState("");
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [activeTab, setActiveTab] = useState<"json" | "csv" | "file">("json");

  const resetState = useCallback(() => {
    setSourceName("");
    setJsonInput("");
    setCsvInput("");
    setParseResult(null);
  }, []);

  const parseJSON = useCallback((input: string): ParseResult => {
    const errors: string[] = [];
    const warnings: string[] = [];
    const threats: CatalogThreat[] = [];
    try {
      const parsed = JSON.parse(input);
      const items = Array.isArray(parsed) ? parsed : [parsed];
      items.forEach((item, index) => {
        const threat = validateAndTransform(item, index, errors, warnings);
        if (threat) threats.push(threat);
      });
    } catch (e) {
      errors.push(`Invalid JSON: ${(e as Error).message}`);
    }
    return { threats, errors, warnings };
  }, []);

  const parseCSV = useCallback((input: string): ParseResult => {
    const errors: string[] = [];
    const warnings: string[] = [];
    const threats: CatalogThreat[] = [];
    const lines = input.trim().split("\n");
    if (lines.length < 2) {
      errors.push("CSV must have header row and at least one data row");
      return { threats, errors, warnings };
    }
    const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
    const requiredHeaders = [
      "id",
      "name",
      "description",
      "stridecategories",
      "severity",
    ];
    const missingHeaders = requiredHeaders.filter((h) => !headers.includes(h));
    if (missingHeaders.length > 0) {
      errors.push(`Missing required columns: ${missingHeaders.join(", ")}`);
      return { threats, errors, warnings };
    }
    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      const item: Record<string, string> = {};
      headers.forEach((h, idx) => {
        item[h] = values[idx] || "";
      });
      const threat = validateAndTransform(
        {
          id: item.id,
          name: item.name,
          description: item.description,
          strideCategories: item.stridecategories?.split(";") || [],
          severity: item.severity,
          tags: item.tags?.split(";") || [],
        },
        i,
        errors,
        warnings,
      );
      if (threat) threats.push(threat);
    }
    return { threats, errors, warnings };
  }, []);

  const handleParse = useCallback(() => {
    const input = activeTab === "json" ? jsonInput : csvInput;
    if (!input.trim()) {
      toast.error("Please enter data to parse");
      return;
    }
    const result = activeTab === "json" ? parseJSON(input) : parseCSV(input);
    setParseResult(result);
    if (result.errors.length > 0)
      toast.error(`Found ${result.errors.length} error(s)`);
    else if (result.threats.length > 0)
      toast.success(`Parsed ${result.threats.length} threat(s)`);
  }, [activeTab, jsonInput, csvInput, parseJSON, parseCSV]);

  const handleImport = useCallback(() => {
    if (!parseResult || parseResult.threats.length === 0) {
      toast.error("No valid threats to import");
      return;
    }
    if (!sourceName.trim()) {
      toast.error("Please provide a source name");
      return;
    }
    onImport(parseResult.threats, sourceName);
    toast.success(
      `Imported ${parseResult.threats.length} threats from "${sourceName}"`,
    );
    onOpenChange(false);
    resetState();
  }, [parseResult, sourceName, onImport, onOpenChange, resetState]);

  const handleFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        if (file.name.endsWith(".json")) {
          setJsonInput(content);
          setActiveTab("json");
        } else if (file.name.endsWith(".csv")) {
          setCsvInput(content);
          setActiveTab("csv");
        }
        setParseResult(null);
      };
      reader.readAsText(file);
    },
    [],
  );

  return {
    sourceName,
    setSourceName,
    jsonInput,
    setJsonInput,
    csvInput,
    setCsvInput,
    parseResult,
    setParseResult,
    activeTab,
    setActiveTab,
    handleParse,
    handleImport,
    handleFileUpload,
  };
}
