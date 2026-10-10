"use client";

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Reviewer } from "../types";

interface ReviewerListProps {
  reviewers: Reviewer[];
  onRemove?: (userId: string) => void;
  canEdit?: boolean;
}

export function ReviewerList({
  reviewers,
  onRemove,
  canEdit = false,
}: ReviewerListProps) {
  if (reviewers.length === 0) {
    return (
      <div className="text-sm text-muted-foreground py-4 text-center">
        No reviewers assigned
      </div>
    );
  }
  const getDecisionBadge = (decision?: Reviewer["decision"]) => {
    if (!decision) return null;
    switch (decision) {
      case "APPROVE":
        return <Badge className="bg-green-500 text-xs">Approved</Badge>;
      case "REQUEST_CHANGES":
        return (
          <Badge className="bg-yellow-500 text-xs">Changes Requested</Badge>
        );
      case "REJECT":
        return (
          <Badge variant="destructive" className="text-xs">
            Rejected
          </Badge>
        );
      case "SIGN_OFF":
        return <Badge className="bg-purple-500 text-xs">Signed Off</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      {reviewers.map((reviewer) => (
        <div
          key={reviewer.userId}
          className="flex items-center gap-2 bg-secondary/50 rounded-full px-3 py-1.5 text-sm"
        >
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center text-white text-xs font-medium">
              {reviewer.userName.charAt(0).toUpperCase()}
            </div>
            <span className="font-medium">{reviewer.userName}</span>
            <Badge variant="outline" className="text-xs">
              {reviewer.role.replace(/_/g, " ")}
            </Badge>
            {reviewer.required && (
              <span className="text-xs text-muted-foreground">(Required)</span>
            )}
            {getDecisionBadge(reviewer.decision)}
          </div>
          {canEdit && onRemove && (
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 rounded-full hover:bg-destructive/20"
              aria-label={`Remove ${reviewer.userName}`}
              onClick={() => onRemove(reviewer.userId)}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}
