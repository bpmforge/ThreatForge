"use client";

/**
 * StreamingChatPanel — AI chat with streaming responses.
 */
import { useAIStreaming } from "../hooks/useAIStreaming";
import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Square, Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";

interface StreamingChatPanelProps {
  modelId: string;
  onClose?: () => void;
}

export function StreamingChatPanel({ modelId }: StreamingChatPanelProps) {
  const [inputValue, setInputValue] = useState("");
  const { state, content, error, startStream, abort, reset } = useAIStreaming();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [content, state]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || state === "streaming") return;

    startStream(modelId, inputValue);
    setInputValue("");
  };

  const handleAbort = () => {
    abort();
    toast.info("Stream aborted");
  };

  return (
    <div className="flex flex-col h-full">
      <ScrollArea className="flex-1 p-3">
        {content ? (
          <div className="whitespace-pre-wrap break-words overflow-x-auto text-sm leading-relaxed">
            {content}
          </div>
        ) : (
          <div className="text-muted-foreground text-center py-8 text-sm">
            Ask a question about your threat model to start a conversation.
          </div>
        )}
        <div ref={bottomRef} />
      </ScrollArea>

      {error && (
        <div className="px-3 py-2 bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 text-xs border-t">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="p-3 border-t shrink-0">
        <div className="flex gap-1.5">
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Ask about your model..."
            disabled={state === "streaming"}
            className="h-8 text-sm"
            aria-label="Chat message"
          />
          {state === "streaming" ? (
            <Button
              type="button"
              size="sm"
              variant="destructive"
              className="h-8 w-8 p-0 shrink-0"
              onClick={handleAbort}
              aria-label="Stop streaming"
            >
              <Square className="h-3.5 w-3.5" />
            </Button>
          ) : (
            <Button
              type="submit"
              size="sm"
              className="h-8 w-8 p-0 shrink-0"
              disabled={!inputValue.trim()}
              aria-label="Send message"
            >
              <Send className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </form>

      <div className="px-3 py-1.5 text-[10px] text-muted-foreground border-t flex items-center justify-between shrink-0">
        <span className="flex items-center gap-1">
          {state === "idle" && "Ready"}
          {state === "connecting" && "Connecting..."}
          {state === "streaming" && (
            <>
              <Loader2 className="h-3 w-3 animate-spin" />
              Streaming
            </>
          )}
          {state === "complete" && "Complete"}
          {state === "error" && "Error"}
        </span>
        {content && state !== "streaming" && (
          <button
            type="button"
            onClick={reset}
            className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Clear chat"
          >
            <RotateCcw className="h-3 w-3" />
            Clear
          </button>
        )}
      </div>
    </div>
  );
}
