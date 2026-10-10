import {
  CheckCircle2,
  Circle,
  Clock,
  AlertTriangle,
  Shield,
} from "lucide-react";

export interface RemediationItem {
  id: string;
  threatName: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  status: "IDENTIFIED" | "PLANNED" | "IN_PROGRESS" | "IMPLEMENTED" | "VERIFIED";
  assignee?: string;
  dueDate?: string;
  mitigationDescription?: string;
  verificationMethod?: string;
  verifiedAt?: string;
  linkedIssue?: { url: string; key: string };
  linkedPR?: { url: string; number: number };
  daysOpen: number;
}

export const STATUS_CONFIG = {
  IDENTIFIED: {
    icon: AlertTriangle,
    color: "text-red-500",
    bg: "bg-red-50 dark:bg-red-950",
    label: "Identified",
  },
  PLANNED: {
    icon: Clock,
    color: "text-amber-500",
    bg: "bg-amber-50 dark:bg-amber-950",
    label: "Planned",
  },
  IN_PROGRESS: {
    icon: Circle,
    color: "text-blue-500",
    bg: "bg-blue-50 dark:bg-blue-950",
    label: "In Progress",
  },
  IMPLEMENTED: {
    icon: Shield,
    color: "text-purple-500",
    bg: "bg-purple-50 dark:bg-purple-950",
    label: "Implemented",
  },
  VERIFIED: {
    icon: CheckCircle2,
    color: "text-green-500",
    bg: "bg-green-50 dark:bg-green-950",
    label: "Verified",
  },
};

export const STATUS_ORDER: RemediationItem["status"][] = [
  "IDENTIFIED",
  "PLANNED",
  "IN_PROGRESS",
  "IMPLEMENTED",
  "VERIFIED",
];
