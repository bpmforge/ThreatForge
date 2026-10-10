"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  FileEdit,
  Clock,
  AlertCircle,
  CheckCircle,
  XCircle,
  Stamp,
  Send,
} from "lucide-react";
import type { ReviewStatus } from "../types";

interface ReviewStatusBadgeProps {
  status: ReviewStatus;
  size?: "sm" | "md";
}

const statusConfig: Record<
  ReviewStatus,
  {
    variant: "default" | "secondary" | "destructive" | "outline";
    className: string;
    icon: typeof FileEdit;
    label: string;
  }
> = {
  DRAFT: {
    variant: "secondary",
    className: "",
    icon: FileEdit,
    label: "Draft",
  },
  PENDING_REVIEW: {
    variant: "outline",
    className: "border-gray-500 text-gray-700 bg-gray-50",
    icon: Send,
    label: "Pending Review",
  },
  IN_REVIEW: {
    variant: "outline",
    className: "border-blue-500 text-blue-700 bg-blue-50",
    icon: Clock,
    label: "In Review",
  },
  CHANGES_REQUESTED: {
    variant: "outline",
    className: "border-yellow-500 text-yellow-700 bg-yellow-50",
    icon: AlertCircle,
    label: "Changes Requested",
  },
  APPROVED: {
    variant: "outline",
    className: "border-green-500 text-green-700 bg-green-50",
    icon: CheckCircle,
    label: "Approved",
  },
  REJECTED: {
    variant: "destructive",
    className: "",
    icon: XCircle,
    label: "Rejected",
  },
  SIGNED_OFF: {
    variant: "outline",
    className: "border-purple-500 text-purple-700 bg-purple-50",
    icon: Stamp,
    label: "Signed Off",
  },
};

export function ReviewStatusBadge({
  status,
  size = "md",
}: ReviewStatusBadgeProps) {
  const config = statusConfig[status];
  if (!config) return null;

  const IconComponent = config.icon;

  return (
    <Badge
      variant={config.variant}
      className={cn(
        "flex items-center gap-1.5",
        config.className,
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm",
      )}
    >
      <IconComponent size={size === "sm" ? 12 : 14} aria-hidden="true" />
      {config.label}
    </Badge>
  );
}
