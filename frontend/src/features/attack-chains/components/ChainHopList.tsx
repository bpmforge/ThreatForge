"use client";

/**
 * ChainHopList
 *
 * Renders the ordered hops of an attack chain. Hovering (or focusing) a hop
 * highlights its component on the canvas via useHopHighlight — which reuses the
 * attack-paths `chainHighlight` + updateNodeData mechanism.
 */
import { Separator } from "@/components/ui/separator";
import { useHopHighlight } from "../hooks/useHopHighlight";
import type { AttackChainHop } from "../types";

interface ChainHopListProps {
  hops: AttackChainHop[];
}

export function ChainHopList({ hops }: ChainHopListProps) {
  const { highlightHop, clearHop } = useHopHighlight();

  return (
    <ul className="px-3 pb-3 space-y-1 list-none m-0">
      <Separator className="mb-2" />
      {hops.map((hop) => (
        <li
          key={hop.id}
          className="flex items-start gap-2 text-xs rounded px-1 py-0.5 hover:bg-muted/60 focus-within:bg-muted/60"
          onMouseEnter={() => highlightHop(hop)}
          onMouseLeave={clearHop}
        >
          <button
            type="button"
            className="flex items-start gap-2 text-left w-full"
            onFocus={() => highlightHop(hop)}
            onBlur={clearHop}
            aria-label={`Highlight hop ${hop.position}: ${hop.componentName}`}
          >
            <span className="shrink-0 w-4 h-4 rounded-full bg-muted flex items-center justify-center font-medium text-[10px]">
              {hop.position}
            </span>
            <span className="min-w-0">
              <span className="font-medium">{hop.componentName}</span>
              {hop.isMitigated && (
                <span className="ml-1 text-green-600">(mitigated)</span>
              )}
              <span className="block text-muted-foreground truncate">
                {hop.description}
              </span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
