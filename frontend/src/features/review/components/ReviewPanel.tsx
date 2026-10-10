"use client";

import { useState } from "react";
import {
  useModelReviews,
  useReviewActivity,
  useReviewMutations,
} from "../hooks/useReview";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { MentionInput } from "@/features/threats/components/MentionInput";
import { useMentionableMembers } from "@/features/threats/hooks/useMentionableMembers";
import {
  Loader2,
  History,
  FileText,
  MessageSquare,
  Send,
  CheckCircle2,
} from "lucide-react";
import { ReviewStatusBadge } from "./ReviewStatusBadge";
import { ReviewerList } from "./ReviewerList";
import { ReviewHistoryTimeline } from "./ReviewHistoryTimeline";
import { ModelSignOffCard } from "./ModelSignOffCard";
import type { ReviewComment } from "../types";

interface ReviewPanelProps {
  modelId: string;
}

export function ReviewPanel({ modelId }: ReviewPanelProps) {
  const { data: reviews, isLoading } = useModelReviews(modelId);
  const { addComment, isAddingComment } = useReviewMutations();
  const [newComment, setNewComment] = useState("");
  const { data: members = [] } = useMentionableMembers(modelId);

  const review = reviews?.[0];
  const { data: activity } = useReviewActivity(review?.id);

  const handleAddComment = () => {
    if (!newComment.trim() || !review) return;
    addComment(
      { reviewId: review.id, content: newComment.trim() },
      { onSuccess: () => setNewComment("") },
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!review) {
    return (
      <ScrollArea className="h-full">
        <div className="p-3 space-y-4">
          <ModelSignOffCard modelId={modelId} />
          <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
            <FileText className="h-12 w-12 mb-4 opacity-50" />
            <p>No review data available.</p>
            <p className="text-sm mt-1">
              Submit this model for review to get started.
            </p>
          </div>
        </div>
      </ScrollArea>
    );
  }

  const canEditReviewers =
    review.status === "DRAFT" || review.status === "PENDING_REVIEW";
  const unresolvedComments = review.comments.filter((c) => !c.isResolved);
  const resolvedComments = review.comments.filter((c) => c.isResolved);

  return (
    <ScrollArea className="h-full">
      <div className="p-3 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <History className="h-4 w-4" />
            Review
          </h3>
          <ReviewStatusBadge status={review.status} />
        </div>
        {review.description && (
          <p className="text-sm text-muted-foreground">{review.description}</p>
        )}

        <ModelSignOffCard modelId={modelId} />

        {/* Reviewers Section */}
        <div>
          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
            Reviewers
          </h4>
          <ReviewerList
            reviewers={review.reviewers}
            canEdit={canEditReviewers}
          />
        </div>

        {/* Comments Section */}
        <div>
          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
            <MessageSquare className="h-3 w-3 inline mr-1" />
            Comments
            {unresolvedComments.length > 0 && (
              <span className="ml-1 text-amber-600">
                ({unresolvedComments.length} unresolved)
              </span>
            )}
          </h4>

          {review.comments.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2">
              No comments yet. Add a comment to start the discussion.
            </p>
          ) : (
            <div className="space-y-2">
              {unresolvedComments.map((comment) => (
                <CommentCard key={comment.id} comment={comment} />
              ))}
              {resolvedComments.length > 0 && (
                <details className="text-xs">
                  <summary className="text-muted-foreground cursor-pointer hover:text-foreground py-1">
                    {resolvedComments.length} resolved comment
                    {resolvedComments.length !== 1 ? "s" : ""}
                  </summary>
                  <div className="space-y-2 mt-2 opacity-60">
                    {resolvedComments.map((comment) => (
                      <CommentCard key={comment.id} comment={comment} />
                    ))}
                  </div>
                </details>
              )}
            </div>
          )}

          {/* Add Comment */}
          <div className="mt-3 space-y-2">
            <MentionInput
              value={newComment}
              onChange={setNewComment}
              members={members}
              placeholder="Add a review comment... use @ to mention a teammate"
              className="min-h-[60px] text-xs resize-none"
              aria-label="New review comment"
            />
            <Button
              size="sm"
              className="h-7 text-xs"
              disabled={!newComment.trim() || isAddingComment}
              onClick={handleAddComment}
            >
              <Send className="h-3 w-3 mr-1" />
              Comment
            </Button>
          </div>
        </div>

        {/* History Section */}
        {activity && activity.length > 0 && (
          <div>
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
              History
            </h4>
            <ReviewHistoryTimeline events={activity} />
          </div>
        )}
      </div>
    </ScrollArea>
  );
}

function CommentCard({ comment }: { comment: ReviewComment }) {
  return (
    <div className="rounded-lg border p-2.5 text-xs space-y-1">
      <div className="flex items-center justify-between">
        <span className="font-medium">{comment.userName ?? "Unknown"}</span>
        <div className="flex items-center gap-1.5">
          {comment.isResolved && (
            <CheckCircle2 className="h-3 w-3 text-emerald-500" />
          )}
          <span className="text-muted-foreground text-[10px]">
            {new Date(comment.createdAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })}
          </span>
        </div>
      </div>
      <p className="text-muted-foreground leading-relaxed">{comment.content}</p>
      {comment.referencedItemType && (
        <span className="text-[10px] text-muted-foreground">
          on {comment.referencedItemType.toLowerCase().replace(/_/g, " ")}
        </span>
      )}
    </div>
  );
}
