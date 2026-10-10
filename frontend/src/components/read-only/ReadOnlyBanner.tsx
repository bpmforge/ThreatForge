"use client";

/**
 * A strip across the top of every signed-in page when the account is
 * read-only (the public demo login). The server decides; this only says so.
 */
import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { Eye } from "lucide-react";
import { apiGet } from "@/lib/api-client";

export function ReadOnlyBanner() {
  const { status } = useSession();
  const { data } = useQuery({
    queryKey: ["current-user", "read-only"],
    queryFn: () => apiGet<{ readOnly?: boolean }>("/api/users/me"),
    enabled: status === "authenticated",
    staleTime: 5 * 60 * 1000,
  });

  if (!data?.readOnly) return null;
  return (
    <div
      role="status"
      className="flex items-center justify-center gap-2 border-b border-amber-300 bg-amber-50 px-4 py-1.5 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100"
    >
      <Eye className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span>
        <strong>Demo — read-only.</strong> Explore freely; changes are not
        saved.
      </span>
    </div>
  );
}
