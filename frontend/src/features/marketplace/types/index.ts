/**
 * Marketplace feature types
 */

export interface PublishedLibrary {
  id: string;
  name: string;
  description: string | null;
  organizationId: string;
  organizationName: string;
  templateCount: number;
  subscriberCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface LibrarySubscription {
  id: string;
  libraryId: string;
  organizationId: string;
  subscribedAt: string;
  library: {
    id: string;
    name: string;
    description: string | null;
    templateCount: number;
    organization: {
      name: string;
    };
  };
}

export interface PublishedCategory {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  icon: string | null;
  organizationId: string;
  organizationName: string;
  usageCount: number;
  createdAt: string;
}

export interface PublishedTemplate {
  id: string;
  name: string;
  description: string;
  organizationId: string;
  organizationName: string;
  nodeCount: number;
  threatCount: number;
  downloads: number;
  createdAt: string;
}

export interface MarketplaceStats {
  libraryCount: number;
  categoryCount: number;
  templateCount: number;
  totalSubscriptions: number;
}

export type MarketplaceTab = "libraries" | "categories" | "templates";
