"use client";

/** "Showing x to y of n" with previous/next buttons for paged tables. */
import { Button } from "@/components/ui/button";

interface PaginationFooterProps {
  page: number;
  limit: number;
  total: number;
  /** Plural noun for the listed items, e.g. "users". */
  noun: string;
  onPageChange: (updater: (page: number) => number) => void;
}

export function PaginationFooter({
  page,
  limit,
  total,
  noun,
  onPageChange,
}: PaginationFooterProps) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-muted-foreground">
        Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of{" "}
        {total} {noun}
      </span>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page === 1}
          onClick={() => onPageChange((p) => p - 1)}
        >
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={page * limit >= total}
          onClick={() => onPageChange((p) => p + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
