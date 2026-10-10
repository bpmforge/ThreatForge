import { useState, useMemo } from "react";
import {
  usePublicLibraries,
  useSubscriptions,
  useSubscribeToLibrary,
  useUnsubscribeFromLibrary,
  usePublicCategories,
  usePublicTemplates,
  useMarketplaceStats,
} from "../hooks/useMarketplace";
import type { MarketplaceTab } from "../types";
import type { MarketplaceSort } from "../services/api";

interface UseMarketplaceBrowserProps {
  orgId: string;
}

export function useMarketplaceBrowser({ orgId }: UseMarketplaceBrowserProps) {
  const [activeTab, setActiveTab] = useState<MarketplaceTab>("libraries");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<MarketplaceSort>("popular");
  const [showFeatured] = useState(false);

  const { data: stats } = useMarketplaceStats();
  const { data: librariesData, isLoading: loadingLibraries } =
    usePublicLibraries({
      search: searchQuery || undefined,
      sort: sortBy,
      featured: showFeatured,
    });
  const { data: subscriptions } = useSubscriptions(orgId);
  const { data: categories, isLoading: loadingCategories } =
    usePublicCategories(searchQuery || undefined);
  const { data: templates, isLoading: loadingTemplates } = usePublicTemplates({
    search: searchQuery || undefined,
    sort: sortBy,
  });

  const subscribe = useSubscribeToLibrary(orgId);
  const unsubscribe = useUnsubscribeFromLibrary(orgId);

  const subscribedLibraryIds = useMemo(
    () => new Set(subscriptions?.map((s) => s.libraryId) || []),
    [subscriptions],
  );

  const getSubscriptionId = (libraryId: string) =>
    subscriptions?.find((s) => s.libraryId === libraryId)?.id;

  const handleSubscribe = async (libraryId: string) => {
    await subscribe.mutateAsync(libraryId);
  };

  const handleUnsubscribe = async (libraryId: string) => {
    const subId = getSubscriptionId(libraryId);
    if (subId) await unsubscribe.mutateAsync(subId);
  };

  return {
    activeTab,
    setActiveTab,
    searchQuery,
    setSearchQuery,
    sortBy,
    setSortBy,
    stats,
    librariesData,
    loadingLibraries,
    subscriptions,
    categories,
    loadingCategories,
    templates,
    loadingTemplates,
    subscribedLibraryIds,
    isPending: subscribe.isPending || unsubscribe.isPending,
    handleSubscribe,
    handleUnsubscribe,
  };
}
