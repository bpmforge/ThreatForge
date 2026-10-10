import { describe, it, expect } from "vitest";
import { validateMitigationRefreshReply } from "./mitigation-refresh-validator.js";

const validMitigation = {
  description: "Enforce MFA on the admin console",
  controlCategory: "IAM",
  testCriteria: "Attempt login without a second factor and confirm denial",
  effort: "medium",
  effectiveness: "0.7",
};

describe("validateMitigationRefreshReply", () => {
  it("accepts a well-formed mitigation array", () => {
    const result = validateMitigationRefreshReply(
      JSON.stringify([validMitigation]),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.mitigations).toHaveLength(1);
      expect(result.mitigations[0].description).toBe(
        validMitigation.description,
      );
    }
  });

  it("rejects non-JSON text", () => {
    const result = validateMitigationRefreshReply(
      "Sorry, I can't generate mitigations for that threat.",
    );
    expect(result.ok).toBe(false);
  });

  it("rejects an empty object", () => {
    const result = validateMitigationRefreshReply("{}");
    expect(result.ok).toBe(false);
  });

  it("rejects an array containing null", () => {
    const result = validateMitigationRefreshReply("[null]");
    expect(result.ok).toBe(false);
  });

  it("rejects objects missing the required fields", () => {
    const result = validateMitigationRefreshReply('[{"foo":1}]');
    expect(result.ok).toBe(false);
  });

  it("rejects an empty array", () => {
    const result = validateMitigationRefreshReply("[]");
    expect(result.ok).toBe(false);
  });
});
