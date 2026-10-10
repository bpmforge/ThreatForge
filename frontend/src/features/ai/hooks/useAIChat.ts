import { getErrorMessage } from "@/lib/errors";
/**
 * Hook for AI chat functionality
 */
import { useState, useCallback } from "react";
import type { AIMessage } from "../types";
import * as api from "../services/api";

interface UseAIChatOptions {
  modelId: string | null;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export function useAIChat({ modelId }: UseAIChatOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!modelId || !content.trim()) return;

      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: content.trim(),
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setLoading(true);
      setError(null);

      // Build history for API
      const history: AIMessage[] = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      try {
        const response = await api.chat(modelId, content.trim(), history);

        const assistantMessage: ChatMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: response.message,
          timestamp: new Date(),
        };

        setMessages((prev) => [...prev, assistantMessage]);
      } catch (err) {
        setError(getErrorMessage(err, "Chat failed"));
      } finally {
        setLoading(false);
      }
    },
    [modelId, messages],
  );

  const clearChat = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  return {
    messages,
    loading,
    error,
    sendMessage,
    clearChat,
  };
}
