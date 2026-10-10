"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Library } from "lucide-react";
import { LibraryCard } from "./LibraryCard";
import type { PublishedLibrary } from "../types";

interface MarketplaceLibrariesTabProps {
  librariesData: { data: PublishedLibrary[]; total: number } | undefined;
  loadingLibraries: boolean;
  subscribedLibraryIds: Set<string>;
  searchQuery: string;
  isPending: boolean;
  onSubscribe: (id: string) => void;
  onUnsubscribe: (id: string) => void;
}

export function MarketplaceLibrariesTab({
  librariesData,
  loadingLibraries,
  subscribedLibraryIds,
  searchQuery,
  isPending,
  onSubscribe,
  onUnsubscribe,
}: MarketplaceLibrariesTabProps) {
  if (loadingLibraries) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (librariesData?.data && librariesData.data.length > 0) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        {librariesData.data.map((library) => (
          <LibraryCard
            key={library.id}
            library={library}
            isSubscribed={subscribedLibraryIds.has(library.id)}
            onSubscribe={() => onSubscribe(library.id)}
            onUnsubscribe={() => onUnsubscribe(library.id)}
            isPending={isPending}
          />
        ))}
      </div>
    );
  }

  return (
    <Card className="border-dashed">
      <CardContent className="py-12 text-center">
        <Library className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
        <p className="text-muted-foreground">
          {searchQuery
            ? "No libraries match your search"
            : "No public libraries available yet"}
        </p>
      </CardContent>
    </Card>
  );
}
