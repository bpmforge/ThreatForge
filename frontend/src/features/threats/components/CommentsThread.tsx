"use client";

/**
 * CommentsThread - Inline comments for a threat.
 *
 * Lists existing comments (author + timestamp) and provides a MentionInput
 * textarea to post new ones. @mentions are highlighted in rendered comments.
 * Author can delete their own comments.
 */
import { useState } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Trash2, MessageSquare } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import {
  useThreatComments,
  useCreateThreatComment,
  useDeleteThreatComment,
} from "../hooks/useThreats";
import { useMentionableMembers } from "../hooks/useMentionableMembers";
import { MentionInput } from "./MentionInput";

interface CommentsThreadProps {
  modelId: string;
  threatId: string;
}

/** Render comment body with @Name spans highlighted. */
function HighlightedBody({
  body,
  memberNames,
}: {
  body: string;
  memberNames: string[];
}) {
  if (memberNames.length === 0) {
    return <>{body}</>;
  }

  // Build a regex that matches any @MemberName (case-insensitive)
  const escaped = memberNames
    .map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|");
  const mentionRe = new RegExp(`@(${escaped})`, "gi");

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = mentionRe.exec(body)) !== null) {
    if (match.index > lastIndex) {
      parts.push(body.slice(lastIndex, match.index));
    }
    parts.push(
      <span
        key={match.index}
        className="text-blue-600 font-medium"
        aria-label={`Mention: ${match[0]}`}
      >
        {match[0]}
      </span>,
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < body.length) {
    parts.push(body.slice(lastIndex));
  }

  return <>{parts}</>;
}

export function CommentsThread({ modelId, threatId }: CommentsThreadProps) {
  const { data: session } = useSession();
  const currentUserId = session?.user?.id;
  const [draft, setDraft] = useState("");

  const { data: comments = [], isLoading } = useThreatComments(
    modelId,
    threatId,
  );
  const createComment = useCreateThreatComment(modelId, threatId);
  const deleteComment = useDeleteThreatComment(modelId, threatId);
  const { data: members = [] } = useMentionableMembers(modelId);

  const memberNames = members.map((m) => m.name);

  const handleSubmit = async () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    await createComment.mutateAsync(trimmed);
    setDraft("");
  };

  return (
    <div className="px-3 pb-3 space-y-3">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
        Comments ({comments.length})
      </div>

      {isLoading && (
        <p className="text-xs text-muted-foreground" aria-busy="true">
          Loading comments…
        </p>
      )}

      {!isLoading && comments.length > 0 && (
        <ul className="space-y-2" aria-label="Threat comments">
          {comments.map((comment) => (
            <li
              key={comment.id}
              className="rounded-md border bg-muted/30 px-3 py-2 text-xs"
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="font-medium text-foreground">
                  {comment.author.name}
                </span>
                <div className="flex items-center gap-1 text-muted-foreground">
                  <time
                    dateTime={comment.createdAt}
                    title={new Date(comment.createdAt).toLocaleString()}
                  >
                    {formatDistanceToNow(new Date(comment.createdAt), {
                      addSuffix: true,
                    })}
                  </time>
                  {currentUserId === comment.authorId && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 text-muted-foreground hover:text-destructive"
                      aria-label={`Delete comment by ${comment.author.name}`}
                      onClick={() => deleteComment.mutate(comment.id)}
                      disabled={deleteComment.isPending}
                    >
                      <Trash2 className="h-3 w-3" aria-hidden="true" />
                    </Button>
                  )}
                </div>
              </div>
              <p className="text-foreground whitespace-pre-wrap">
                <HighlightedBody
                  body={comment.body}
                  memberNames={memberNames}
                />
              </p>
            </li>
          ))}
        </ul>
      )}

      <div className="space-y-1.5">
        <MentionInput
          value={draft}
          onChange={setDraft}
          members={members}
          placeholder="Add a comment… Use @ to mention a teammate"
          className="min-h-[60px] text-xs resize-none"
          aria-label="New comment"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              void handleSubmit();
            }
          }}
        />
        <Button
          size="sm"
          className="h-7 text-xs"
          onClick={handleSubmit}
          disabled={!draft.trim() || createComment.isPending}
          aria-label="Post comment"
        >
          {createComment.isPending ? "Posting…" : "Add comment"}
        </Button>
      </div>
    </div>
  );
}
