"use client";

import { Loader2, X, Sparkles } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { ThreatUpdateCard } from "./ThreatUpdateCard";
import type {
  ChatMessage,
  ThreatUpdateSuggestion,
} from "./threat-refinement-utils";

interface RefinementMessageListProps {
  messages: ChatMessage[];
  loading: boolean;
  error: string | null;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  onApplyUpdate: (update: ThreatUpdateSuggestion) => void;
  onDismissError: () => void;
}

export function RefinementMessageList({
  messages,
  loading,
  error,
  scrollRef,
  onApplyUpdate,
  onDismissError,
}: RefinementMessageListProps) {
  return (
    <ScrollArea className="flex-1 min-h-0 px-4">
      <div ref={scrollRef} className="py-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-8 space-y-2">
            <Sparkles className="h-8 w-8 mx-auto text-violet-400/60" />
            <p className="text-xs text-muted-foreground">
              Ask the AI to explain, refine, or improve this threat.
            </p>
            <p className="text-[10px] text-muted-foreground/70">
              e.g. &quot;Why is this CRITICAL?&quot;, &quot;What&apos;s the
              attack vector?&quot;, &quot;Make the description more
              specific&quot;
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className="space-y-2">
            <div
              className={cn(
                "rounded-lg px-3 py-2 text-sm",
                msg.role === "user"
                  ? "bg-primary text-primary-foreground ml-8"
                  : "bg-muted mr-8",
              )}
            >
              <p className="whitespace-pre-wrap leading-relaxed text-xs">
                {msg.content}
              </p>
            </div>
            {msg.suggestedUpdate && (
              <ThreatUpdateCard
                update={msg.suggestedUpdate}
                onApply={() => onApplyUpdate(msg.suggestedUpdate!)}
              />
            )}
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground mr-8">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Thinking…
          </div>
        )}

        {error && (
          <div className="text-xs text-destructive bg-destructive/10 rounded px-3 py-2 flex items-center justify-between">
            {error}
            <button type="button" onClick={onDismissError}>
              <X className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>
    </ScrollArea>
  );
}
