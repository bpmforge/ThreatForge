/**
 * AI Metrics Service
 * Tracks AI usage metrics in memory and periodically syncs to provider records.
 *
 * AI-SPEND: every provider call is recorded here (see providers/usage-meter.ts)
 * with its tokens and estimated cost. syncToDB folds the pending usage into
 * the org's default AIProvider row — the row the spend guard and /usage read.
 * Counters roll over at the start of each UTC month, so the "monthly" spend
 * cap really is monthly.
 */

import { getPrisma } from "../../db.js";
import logger from "../../utils/logger.js";

interface AIUsageMetric {
  /** Provider kind from the client (claude, openai, lmstudio, ...). */
  provider: string;
  organizationId: string;
  requestCount: number;
  tokenCount: number;
  inputTokens: number;
  outputTokens: number;
  errorCount: number;
  totalLatencyMs: number;
  estimatedCostUsd: number;
  timestamp: Date;
}

/** One provider call, as recorded by the usage meter. */
interface AIRequestRecord {
  organizationId: string;
  provider: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  estimatedCostUsd: number;
  isError?: boolean;
}

interface AIMetricsSummary {
  totalRequests: number;
  totalTokens: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  avgLatencyMs: number;
  errorRate: number;
  /** Estimated USD cost not yet synced to the database. */
  estimatedCostUsd: number;
  /** LLM output records dropped as unparseable / schema-invalid. */
  parseFailures: number;
  /** Replies cut off at the max-tokens cap (finish_reason=length). */
  truncatedResponses: number;
}

/** Per-job output-quality counts, aggregated per organization. */
interface AIQualityCounts {
  parseFailures: number;
  truncatedResponses: number;
}

const SYNC_INTERVAL_MS = 60 * 1000;

