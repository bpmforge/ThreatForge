import type { AuditAction, AuditEntityType } from "../types";

export const actionColors: Record<AuditAction, string> = {
  CREATE: "bg-green-100 text-green-800",
  UPDATE: "bg-blue-100 text-blue-800",
  DELETE: "bg-red-100 text-red-800",
  LOGIN: "bg-purple-100 text-purple-800",
  LOGOUT: "bg-muted text-foreground",
  INVITE: "bg-yellow-100 text-yellow-800",
  REMOVE: "bg-orange-100 text-orange-800",
  ROLE_CHANGE: "bg-indigo-100 text-indigo-800",
  EXPORT: "bg-cyan-100 text-cyan-800",
  IMPORT: "bg-teal-100 text-teal-800",
};

export const entityIcons: Record<AuditEntityType, string> = {
  USER: "\u{1F464}",
  ORGANIZATION: "\u{1F3E2}",
  PROJECT: "\u{1F4C1}",
  THREAT_MODEL: "\u{1F5FA}",
  THREAT: "\u{26A0}",
  MITIGATION: "\u{1F6E1}",
  MEMBERSHIP: "\u{1F517}",
};

export function formatDetails(details: Record<string, unknown> | null): string {
  if (!details) return "";
  return Object.entries(details)
    .filter(([, v]) => v != null && v !== "")
    .map(([k, v]) => {
      const label = k.replace(/([A-Z])/g, " $1").trim();
      const val = typeof v === "object" ? JSON.stringify(v) : String(v);
      return `${label}: ${val}`;
    })
    .join("\n");
}
