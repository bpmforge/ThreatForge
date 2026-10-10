/**
 * Settings API Service Tests
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { updateAISettings } from "./api";
import * as apiClient from "@/lib/api-client";

vi.mock("@/lib/api-client", () => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPut: vi.fn(),
  apiPatch: vi.fn(),
  apiDelete: vi.fn(),
}));

describe("Settings API Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("updateAISettings", () => {
    it("should PATCH the model AI-settings route, not PUT", async () => {
      const updated = { enabled: true, provider: "claude" };
      vi.mocked(apiClient.apiPatch).mockResolvedValue(updated);

      const result = await updateAISettings("model-123", { enabled: true });

      // The server only registers GET and PATCH for this route — a PUT 404s.
      expect(apiClient.apiPatch).toHaveBeenCalledWith(
        "/api/threat-models/model-123/ai-settings",
        { enabled: true },
      );
      expect(apiClient.apiPut).not.toHaveBeenCalled();
      expect(result).toEqual(updated);
    });
  });
});
