"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Tag } from "lucide-react";
import type { PublishedCategory } from "../types";

interface MarketplaceCategoriesTabProps {
  categories: PublishedCategory[] | undefined;
  loadingCategories: boolean;
  searchQuery: string;
}

export function MarketplaceCategoriesTab({
  categories,
  loadingCategories,
  searchQuery,
}: MarketplaceCategoriesTabProps) {
  if (loadingCategories) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (categories && categories.length > 0) {
    return (
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {categories.map((category) => (
          <Card key={category.id} className="hover:shadow-sm transition-shadow">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div
                  className="w-4 h-4 rounded"
                  style={{ backgroundColor: category.color || "#6b7280" }}
                />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{category.name}</p>
                  <p className="text-sm text-muted-foreground truncate">
                    {category.organizationName}
                  </p>
                </div>
                <Badge variant="secondary">{category.usageCount} uses</Badge>
              </div>
              {category.description && (
                <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                  {category.description}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <Card className="border-dashed">
      <CardContent className="py-12 text-center">
        <Tag className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
        <p className="text-muted-foreground">
          {searchQuery
            ? "No categories match your search"
            : "No public categories available yet"}
        </p>
      </CardContent>
    </Card>
  );
}
