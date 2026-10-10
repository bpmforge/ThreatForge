"use client";

/**
 * SearchResults - Display search results in the palette.
 */

import type { PaletteItem } from "../types";
import { PaletteItemComponent } from "./PaletteItem";

interface SearchResultsProps {
  items: PaletteItem[];
  query: string;
}

export function SearchResults({ items, query }: SearchResultsProps) {
  if (items.length === 0) {
    return (
      <div className="p-4 text-center text-sm text-muted-foreground">
        No components match &quot;{query}&quot;
      </div>
    );
  }

  return (
    <div className="p-2 space-y-0.5">
      <div className="text-xs text-muted-foreground px-1 pb-2">
        {items.length} result{items.length !== 1 ? "s" : ""}
      </div>
      {items.map((item) => (
        <PaletteItemComponent key={item.type} item={item} />
      ))}
    </div>
  );
}
