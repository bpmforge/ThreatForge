/**
 * Diagram Extractor Service
 *
 * Handles extraction of architecture from diagram images using Vision AI.
 */

import { ApiError, apiGet, apiPost } from "@/lib/api-client";
import { useOrgStore } from "@/stores/org-store";
import type { ExtractedArchitecture } from "../types";

/** Supported image types for diagram extraction */
type DiagramImageType = "image/png" | "image/jpeg" | "image/gif" | "image/webp";

/** Result from diagram extraction */
export interface DiagramExtractionResult {
  extraction: ExtractedArchitecture;
  diagramType: string;
  raw: string;
}

/** Vision support status */
export interface VisionSupportStatus {
  supportsVision: boolean;
  provider?: string;
  reason?: string;
  supportedProviders?: string[];
}

/**
 * Check if the current AI provider supports vision/image analysis
 */
export async function checkVisionSupport(): Promise<VisionSupportStatus> {
  try {
    const orgId = useOrgStore.getState().currentOrgId;
    return await apiGet<VisionSupportStatus>(
      orgId
        ? `/api/ai/vision-support?organizationId=${encodeURIComponent(orgId)}`
        : "/api/ai/vision-support",
    );
  } catch (error) {
    if (error instanceof ApiError) {
      return {
        supportsVision: false,
        reason: "Failed to check vision support",
      };
    }
    return { supportsVision: false, reason: "Network error" };
  }
}

/**
 * Convert a File to base64 string
 */
async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove the data URL prefix (e.g., "data:image/png;base64,")
      const base64 = result.split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Get mime type from file
 */
function getImageMimeType(file: File): DiagramImageType | null {
  const supportedTypes: DiagramImageType[] = [
    "image/png",
    "image/jpeg",
    "image/gif",
    "image/webp",
  ];
  if (supportedTypes.includes(file.type as DiagramImageType)) {
    return file.type as DiagramImageType;
  }
  return null;
}

/**
 * Extract architecture from a diagram image using Vision AI
 */
async function extractDiagram(
  imageBase64: string,
  mimeType: DiagramImageType,
): Promise<DiagramExtractionResult> {
  try {
    const data = await apiPost<{
      parsed?: Record<string, unknown>;
      response: string;
    }>("/api/ai/extract-diagram", {
      image: imageBase64,
      mimeType,
      organizationId: useOrgStore.getState().currentOrgId ?? undefined,
    });

    // If we got a parsed result, use it
    if (data.parsed) {
      const extraction = normalizeExtraction(data.parsed);
      return {
        extraction,
        diagramType: (data.parsed.diagramType as string) || "unknown",
        raw: data.response,
      };
    }

    // Otherwise try to parse from raw response
    const extraction = parseExtractionResponse(data.response);
    return {
      extraction,
      diagramType: "unknown",
      raw: data.response,
    };
  } catch (error) {
    console.error("Error extracting diagram:", error);
    return {
      extraction: {
        components: [],
        dataFlows: [],
        boundaries: [],
        technologies: [],
        dataTypes: [],
        confidence: 0,
        warnings: [`Failed to extract diagram: ${(error as Error).message}`],
      },
      diagramType: "unknown",
      raw: "",
    };
  }
}

/**
 * Extract architecture from an image file
 */
export async function extractDiagramFromFile(
  file: File,
): Promise<DiagramExtractionResult> {
  const mimeType = getImageMimeType(file);
  if (!mimeType) {
    throw new Error("Unsupported image type. Use PNG, JPEG, GIF, or WebP.");
  }

  const base64 = await fileToBase64(file);
  return extractDiagram(base64, mimeType);
}

/**
 * Parse extraction response from AI
 */
function parseExtractionResponse(response: string): ExtractedArchitecture {
  try {
    // Look for JSON in markdown code blocks
    const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
    const jsonContent = jsonMatch ? jsonMatch[1] : response;

    const parsed = JSON.parse(jsonContent);
    return normalizeExtraction(parsed);
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

/**
 * Normalize extraction result to ensure all required fields
 */
function normalizeExtraction(
  parsed: Record<string, unknown>,
): ExtractedArchitecture {
  // Ensure all components, flows, and boundaries have selected: true by default
  const components = (
    (parsed.components as Array<Record<string, unknown>>) || []
  ).map((comp) => ({
    ...comp,
    selected: true,
  }));

  const dataFlows = (
    (parsed.dataFlows as Array<Record<string, unknown>>) || []
  ).map((flow) => ({
    ...flow,
    selected: true,
  }));

  const boundaries = (
    (parsed.boundaries as Array<Record<string, unknown>>) || []
  ).map((boundary) => ({
    ...boundary,
    selected: true,
  }));

  return {
    components,
    dataFlows,
    boundaries,
    technologies: (parsed.technologies as string[]) || [],
    dataTypes: (parsed.dataTypes as string[]) || [],
    confidence: (parsed.confidence as number) || 0.5,
    warnings: (parsed.warnings as string[]) || [],
  } as ExtractedArchitecture;
}
