"use client";

/**
 * Marketplace Page
 *
 * Browse and subscribe to public libraries, categories, and templates.
 */
import { AppHeader } from "@/components/layout";
import { MarketplaceBrowser } from "@/features/marketplace";
import { useCurrentOrgId } from "@/stores/org-store";
export default function MarketplacePage() {
  const orgId = useCurrentOrgId();

  return (
    <div className="flex flex-col h-full">
      <AppHeader breadcrumbs={[{ label: "Marketplace" }]} />
      <main className="flex-1 overflow-auto p-6">
        {orgId ? (
          <MarketplaceBrowser orgId={orgId} />
        ) : (
          <p className="text-sm text-muted-foreground text-center py-12">
            Select an organization to browse the marketplace.
          </p>
        )}
      </main>
    </div>
  );
}
