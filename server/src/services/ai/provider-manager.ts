/**
 * AI Provider Manager
 * Manages multiple AI providers with fallback and health checking.
 */

import { getPrisma } from "../../db.js";
import type { AIProvider as PrismaAIProvider } from "@prisma/client";

type AIProviderStatus = "healthy" | "degraded" | "unavailable" | "unknown";

export interface ProviderHealth {
  providerId: string;
  status: AIProviderStatus;
  latencyMs: number | null;
  lastChecked: Date;
  errorMessage?: string;
}

export interface ProviderHealthResult {
  providerId: string;
  status: AIProviderStatus;
  latencyMs: number | null;
  lastChecked: Date;
  errorMessage?: string;
}

export class AIProviderManager {
  private organizationId: string;
  private failureCounts: Map<string, number> = new Map();
  private healthCache: Map<
    string,
    { result: ProviderHealth; timestamp: number }
  > = new Map();
  private readonly CACHE_TTL = 30000;

  constructor(organizationId: string) {
    this.organizationId = organizationId;
  }

  async getActiveProvider(): Promise<PrismaAIProvider | null> {
    const prisma = await getPrisma();
    const provider = await prisma.aIProvider.findFirst({
      where: { organizationId: this.organizationId, isEnabled: true },
      orderBy: { priority: "asc" },
    });

    return provider;
  }

  async executeWithFallback<T>(
    operation: (provider: PrismaAIProvider) => Promise<T>,
  ): Promise<T> {
    const prisma = await getPrisma();
    const providers = await prisma.aIProvider.findMany({
      where: { organizationId: this.organizationId, isEnabled: true },
      orderBy: { priority: "asc" },
    });

    for (const provider of providers) {
      try {
        return await operation(provider);
      } catch (_error) {
        const failures = this.failureCounts.get(provider.id) || 0;
        this.failureCounts.set(provider.id, failures + 1);
      }
    }

    throw new Error("All providers failed");
  }

  async checkAllHealth(): Promise<ProviderHealthResult[]> {
    const prisma = await getPrisma();
    const providers = await prisma.aIProvider.findMany({
      where: { organizationId: this.organizationId },
    });

    const results: ProviderHealthResult[] = [];

    for (const provider of providers) {
      const result = await this.getProviderHealth(provider.id);
      results.push(result);
    }

    return results;
  }

  async getProviderHealth(providerId: string): Promise<ProviderHealthResult> {
    const cached = this.healthCache.get(providerId);
    const now = Date.now();

    if (cached && now - cached.timestamp < this.CACHE_TTL) {
      return cached.result;
    }

    const prisma = await getPrisma();
    const provider = await prisma.aIProvider.findUnique({
      where: { id: providerId },
    });

    if (!provider) {
      return {
        providerId,
        status: "unknown",
        latencyMs: null,
        lastChecked: new Date(),
        errorMessage: "Provider not found",
      };
    }

    const start = Date.now();
    let status: AIProviderStatus = "healthy";
    let errorMessage: string | undefined;

    // Check based on last test status from DB
    if (provider.lastTestStatus === "FAILED") {
      status = "unavailable";
      errorMessage = provider.lastTestError || "Last test failed";
    } else if (provider.lastTestStatus === "PENDING") {
      status = "unknown";
    } else if (!provider.lastTestStatus) {
      status = "unknown";
    }

    const latencyMs = Date.now() - start;
    const result: ProviderHealthResult = {
      providerId,
      status,
      latencyMs,
      lastChecked: new Date(),
      errorMessage,
    };

    this.healthCache.set(providerId, { result, timestamp: now });
    return result;
  }
}
