"use client";

import { Button } from "@/components/ui/button";

interface ThreatReviewActionsProps {
  hasChanges: boolean;
  onAccept: () => void;
  onReject: () => void;
  onAcceptWithChanges: () => void;
}

export function ThreatReviewActions({
  hasChanges,
  onAccept,
  onReject,
  onAcceptWithChanges,
}: ThreatReviewActionsProps) {
  return (
    <div className="flex gap-2 mr-auto">
      <Button
        variant="outline"
        size="sm"
        className="border-green-300 text-green-700 hover:bg-green-50"
        onClick={onAccept}
      >
        Accept
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="border-red-300 text-red-700 hover:bg-red-50"
        onClick={onReject}
      >
        Reject
      </Button>
      {hasChanges && (
        <Button
          variant="outline"
          size="sm"
          className="border-yellow-300 text-yellow-700 hover:bg-yellow-50"
          onClick={onAcceptWithChanges}
        >
          Accept with Changes
        </Button>
      )}
    </div>
  );
}
