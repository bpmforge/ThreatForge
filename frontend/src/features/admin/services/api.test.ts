/**
 * Admin API Service Tests
 *
 * Validates that fetchApi correctly unwraps { data: T } responses
 * and that none of the service functions double-unwrap.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Import after mocking fetch
import {
  getCacheStats,
  getSystemInfo,
  getTraces,
  getTrace,
  invalidateCacheByTag,
  invalidateCacheByPattern,
  getAdminStats,
  getSystemHealth,
} from "./api";

describe("Admin API Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function mockJsonResponse(body: unknown, ok = true) {
    mockFetch.mockResolvedValueOnce({
      ok,
      status: ok ? 200 : 500,
      json: () => Promise.resolve(body),
    });
  }

  describe("fetchApi unwrapping", () => {
    it("getCacheStats unwraps { data: T } correctly", async () => {
      const stats = { hitRate: 0.95, size: 100, maxSize: 1000 };
      mockJsonResponse({ data: stats });

      const result = await getCacheStats();

      expect(result).toEqual(stats);
      expect(result.hitRate).toBe(0.95);
    });

    it("getSystemInfo unwraps { data: T } correctly", async () => {
      const info = {
        uptime: 3600,
        nodeVersion: "22.0.0",
        platform: "linux",
        arch: "x64",
        memoryUsage: {
          heapUsed: 50000000,
          heapTotal: 100000000,
          rss: 200000000,
        },
      };
      mockJsonResponse({ data: info });

      const result = await getSystemInfo();

      expect(result.uptime).toBe(3600);
      expect(result.memoryUsage.heapUsed).toBe(50000000);
    });

    it("getTraces unwraps nested { data: { traces } } correctly", async () => {
      const traces = [
        { traceId: "t1", rootSpan: "GET /api", startTime: 1000, spanCount: 3 },
        { traceId: "t2", rootSpan: "POST /api", startTime: 2000, spanCount: 5 },
      ];
      mockJsonResponse({ data: { count: 2, traces } });

      const result = await getTraces(10);

      expect(result).toHaveLength(2);
      expect(result[0].traceId).toBe("t1");
    });

    it("getTrace unwraps { data: T } correctly", async () => {
      const trace = {
        traceId: "t1",
        spans: [{ spanId: "s1", name: "handler", duration: 5, status: "ok" }],
      };
      mockJsonResponse({ data: trace });

      const result = await getTrace("t1");

      expect(result.traceId).toBe("t1");
      expect(result.spans).toHaveLength(1);
    });

    it("invalidateCacheByTag unwraps correctly", async () => {
      mockJsonResponse({ data: { invalidatedCount: 5 } });

      const result = await invalidateCacheByTag("threats");

      expect(result.invalidatedCount).toBe(5);
    });

    it("invalidateCacheByPattern unwraps correctly", async () => {
      mockJsonResponse({ data: { invalidatedCount: 12 } });

      const result = await invalidateCacheByPattern("model-*");

      expect(result.invalidatedCount).toBe(12);
    });
  });

  describe("error handling", () => {
    it("throws on non-ok response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ message: "Server error" }),
      });

      await expect(getCacheStats()).rejects.toThrow("Server error");
    });

    it("throws generic error when no message in response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: () => Promise.resolve({}),
      });

      await expect(getSystemInfo()).rejects.toThrow(
        "Request failed with status 403",
      );
    });
  });

  describe("getAdminStats", () => {
    it("returns unwrapped stats", async () => {
      const stats = {
        totalUsers: 50,
        totalOrganizations: 5,
        totalProjects: 20,
        totalModels: 100,
      };
      mockJsonResponse({ data: stats });

      const result = await getAdminStats();

      expect(result.totalUsers).toBe(50);
    });
  });

  describe("getSystemHealth", () => {
    it("returns unwrapped health data", async () => {
      const health = {
        status: "healthy",
        checks: { database: { status: "healthy" } },
      };
      mockJsonResponse({ data: health });

      const result = await getSystemHealth();

      expect(result.status).toBe("healthy");
    });
  });
});
