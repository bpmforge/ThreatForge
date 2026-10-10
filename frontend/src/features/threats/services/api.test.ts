/**
 * Threats API Service Tests
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchThreats, createThreat } from "./api";
import * as apiClient from "@/lib/api-client";

vi.mock("@/lib/api-client", () => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPut: vi.fn(),
  apiDelete: vi.fn(),
}));

describe("Threats API Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("fetchThreats", () => {
    it("should extract data array from paginated response", async () => {
      const mockThreats = [
        {
          id: "threat-1",
          name: "SQL Injection",
          strideCategories: ["TAMPERING"],
          severity: "HIGH",
          status: "OPEN",
          mitigations: [],
        },
        {
          id: "threat-2",
          name: "XSS Attack",
          strideCategories: ["SPOOFING"],
          severity: "MEDIUM",
          status: "OPEN",
          mitigations: [],
        },
      ];

      vi.mocked(apiClient.apiGet).mockResolvedValue({
        data: mockThreats,
        pagination: {
          page: 1,
          limit: 50,
          total: 2,
          totalPages: 1,
          hasNext: false,
          hasPrev: false,
        },
      });

      const result = await fetchThreats("model-123");

      expect(apiClient.apiGet).toHaveBeenCalledWith(
        "/api/threat-models/model-123/threats",
      );
      expect(result).toEqual(
        mockThreats.map((t) => ({ ...t, cweIds: [], owaspIds: [] })),
      );
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(2);
    });

    it("should return empty array when no threats exist", async () => {
      vi.mocked(apiClient.apiGet).mockResolvedValue({
        data: [],
        pagination: {
          page: 1,
          limit: 50,
          total: 0,
          totalPages: 0,
          hasNext: false,
          hasPrev: false,
        },
      });

      const result = await fetchThreats("model-empty");

      expect(result).toEqual([]);
      expect(Array.isArray(result)).toBe(true);
    });

    it("should be iterable (for spread operator in cache updates)", async () => {
      const mockThreats = [
        {
          id: "threat-1",
          name: "Test Threat",
          strideCategories: ["TAMPERING"],
          severity: "HIGH",
          status: "OPEN",
          mitigations: [],
        },
      ];

      vi.mocked(apiClient.apiGet).mockResolvedValue({
        data: mockThreats,
        pagination: {
          page: 1,
          limit: 50,
          total: 1,
          totalPages: 1,
          hasNext: false,
          hasPrev: false,
        },
      });

      const result = await fetchThreats("model-123");

      // This should NOT throw "old is not iterable"
      const newThreat = {
        id: "threat-new",
        name: "New Threat",
        strideCategories: ["SPOOFING"],
        severity: "MEDIUM",
        status: "OPEN",
        mitigations: [],
      };
      const updated = [newThreat, ...result];

      expect(updated.length).toBe(2);
      expect(updated[0].id).toBe("threat-new");
      expect(updated[1].id).toBe("threat-1");
    });
  });

  describe("createThreat", () => {
    it("should create threat with componentNodeId", async () => {
      const newThreat = {
        id: "threat-new",
        name: "New Threat",
        strideCategories: ["TAMPERING"],
        severity: "HIGH",
        status: "OPEN",
        componentNodeId: "react-flow-node-1",
        mitigations: [],
      };

      vi.mocked(apiClient.apiPost).mockResolvedValue(newThreat);

      const result = await createThreat("model-123", {
        name: "New Threat",
        strideCategories: ["TAMPERING"],
        severity: "HIGH",
        componentNodeId: "react-flow-node-1",
      });

      expect(apiClient.apiPost).toHaveBeenCalledWith(
        "/api/threat-models/model-123/threats",
        {
          name: "New Threat",
          strideCategories: ["TAMPERING"],
          severity: "HIGH",
          componentNodeId: "react-flow-node-1",
        },
      );
      expect(result).toEqual(newThreat);
      expect(result.componentNodeId).toBe("react-flow-node-1");
    });

    it("should create threat with connectionEdgeId", async () => {
      const newThreat = {
        id: "threat-edge",
        name: "Data Flow Threat",
        strideCategories: ["INFORMATION_DISCLOSURE"],
        severity: "MEDIUM",
        status: "OPEN",
        connectionEdgeId: "react-flow-edge-1",
        mitigations: [],
      };

      vi.mocked(apiClient.apiPost).mockResolvedValue(newThreat);

      const result = await createThreat("model-123", {
        name: "Data Flow Threat",
        strideCategories: ["INFORMATION_DISCLOSURE"],
        severity: "MEDIUM",
        connectionEdgeId: "react-flow-edge-1",
      });

      expect(result.connectionEdgeId).toBe("react-flow-edge-1");
    });

    it("should create threat without component/connection (model-level threat)", async () => {
      const newThreat = {
        id: "threat-model",
        name: "Model Level Threat",
        strideCategories: ["DENIAL_OF_SERVICE"],
        severity: "LOW",
        status: "OPEN",
        mitigations: [],
      };

      vi.mocked(apiClient.apiPost).mockResolvedValue(newThreat);

      const result = await createThreat("model-123", {
        name: "Model Level Threat",
        strideCategories: ["DENIAL_OF_SERVICE"],
        severity: "LOW",
      });

      expect(result.componentNodeId).toBeUndefined();
      expect(result.connectionEdgeId).toBeUndefined();
    });
  });
});
