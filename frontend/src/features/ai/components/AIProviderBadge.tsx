"use client";

/**
 * AI Provider Badge — Shows data residency info for the configured AI provider.
 *
 * Displays a badge indicating whether AI requests go to an external provider
 * or stay local. Warns users when architecture data leaves the network.
 */

import { useQuery } from "@tanstack/react-query";
import { apiGet, ApiError } from "@/lib/api-client";
import { Shield, Cloud, Server, AlertTriangle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ProviderInfo {
  configured: boolean;
  provider?: string;
  providerName?: string;
  isLocal?: boolean;
  dataDestination?: string;
  warning?: string | null;
}

function useProviderInfo(modelId: string | null) {
  return useQuery<ProviderInfo>({
    queryKey: ["ai-provider-info", modelId],
    queryFn: async () => {
      try {
        const r = await apiGet<ProviderInfo & { data?: ProviderInfo }>(
          `/api/threat-models/${modelId}/ai/provider-info`,
        );
        return r.data ?? r;
      } catch (err) {
        if (err instanceof ApiError) return { configured: false };
        throw err;
      }
    },
    enabled: !!modelId,
    staleTime: 5 * 60 * 1000, // Cache 5 min
  });
}

export function AIProviderBadge({ modelId }: { modelId: string | null }) {
  const { data } = useProviderInfo(modelId);

  if (!data?.configured) return null;

  const isLocal = data.isLocal;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium cursor-help ${
              isLocal
                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
            }`}
          >
            {isLocal ? (
              <Server className="h-3 w-3" />
            ) : (
              <Cloud className="h-3 w-3" />
            )}
            {isLocal ? "Local AI" : data.providerName}
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <div className="space-y-1">
            <div className="flex items-center gap-1 font-medium">
              <Shield className="h-3 w-3" />
              Data Residency
            </div>
            <p className="text-xs">
              AI requests go to: <strong>{data.dataDestination}</strong>
            </p>
            {data.warning && (
              <p className="text-xs text-amber-600 dark:text-amber-400 flex items-start gap-1">
                <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                {data.warning}
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
