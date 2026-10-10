/**
 * Architecture Extractor Service
 *
 * Handles extraction of architectural information from documents using AI.
 * Supports sync and async (background job) modes.
 */

import { useOrgStore } from "@/stores/org-store";
import { apiPost } from "@/lib/api-client";
import type { ExtractedArchitecture } from "../types";

/** Document types that can be extracted */
export type DocumentType =
  | "srs"
  | "architecture"
  | "adr"
  | "openapi"
  | "terraform"
  | "cloudformation"
  | "threatModel"
  | "generic"
  | "auto";

/** Result of extraction including detected document type */
export interface ExtractionResult {
  extraction: ExtractedArchitecture;
  documentType: DocumentType;
}

/** Unwrap { data: T } from sendSuccess responses */
/** The organization whose AI settings and budget the request uses. */
function currentOrgId(): string | undefined {
  return useOrgStore.getState().currentOrgId ?? undefined;
}

/**
 * Extracts architecture information from text using AI.
 * Returns immediately with extraction result (sync mode).
 */
export async function extractArchitecture(
  text: string,
  options?: {
    apiEndpoint?: string;
    documentType?: DocumentType;
    existingComponentsSummary?: string;
  },
): Promise<ExtractionResult> {
  const endpoint = options?.apiEndpoint || "/api/ai/extract";

  try {
    const data = await apiPost<{ response: string; documentType?: string }>(
      endpoint,
      {
        text,
        documentType: options?.documentType || "auto",
        existingComponentsSummary: options?.existingComponentsSummary,
        organizationId: currentOrgId(),
      },
    );
    const extraction = parseExtractionResponse(data.response);
    const documentType = (data.documentType as DocumentType) || "generic";

    if (extraction.warnings && documentType !== "generic") {
      const typeLabels: Record<string, string> = {
        srs: "Software Requirements Specification (SRS)",
        adr: "Architecture Decision Record (ADR)",
        openapi: "OpenAPI/Swagger Specification",
        terraform: "Terraform Infrastructure as Code",
        cloudformation: "AWS CloudFormation Template",
        architecture: "Architecture Document",
        threatModel: "Threat Model Document",
      };
      const label = typeLabels[documentType];
      if (label) {
        extraction.warnings.unshift(`Document detected as ${label}`);
      }
    }

    return { extraction, documentType };
  } catch (error) {
    console.error("Error extracting architecture:", error);
    throw error;
  }
}

/**
 * Parses the AI response to extract JSON from markdown code blocks
 */
function parseExtractionResponse(response: string): ExtractedArchitecture {
  try {
    // Strip <think>...</think> blocks
    const cleaned = response.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();

    // Look for JSON in markdown code blocks
    const jsonMatch = cleaned.match(/```json\s*([\s\S]*?)\s*```/);
    const jsonContent = jsonMatch ? jsonMatch[1] : cleaned;

    // Try parsing, fixing trailing commas if needed
    let parsed;
    try {
      parsed = JSON.parse(jsonContent);
    } catch {
      const fixed = jsonContent.replace(/,\s*([}\]])/g, "$1");
      parsed = JSON.parse(fixed);
    }

    // Ensure all items have selected: true by default
    const components = (parsed.components || []).map((comp: unknown) => ({
      ...(comp as object),
      selected: true,
    }));

    const rawDataFlows = (parsed.dataFlows || []).map((flow: unknown) => ({
      ...(flow as object),
      selected: true,
    }));

    const componentIds = new Set(
      components.map((c: Record<string, unknown>) => c.id),
    );

    const validDataFlows = rawDataFlows.filter(
      (flow: Record<string, unknown>) => {
        const srcOk = componentIds.has(flow.sourceId);
        const tgtOk = componentIds.has(flow.targetId);
        if (!srcOk || !tgtOk) {
          console.warn(
            `[extraction] dropping dataFlow "${flow.id}": sourceId="${flow.sourceId}" (${srcOk ? "ok" : "MISSING"}), targetId="${flow.targetId}" (${tgtOk ? "ok" : "MISSING"})`,
          );
        }
        return srcOk && tgtOk;
      },
    );

    const boundaries = (parsed.boundaries || []).map((boundary: unknown) => ({
      ...(boundary as object),
      selected: true,
    }));

    // Validate sequence steps reference valid component IDs
    const sequences = (parsed.sequences || []).filter(
      (seq: Record<string, unknown>) => {
        const steps = (seq.steps || []) as Array<Record<string, unknown>>;
        return steps.every(
          (step) => componentIds.has(step.from) && componentIds.has(step.to),
        );
      },
    );

    return {
      ...parsed,
      components,
      dataFlows: validDataFlows,
      boundaries,
      sequences,
    };
  } catch (error) {
    console.error("Error parsing extraction response:", error);
    return {
      components: [],
      dataFlows: [],
      boundaries: [],
      technologies: [],
      dataTypes: [],
      confidence: 0,
      warnings: [
        `Failed to parse extraction response: ${(error as Error).message}`,
      ],
    };
  }
}
