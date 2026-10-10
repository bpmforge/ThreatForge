"use client";

/**
 * RecentlyUsed - Shows last 5 components the user placed on canvas.
 *
 * Reads component metadata from categories to render draggable items.
 */

import { useMemo } from "react";
import { Clock } from "lucide-react";
import type { ComponentType } from "@/types/canvas";
import type { PaletteItem } from "../types";
import { categories } from "../data/categories";
import { PaletteItemComponent } from "./PaletteItem";
import { CollapsibleSection } from "./CollapsibleSection";

interface RecentlyUsedProps {
  recentTypes: ComponentType[];
}

/** Build a lookup map once from all categories */
function buildItemMap(): Map<string, PaletteItem> {
  const map = new Map<string, PaletteItem>();
  for (const cat of categories) {
    for (const item of cat.items) {
      map.set(item.type, item);
    }
  }
  return map;
}

const itemMap = buildItemMap();

export function RecentlyUsed({ recentTypes }: RecentlyUsedProps) {
  const recentItems = useMemo(
    () =>
      recentTypes.map((t) => itemMap.get(t)).filter(Boolean) as PaletteItem[],
    [recentTypes],
  );

  if (recentItems.length === 0) return null;

  return (
    <CollapsibleSection
      title="Recently Used"
      Icon={Clock}
      color="text-violet-500"
      defaultOpen={true}
    >
      <div className="space-y-0.5">
        {recentItems.map((item) => (
          <PaletteItemComponent key={item.type} item={item} />
        ))}
      </div>
    </CollapsibleSection>
  );
}
