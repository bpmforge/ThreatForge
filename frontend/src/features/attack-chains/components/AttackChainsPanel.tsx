"use client";

/**
 * AttackChainsPanel
 *
 * Sidebar panel for AI-generated attack chains. Lists chains (name,
 * severity → residual, status), expands to a hop list, supports Accept/Reject
 * (status PATCH via the chains API), and runs ATTACK_CHAIN_ANALYSIS with
 * progress shown through the standard JobProgressCard / useJobStatus pipeline.
 *
 * Reuses from the attack-paths feature (does NOT re-implement):
 *  - data + mutation hooks: useAttackChains, useUpdateAttackChainStatus
 *  - canvas highlight: AttackChainOverlay (whole-chain) + chainHighlight field
 * New here: hop-hover highlight, job-polling Analyze, severity→residual display.
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Shield, AlertTriangle, Play } from "lucide-react";
import { JobProgressCard } from "@/features/ai-jobs";
import {
  AttackChainOverlay,
  useAttackChains,
  useUpdateAttackChainStatus,
} from "@/features/attack-paths";
import { ChainListItem } from "./ChainListItem";
import { useAttackChainAnalysis } from "../hooks/useAttackChainAnalysis";
import type { AttackChainWithHops } from "../types";

interface AttackChainsPanelProps {
  modelId: string;
}

export function AttackChainsPanel({ modelId }: AttackChainsPanelProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<AttackChainWithHops | null>(null);

  const { data: chains, isLoading } = useAttackChains(modelId);
  const updateStatus = useUpdateAttackChainStatus(modelId);
  const { analyze, jobId, isStarting, onJobComplete, dismissJob } =
    useAttackChainAnalysis(modelId);

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleSelect(chain: AttackChainWithHops) {
    setSelected((cur) => (cur?.id === chain.id ? null : chain));
  }

  return (
    <div className="flex h-full flex-col">
      <AttackChainOverlay chain={selected} />

      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold">Attack Chains</span>
          {chains && chains.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              {chains.length}
            </Badge>
          )}
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => void analyze()}
          disabled={isStarting || !!jobId}
          aria-label="Analyze attack chains"
        >
          <Play className="mr-1 h-3 w-3" />
          Analyze
        </Button>
      </div>

      {jobId && (
        <div className="border-b p-2">
          <JobProgressCard
            jobId={jobId}
            type="ATTACK_CHAIN_ANALYSIS"
            onComplete={onJobComplete}
            onDismiss={dismissJob}
          />
        </div>
      )}

      <ScrollArea className="flex-1 min-h-0">
        {isLoading && (
          <div className="flex items-center justify-center py-12" aria-busy>
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        )}

        {!isLoading && (!chains || chains.length === 0) && (
          <div className="flex flex-col items-center justify-center gap-2 px-4 py-12 text-center">
            <AlertTriangle className="h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              No attack chains yet. Click Analyze to detect attack paths.
            </p>
          </div>
        )}

        {!isLoading && chains && chains.length > 0 && (
          <div className="space-y-2 p-2">
            {chains.map((chain) => (
              <ChainListItem
                key={chain.id}
                chain={chain}
                expanded={expandedIds.has(chain.id)}
                selected={selected?.id === chain.id}
                onToggleExpand={() => toggleExpand(chain.id)}
                onSelect={() => toggleSelect(chain)}
                onSetStatus={(status) =>
                  updateStatus.mutate({ chainId: chain.id, status })
                }
              />
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
