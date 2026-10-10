"use client";

/**
 * ChainListItem
 *
 * One attack-chain card: name, severity → residual severity, status badge,
 * entry → target, hop count. Expand reveals the hop list (ChainHopList).
 * Accept / Reject PATCH the chain status via the chains API route. Selecting the
 * card drives the whole-chain canvas overlay (AttackChainOverlay, reused).
 */
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Link2,
  ChevronDown,
  ChevronRight,
  Check,
  X,
  ArrowRight,
} from "lucide-react";
import { ChainHopList } from "./ChainHopList";
import {
  SEVERITY_BADGE_CLASSES,
  STATUS_BADGE_CLASSES,
  type AttackChainWithHops,
  type ChainStatus,
} from "../types";

interface ChainListItemProps {
  chain: AttackChainWithHops;
  expanded: boolean;
  selected: boolean;
  onToggleExpand: () => void;
  onSelect: () => void;
  onSetStatus: (status: ChainStatus) => void;
}

export function ChainListItem({
  chain,
  expanded,
  selected,
  onToggleExpand,
  onSelect,
  onSetStatus,
}: ChainListItemProps) {
  return (
    <div
      className={`rounded-md border bg-card shadow-sm ${
        selected ? "ring-2 ring-primary/40" : ""
      }`}
    >
      <button
        type="button"
        className="w-full text-left p-3 space-y-2"
        onClick={onSelect}
        aria-label={`Select attack chain ${chain.name}`}
        aria-pressed={selected}
      >
        <div className="flex items-start justify-between gap-2">
          <span className="text-sm font-medium leading-tight">
            {chain.name}
          </span>
          <span className="flex items-center gap-1 shrink-0">
            <Badge className={SEVERITY_BADGE_CLASSES[chain.severity]}>
              {chain.severity}
            </Badge>
            {chain.residualSeverity && (
              <>
                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                <Badge
                  variant="outline"
                  className={SEVERITY_BADGE_CLASSES[chain.residualSeverity]}
                  aria-label={`Residual severity ${chain.residualSeverity}`}
                >
                  {chain.residualSeverity}
                </Badge>
              </>
            )}
          </span>
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Link2 className="h-3 w-3 shrink-0" />
          <span className="truncate">
            {chain.entryPointName} → {chain.targetAssetName}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className={STATUS_BADGE_CLASSES[chain.status]}
          >
            {chain.status.replace("_", " ")}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {chain.hops.length} hop{chain.hops.length !== 1 ? "s" : ""}
          </span>
        </div>
      </button>

      <Separator />

      <div className="px-3 py-2 flex items-center gap-1">
        <Button
          size="sm"
          variant="ghost"
          className="h-6 px-2 text-xs"
          onClick={onToggleExpand}
          aria-label={expanded ? "Collapse hops" : "Expand hops"}
          aria-expanded={expanded}
        >
          {expanded ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
          Hops
        </Button>
        {chain.status === "AI_SUGGESTED" && (
          <>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-xs text-green-700"
              onClick={() => onSetStatus("ACCEPTED")}
              aria-label={`Accept chain ${chain.name}`}
            >
              <Check className="h-3 w-3 mr-1" />
              Accept
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-xs text-red-600"
              onClick={() => onSetStatus("REJECTED")}
              aria-label={`Reject chain ${chain.name}`}
            >
              <X className="h-3 w-3 mr-1" />
              Reject
            </Button>
          </>
        )}
      </div>

      {expanded && <ChainHopList hops={chain.hops} />}
    </div>
  );
}
