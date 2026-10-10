"use client";

import { useCommandPalette } from "../hooks/useCommandPalette";
import { useGlobalSearch } from "../hooks/useGlobalSearch";
import { SearchResultItem } from "./SearchResultItem";
import { useCallback } from "react";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
} from "@/components/ui/command";
import type { SearchResult } from "../types";

export function CommandPalette() {
  const { isOpen, close } = useCommandPalette();
  const { query, setQuery, results, recentSearches, addToRecent } =
    useGlobalSearch();

  const handleSelect = useCallback(
    (result: SearchResult) => {
      addToRecent(result);
      close();
    },
    [addToRecent, close],
  );

  // Group results by type
  const threats = results.filter((r) => r.type === "threat");
  const components = results.filter((r) => r.type === "component");
  const mitigations = results.filter((r) => r.type === "mitigation");

  return (
    <CommandDialog open={isOpen} onOpenChange={(open) => !open && close()}>
      <CommandInput
        placeholder="Search threats, components, mitigations... (⌘K)"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        {query === "" && recentSearches.length > 0 && (
          <CommandGroup heading="Recent">
            {recentSearches.map((item) => (
              <SearchResultItem
                key={item.id}
                result={item}
                onSelect={handleSelect}
              />
            ))}
          </CommandGroup>
        )}

        {query !== "" && threats.length > 0 && (
          <CommandGroup heading={`Threats (${threats.length})`}>
            {threats.map((item) => (
              <SearchResultItem
                key={item.id}
                result={item}
                onSelect={handleSelect}
              />
            ))}
          </CommandGroup>
        )}

        {query !== "" && components.length > 0 && (
          <CommandGroup heading={`Components (${components.length})`}>
            {components.map((item) => (
              <SearchResultItem
                key={item.id}
                result={item}
                onSelect={handleSelect}
              />
            ))}
          </CommandGroup>
        )}

        {query !== "" && mitigations.length > 0 && (
          <CommandGroup heading={`Mitigations (${mitigations.length})`}>
            {mitigations.map((item) => (
              <SearchResultItem
                key={item.id}
                result={item}
                onSelect={handleSelect}
              />
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
