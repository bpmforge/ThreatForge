/**
 * Marketplace API service
 */
import { apiGet, apiPost, apiDelete } from "@/lib/api-client";
import type {
  PublishedLibrary,
  LibrarySubscription,
  PublishedCategory,
  PublishedTemplate,
  MarketplaceStats,
} from "../types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

export type MarketplaceSort = "newest" | "popular" | "name";

// Public Libraries
export async function fetchPublicLibraries(params?: {
  search?: string;
  limit?: number;
  offset?: number;
  sort?: MarketplaceSort;
  featured?: boolean;
}): Promise<{ data: PublishedLibrary[]; total: number }> {
  const searchParams = new URLSearchParams();
  if (params?.search) searchParams.set("search", params.search);
  if (params?.limit) searchParams.set("limit", params.limit.toString());
  if (params?.offset) searchParams.set("offset", params.offset.toString());
  if (params?.sort) searchParams.set("sort", params.sort);
  if (params?.featured) searchParams.set("featured", "true");

  const query = searchParams.toString();
  const response = await apiGet<{ data: PublishedLibrary[]; total: number }>(
    `${API_BASE}/api/v1/marketplace/libraries${query ? `?${query}` : ""}`,
  );
  return response;
}

// Library Subscriptions
export async function fetchSubscriptions(
  orgId: string,
): Promise<LibrarySubscription[]> {
  const response = await apiGet<{ data: LibrarySubscription[] }>(
    `${API_BASE}/api/v1/organizations/${orgId}/marketplace/subscriptions`,
  );
  return response.data;
}

export async function subscribeToLibrary(
  orgId: string,
  libraryId: string,
): Promise<LibrarySubscription> {
  const response = await apiPost<LibrarySubscription>(
    `${API_BASE}/api/v1/organizations/${orgId}/marketplace/subscriptions`,
    { libraryId },
  );
  return response;
}

export async function unsubscribeFromLibrary(
  orgId: string,
  subscriptionId: string,
): Promise<void> {
  await apiDelete(
    `${API_BASE}/api/v1/organizations/${orgId}/marketplace/subscriptions/${subscriptionId}`,
  );
}

// Public Categories (for discovery)
export async function fetchPublicCategories(params?: {
  search?: string;
  limit?: number;
}): Promise<PublishedCategory[]> {
  const searchParams = new URLSearchParams();
  if (params?.search) searchParams.set("search", params.search);
  if (params?.limit) searchParams.set("limit", params.limit.toString());

  const query = searchParams.toString();
  // The server wraps the list as { data: [...] } inside the standard envelope.
  const response = await apiGet<{ data: PublishedCategory[] }>(
    `${API_BASE}/api/v1/marketplace/categories${query ? `?${query}` : ""}`,
  );
  return response.data;
}

// Public Model Templates
export async function fetchPublicTemplates(params?: {
  search?: string;
  limit?: number;
  sort?: MarketplaceSort;
}): Promise<PublishedTemplate[]> {
  const searchParams = new URLSearchParams();
  if (params?.search) searchParams.set("search", params.search);
  if (params?.limit) searchParams.set("limit", params.limit.toString());
  if (params?.sort) searchParams.set("sort", params.sort);

  const query = searchParams.toString();
  // The server wraps the list as { data: [...] } inside the standard envelope.
  const response = await apiGet<{ data: PublishedTemplate[] }>(
    `${API_BASE}/api/v1/marketplace/templates${query ? `?${query}` : ""}`,
  );
  return response.data;
}

// Marketplace Stats
export async function fetchMarketplaceStats(): Promise<MarketplaceStats> {
  const response = await apiGet<MarketplaceStats>(
    `${API_BASE}/api/v1/marketplace/stats`,
  );
  return response;
}
