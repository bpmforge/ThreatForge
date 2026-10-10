"use client";

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  Library,
  Tag,
  FileCode,
  Store,
  ArrowUpDown,
} from "lucide-react";
import { useMarketplaceBrowser } from "./useMarketplaceBrowser";
import { MarketplaceLibrariesTab } from "./MarketplaceLibrariesTab";
import { MarketplaceCategoriesTab } from "./MarketplaceCategoriesTab";
import { MarketplaceTemplatesTab } from "./MarketplaceTemplatesTab";
import { MarketplaceSubscriptions } from "./MarketplaceSubscriptions";
import type { MarketplaceTab } from "../types";
import type { MarketplaceSort } from "../services/api";

interface MarketplaceBrowserProps {
  orgId: string;
}

export function MarketplaceBrowser({ orgId }: MarketplaceBrowserProps) {
  const {
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
    isPending,
    handleSubscribe,
    handleUnsubscribe,
  } = useMarketplaceBrowser({ orgId });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Store className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle>Marketplace</CardTitle>
                <CardDescription>
                  Discover and subscribe to shared resources from the community
                </CardDescription>
              </div>
            </div>
            {stats && (
              <div className="flex gap-4 text-sm">
                <div className="text-center">
                  <p className="text-2xl font-bold">{stats.libraryCount}</p>
                  <p className="text-muted-foreground">Libraries</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold">{stats.templateCount}</p>
                  <p className="text-muted-foreground">Templates</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold">
                    {stats.totalSubscriptions}
                  </p>
                  <p className="text-muted-foreground">Subscriptions</p>
                </div>
              </div>
            )}
          </div>
        </CardHeader>
      </Card>

      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search marketplace..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select
            value={sortBy}
            onValueChange={(v) => setSortBy(v as MarketplaceSort)}
          >
            <SelectTrigger className="w-[140px]">
              <ArrowUpDown className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="popular">Popular</SelectItem>
              <SelectItem value="newest">Newest</SelectItem>
              <SelectItem value="name">Name</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as MarketplaceTab)}
        >
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="libraries" className="gap-2">
              <Library className="h-4 w-4" />
              Libraries
              {librariesData?.total != null && (
                <Badge variant="secondary" className="ml-1">
                  {librariesData.total}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="categories" className="gap-2">
              <Tag className="h-4 w-4" />
              Categories
              {categories?.length != null && (
                <Badge variant="secondary" className="ml-1">
                  {categories.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="templates" className="gap-2">
              <FileCode className="h-4 w-4" />
              Templates
              {templates?.length != null && (
                <Badge variant="secondary" className="ml-1">
                  {templates.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="libraries" className="space-y-4">
            <MarketplaceLibrariesTab
              librariesData={librariesData}
              loadingLibraries={loadingLibraries}
              subscribedLibraryIds={subscribedLibraryIds}
              searchQuery={searchQuery}
              isPending={isPending}
              onSubscribe={handleSubscribe}
              onUnsubscribe={handleUnsubscribe}
            />
          </TabsContent>

          <TabsContent value="categories" className="space-y-4">
            <MarketplaceCategoriesTab
              categories={categories}
              loadingCategories={loadingCategories}
              searchQuery={searchQuery}
            />
          </TabsContent>

          <TabsContent value="templates" className="space-y-4">
            <MarketplaceTemplatesTab
              templates={templates}
              loadingTemplates={loadingTemplates}
              searchQuery={searchQuery}
            />
          </TabsContent>
        </Tabs>
      </div>

      <MarketplaceSubscriptions subscriptions={subscriptions} />
    </div>
  );
}
