import { describe, it, expect } from "vitest";
import {
  dedupeMitigationTexts,
  groupSharedControls,
  MAX_CONTROL_GROUPS,
} from "./mitigation-detector.js";

describe("dedupeMitigationTexts (within one threat)", () => {
  it("drops a reworded repeat of the same control and keeps the first", () => {
    const { keptIndices, dropped } = dedupeMitigationTexts([
      "Enforce mTLS between the Core API and the Billing Service.",
      "Rotate the Stripe API key every 90 days.",
      "Enforce mTLS between Core API and Billing Service",
    ]);
    expect(keptIndices).toEqual([0, 1]);
    expect(dropped).toBe(1);
  });

  it("keeps distinct controls", () => {
    const { keptIndices } = dedupeMitigationTexts([
      "Parameterize all SQL queries in the order service.",
      "Apply rate limiting at the API gateway.",
    ]);
    expect(keptIndices).toEqual([0, 1]);
  });
});

describe("groupSharedControls (same control across threats)", () => {
  const control =
    "Enable TLS with certificate verification on every Redis connection.";

  it("groups threats whose mitigations are the same control", () => {
    const groups = groupSharedControls([
      { key: "a", targetId: "redis", mitigations: [control] },
      {
        key: "b",
        targetId: "core",
        mitigations: [
          "Enable TLS with certificate verification on all Redis connections.",
        ],
      },
      { key: "c", targetId: "core", mitigations: ["Add a WAF rule set."] },
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].threatKeys.sort()).toEqual(["a", "b"]);
    expect(groups[0].targetIds.sort()).toEqual(["core", "redis"]);
    expect(groups[0].control.length).toBeGreaterThan(0);
  });

  it("does not group a threat with itself", () => {
    const groups = groupSharedControls([
      { key: "a", targetId: "x", mitigations: [control, control] },
    ]);
    expect(groups).toEqual([]);
  });

  it("caps the number of groups and orders by threat count", () => {
    const threats = [];
    for (let g = 0; g < MAX_CONTROL_GROUPS + 3; g++) {
      const text = `Unique control number ${g} alpha${g} beta${g} gamma${g} delta${g}`;
      const size = 2 + (g % 3);
      for (let i = 0; i < size; i++)
        threats.push({ key: `${g}-${i}`, targetId: "t", mitigations: [text] });
    }
    const groups = groupSharedControls(threats);
    expect(groups).toHaveLength(MAX_CONTROL_GROUPS);
    for (let i = 1; i < groups.length; i++)
      expect(groups[i - 1].threatKeys.length).toBeGreaterThanOrEqual(
        groups[i].threatKeys.length,
      );
  });
});
