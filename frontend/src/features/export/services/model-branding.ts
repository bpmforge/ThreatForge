import { apiGet } from "@/lib/api-client";
import type { ReportBranding } from "./pdf/branding";

/** Org branding for a model's report; undefined on failure (export unbranded). */
export async function fetchModelBranding(
  modelId: string | null | undefined,
): Promise<ReportBranding | undefined> {
  if (!modelId) return undefined;
  try {
    return await apiGet<ReportBranding>(
      `/api/threat-models/${modelId}/branding`,
    );
  } catch {
    return undefined;
  }
}