/** First instant of the current UTC month. */
export function startOfUtcMonth(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

class AIMetricsService {
  private metrics: Map<string, AIUsageMetric> = new Map();
  private quality: Map<string, AIQualityCounts> = new Map();
  private syncInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.syncInterval = setInterval(() => {
      this.syncToDB().catch((err) =>
        logger.error({ err }, "AI metrics sync failed"),
      );
    }, SYNC_INTERVAL_MS);
    // Never keep the process (or a test run) alive just to sync metrics.
    this.syncInterval.unref();
  }

  private getKey(organizationId: string, provider: string): string {
    return `${organizationId}:${provider}`;
  }

  recordRequest(record: AIRequestRecord): void {
    const key = this.getKey(record.organizationId, record.provider);
    const existing = this.metrics.get(key) ?? emptyMetric(record);
    existing.requestCount += 1;
    existing.tokenCount += record.inputTokens + record.outputTokens;
    existing.inputTokens += record.inputTokens;
    existing.outputTokens += record.outputTokens;
    existing.totalLatencyMs += record.latencyMs;
    existing.estimatedCostUsd += record.estimatedCostUsd;
    if (record.isError) existing.errorCount += 1;
    this.metrics.set(key, existing);
  }

  /** Add one job's parse-failure and truncation counts to its org's totals. */
  recordQuality(
    organizationId: string,
    counts: Partial<AIQualityCounts>,
  ): void {
    const existing = this.quality.get(organizationId) ?? {
      parseFailures: 0,
      truncatedResponses: 0,
    };
    existing.parseFailures += counts.parseFailures ?? 0;
    existing.truncatedResponses += counts.truncatedResponses ?? 0;
    this.quality.set(organizationId, existing);
  }

  getMetrics(organizationId: string, provider: string): AIUsageMetric | null {
    return this.metrics.get(this.getKey(organizationId, provider)) ?? null;
  }

  /** Estimated cost recorded for the org but not yet written to the DB. */
  getPendingCostUsd(organizationId: string): number {
    let cost = 0;
    for (const metric of this.metrics.values()) {
      if (metric.organizationId === organizationId) {
        cost += metric.estimatedCostUsd;
      }
    }
    return cost;
  }

  getSummary(organizationId: string): AIMetricsSummary {
    let totalRequests = 0;
    let totalTokens = 0;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalLatencyMs = 0;
    let errorCount = 0;
    let estimatedCostUsd = 0;

    for (const metric of this.metrics.values()) {
      if (metric.organizationId === organizationId) {
        totalRequests += metric.requestCount;
        totalTokens += metric.tokenCount;
        totalInputTokens += metric.inputTokens;
        totalOutputTokens += metric.outputTokens;
        totalLatencyMs += metric.totalLatencyMs;
        errorCount += metric.errorCount;
        estimatedCostUsd += metric.estimatedCostUsd;
      }
    }

    return {
      totalRequests,
      totalTokens,
      totalInputTokens,
      totalOutputTokens,
      avgLatencyMs: totalRequests > 0 ? totalLatencyMs / totalRequests : 0,
      errorRate: totalRequests > 0 ? errorCount / totalRequests : 0,
      estimatedCostUsd,
      parseFailures: this.quality.get(organizationId)?.parseFailures ?? 0,
      truncatedResponses:
        this.quality.get(organizationId)?.truncatedResponses ?? 0,
    };
  }

  /**
   * Fold pending usage into each org's default AIProvider row. Usage that
   * can't be written (no provider row, DB error) stays pending for the next
   * sync rather than being dropped.
   */
  async syncToDB(now: Date = new Date()): Promise<void> {
    if (this.metrics.size === 0) return;
    // Swap first: calls recorded while the writes are in flight go to the
    // fresh map and are not lost by a clear() at the end.
    const pending = this.metrics;
    this.metrics = new Map();
    const prisma = await getPrisma();
    const monthStart = startOfUtcMonth(now);

    for (const metric of pending.values()) {
      try {
        const row = await prisma.aIProvider.findFirst({
          where: { organizationId: metric.organizationId, isEnabled: true },
          orderBy: [{ isDefault: "desc" }, { priority: "asc" }],
          select: { id: true, usageResetAt: true },
        });
        if (!row) {
          logger.warn(
            { organizationId: metric.organizationId },
            "AI usage has no enabled AIProvider row to record against — keeping it pending",
          );
          this.requeue(metric);
          continue;
        }
        const rollover = row.usageResetAt < monthStart;
        await prisma.aIProvider.update({
          where: { id: row.id },
          data: rollover
            ? {
                totalRequests: metric.requestCount,
                totalTokens: metric.tokenCount,
                totalInputTokens: metric.inputTokens,
                totalOutputTokens: metric.outputTokens,
                estimatedCost: metric.estimatedCostUsd,
                usageResetAt: now,
              }
            : {
                totalRequests: { increment: metric.requestCount },
                totalTokens: { increment: metric.tokenCount },
                totalInputTokens: { increment: metric.inputTokens },
                totalOutputTokens: { increment: metric.outputTokens },
                estimatedCost: { increment: metric.estimatedCostUsd },
              },
        });
      } catch (error) {
        logger.error(
          { err: error, organizationId: metric.organizationId },
          "Failed to sync AI usage metrics",
        );
        this.requeue(metric);
      }
    }
  }

  /** Merge an unsynced metric back into the live map. */
  private requeue(metric: AIUsageMetric): void {
    const key = this.getKey(metric.organizationId, metric.provider);
    const live = this.metrics.get(key);
    if (!live) {
      this.metrics.set(key, metric);
      return;
    }
    live.requestCount += metric.requestCount;
    live.tokenCount += metric.tokenCount;
    live.inputTokens += metric.inputTokens;
    live.outputTokens += metric.outputTokens;
    live.errorCount += metric.errorCount;
    live.totalLatencyMs += metric.totalLatencyMs;
    live.estimatedCostUsd += metric.estimatedCostUsd;
  }

  /** Test-only: drop all pending usage. */
  reset(): void {
    this.metrics.clear();
    this.quality.clear();
  }

  stop(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }
}

function emptyMetric(record: AIRequestRecord): AIUsageMetric {
  return {
    provider: record.provider,
    organizationId: record.organizationId,
    requestCount: 0,
    tokenCount: 0,
    inputTokens: 0,
    outputTokens: 0,
    errorCount: 0,
    totalLatencyMs: 0,
    estimatedCostUsd: 0,
    timestamp: new Date(),
  };
}

// Singleton instance
export const aiMetrics = new AIMetricsService();
