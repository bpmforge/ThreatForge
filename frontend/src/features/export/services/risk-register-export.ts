/**
 * Risk Register CSV Export
 *
 * Generates a downloadable CSV risk register from a threat model.
 * Compatible with GRC tools (ServiceNow, Archer, OneTrust).
 */

import { apiGet } from "@/lib/api-client";

interface ThreatForExport {
  id: string;
  name: string;
  description?: string | null;
  severity: string;
  status: string;
  strideCategories: string;
  componentNodeId?: string | null;
  /** Citation-verifier rollup — compliance auditors read this column. */
  verificationStatus?:
    | "PENDING"
    | "VERIFIED"
    | "UNVERIFIED"
    | "PHANTOM"
    | "EXEMPT"
    | null;
  /** Document section anchors cited for this threat */
  citationAnchors?: string[];
  mitigations: Array<{
    description: string;
    status: string;
    strategy: string;
    effectivenessScore?: number | null;
  }>;
}

/**
 * Format citation-verifier rollup status for the compliance CSV.
 * Auditor-facing strings — must be unambiguous without legend lookup.
 */
function formatVerificationStatus(
  status: ThreatForExport["verificationStatus"],
): string {
  switch (status) {
    case "VERIFIED":
      return "Verified";
    case "UNVERIFIED":
      return "UNVERIFIED — review required";
    case "PHANTOM":
      return "UNVERIFIED — source not found";
    case "EXEMPT":
      return "Exempt";
    case "PENDING":
    case null:
    case undefined:
    default:
      return "Pending verification";
  }
}

function escapeCSV(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function calcResidualRisk(mitigations: ThreatForExport["mitigations"]): number {
  const scores = mitigations
    .filter((m) => m.effectivenessScore != null && m.status === "IMPLEMENTED")
    .map((m) => m.effectivenessScore!);
  if (scores.length === 0) return 100;
  let remaining = 1;
  for (const s of scores) {
    remaining *= 1 - Math.min(s, 0.85);
  }
  return Math.round(Math.min(remaining, 0.95) * 100);
}

/**
 * Generate and download a CSV risk register.
 */
export async function exportRiskRegister(modelId: string): Promise<void> {
  const data = await apiGet<{
    threats?: ThreatForExport[];
    modelName?: string;
  }>(`/api/v1/threat-models/${modelId}/threats`);
  const threats: ThreatForExport[] = data.threats || [];
  const modelName = data.modelName || "ThreatModel";

  const headers = [
    "Risk ID",
    "Threat Name",
    "Verification Status",
    "Citation Anchors",
    "Description",
    "Severity",
    "STRIDE Categories",
    "Status",
    "Component",
    "Mitigation Count",
    "Completed Mitigations",
    "Mitigation Details",
    "Cumulative Effectiveness %",
    "Residual Risk %",
    "Treatment Decision",
    "CWE IDs",
    "OWASP IDs",
  ];

  const rows = threats.map((t) => {
    const completed = t.mitigations.filter(
      (m) => m.status === "COMPLETED" || m.status === "VERIFIED",
    ).length;
    const effectiveness = 100 - calcResidualRisk(t.mitigations);
    const residual = calcResidualRisk(t.mitigations);
    const treatment =
      t.status === "ACCEPTED"
        ? "Accept"
        : t.status === "MITIGATED"
          ? "Mitigate"
          : t.status === "NOT_APPLICABLE"
            ? "N/A"
            : "In Progress";

    const mitigationDetails = t.mitigations
      .map(
        (m) =>
          `[${m.status}] ${m.description}${m.effectivenessScore ? ` (${Math.round(m.effectivenessScore * 100)}%)` : ""}`,
      )
      .join("; ");

    let categories: string[] = [];
    try {
      categories = JSON.parse(t.strideCategories || "[]");
    } catch {
      categories = [];
    }

    return [
      t.id,
      t.name,
      formatVerificationStatus(t.verificationStatus),
      (t.citationAnchors ?? []).join(", "),
      t.description || "",
      t.severity,
      (Array.isArray(categories) ? categories : []).join(", "),
      t.status,
      t.componentNodeId || "",
      String(t.mitigations.length),
      String(completed),
      mitigationDetails,
      String(effectiveness),
      String(residual),
      treatment,
      "", // CWE IDs — would need to be added
      "", // OWASP IDs
    ];
  });

  const csv = [
    headers.map(escapeCSV).join(","),
    ...rows.map((row) => row.map(escapeCSV).join(",")),
  ].join("\n");

  // Download
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${modelName.replace(/\s+/g, "_")}_Risk_Register.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
