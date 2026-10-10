"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Send,
  MessageCircle,
  CheckCircle,
  XCircle,
  UserPlus,
  UserMinus,
  ClipboardCheck,
  Stamp,
  AlertCircle,
  Clock,
  Mail,
} from "lucide-react";
import type { ReviewActivity, ReviewActivityAction } from "../types";

interface ReviewHistoryTimelineProps {
  events: ReviewActivity[];
}

export function ReviewHistoryTimeline({ events }: ReviewHistoryTimelineProps) {
  const getEventIcon = (action: ReviewActivityAction) => {
    switch (action) {
      case "REVIEW_REQUESTED":
        return <Send className="h-4 w-4" />;
      case "COMMENT_ADDED":
      case "COMMENT_RESOLVED":
        return <MessageCircle className="h-4 w-4" />;
      case "APPROVED":
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case "CHANGES_REQUESTED":
        return <XCircle className="h-4 w-4 text-yellow-600" />;
      case "REJECTED":
        return <XCircle className="h-4 w-4 text-red-600" />;
      case "REVIEWER_ASSIGNED":
        return <UserPlus className="h-4 w-4" />;
      case "REVIEWER_REMOVED":
        return <UserMinus className="h-4 w-4" />;
      case "REVIEW_STARTED":
        return <Clock className="h-4 w-4 text-blue-600" />;
      case "CHECKLIST_ITEM_COMPLETED":
        return <ClipboardCheck className="h-4 w-4" />;
      case "SIGNED_OFF":
        return <Stamp className="h-4 w-4 text-purple-600" />;
      case "REVIEW_COMPLETED":
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case "REVIEW_EXPIRED":
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      case "REMINDER_SENT":
        return <Mail className="h-4 w-4" />;
      default:
        return <MessageCircle className="h-4 w-4" />;
    }
  };

  const getActionDescription = (event: ReviewActivity): string => {
    const actor = event.userName || "System";
    switch (event.action) {
      case "REVIEW_REQUESTED":
        return `${actor} requested a review`;
      case "REVIEWER_ASSIGNED":
        return `${actor} was assigned as a reviewer`;
      case "REVIEWER_REMOVED":
        return `${actor} was removed as a reviewer`;
      case "REVIEW_STARTED":
        return `${actor} started reviewing`;
      case "COMMENT_ADDED":
        return `${actor} added a comment`;
      case "COMMENT_RESOLVED":
        return `${actor} resolved a comment`;
      case "CHECKLIST_ITEM_COMPLETED":
        return `${actor} completed a checklist item`;
      case "DECISION_MADE":
        return `${actor} submitted their decision`;
      case "CHANGES_REQUESTED":
        return `${actor} requested changes`;
      case "APPROVED":
        return `${actor} approved the review`;
      case "REJECTED":
        return `${actor} rejected the review`;
      case "SIGNED_OFF":
        return `${actor} signed off on the model`;
      case "REVIEW_COMPLETED":
        return "Review completed";
      case "REVIEW_EXPIRED":
        return "Review expired";
      case "REMINDER_SENT":
        return `Reminder sent to ${actor}`;
      default:
        return String(event.action).replace(/_/g, " ").toLowerCase();
    }
  };

  if (events.length === 0) {
    return (
      <div className="text-sm text-muted-foreground py-4 text-center">
        No activity yet
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border transform -translate-x-1/2" />

      <div className="space-y-6">
        {events.map((event, index) => (
          <div key={event.id || index} className="relative flex items-start">
            <div className="relative z-10 flex items-center justify-center w-8 h-8 rounded-full bg-background border-2 border-border">
              {getEventIcon(event.action)}
            </div>

            <div className="ml-4 flex-1 pb-6">
              <div className="flex items-start gap-3">
                {event.userName && (
                  <Avatar className="h-8 w-8">
                    <AvatarFallback>
                      {event.userName.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                )}

                <div className="flex-1 min-w-0">
                  <p className="text-sm text-muted-foreground">
                    {getActionDescription(event)}
                  </p>

                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {new Date(event.createdAt).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
