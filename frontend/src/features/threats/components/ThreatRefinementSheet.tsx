"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Send, Loader2, Sparkles } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { getErrorMessage } from "@/lib/errors";
import { refineThreat } from "@/features/ai/services/api";
import type { AIMessage } from "@/features/ai/types";
import type { Threat } from "../types";
import type { Severity } from "@/types/canvas";
import { parseThreatUpdate, SEVERITY_COLORS } from "./threat-refinement-utils";
import type { ChatMessage } from "./threat-refinement-utils";
import { RefinementMessageList } from "./RefinementMessageList";

interface ThreatRefinementSheetProps {
  open: boolean;
  threat: Threat | null;
  modelId: string;
  onClose: () => void;
  onApplyUpdates: (
    threatId: string,
    updates: Partial<{
      name: string;
      description: string;
      severity: Severity;
    }>,
  ) => void;
}

export function ThreatRefinementSheet({
  open,
  threat,
  modelId,
  onClose,
  onApplyUpdates,
}: ThreatRefinementSheetProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setMessages([]);
    setError(null);
    setInput("");
  }, [threat?.id]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = useCallback(async () => {
    if (!threat || !input.trim() || loading) return;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: input.trim(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);
    setError(null);

    const history: AIMessage[] = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    try {
      const response = await refineThreat(
        modelId,
        threat.id,
        userMsg.content,
        history,
      );
      const { clean, update } = parseThreatUpdate(response.message);
      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: clean,
        suggestedUpdate: update,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      setError(getErrorMessage(err, "Request failed"));
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [threat, input, loading, messages, modelId]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    },
    [sendMessage],
  );

  if (!threat) return null;

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="right"
        className="w-[420px] sm:w-[480px] flex flex-col p-0"
      >
        <SheetHeader className="px-4 pt-4 pb-3 border-b shrink-0">
          <SheetTitle className="flex items-center gap-2 text-sm">
            <Sparkles className="h-4 w-4 text-violet-500 shrink-0" />
            Refine with AI
          </SheetTitle>
          <div className="flex items-start gap-2 mt-1">
            <span
              className={cn(
                "shrink-0 mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold text-white",
                SEVERITY_COLORS[threat.severity as Severity] ||
                  "bg-muted-foreground",
              )}
            >
              {threat.severity}
            </span>
            <p className="text-xs text-foreground font-medium leading-snug line-clamp-2">
              {threat.name}
            </p>
          </div>
          {threat.description && (
            <p className="text-[11px] text-muted-foreground line-clamp-2">
              {threat.description}
            </p>
          )}
        </SheetHeader>

        <RefinementMessageList
          messages={messages}
          loading={loading}
          error={error}
          scrollRef={scrollRef}
          onApplyUpdate={(update) => onApplyUpdates(threat.id, update)}
          onDismissError={() => setError(null)}
        />

        <div className="border-t px-4 py-3 shrink-0 space-y-2">
          <Textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about this threat… (Enter to send, Shift+Enter for newline)"
            className="resize-none text-sm min-h-[64px] max-h-[120px]"
            disabled={loading}
          />
          <Button
            onClick={sendMessage}
            disabled={!input.trim() || loading}
            className="w-full h-8 text-xs gap-1.5"
          >
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            Send
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
