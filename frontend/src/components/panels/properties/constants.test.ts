/**
 * Properties panel constants — verifies the dropdown surfaces every type
 * from the palette (so dragged AWS/Azure/GCP nodes can be re-classified
 * back and forth without the dropdown losing options).
 */
import { describe, it, expect } from "vitest";
import { componentTypeGroups, componentTypes } from "./constants";
import { categories } from "@/components/panels/palette/data";

describe("componentTypeGroups", () => {
  it("mirrors palette categories one-for-one", () => {
    expect(componentTypeGroups).toHaveLength(categories.length);
    expect(componentTypeGroups.map((g) => g.label)).toEqual(
      categories.map((c) => c.title),
    );
  });

  it("contains vendor-specific types (AWS_S3, AZURE_BLOB, GCP_STORAGE)", () => {
    const all = componentTypes.map((t) => t.value);
    expect(all).toContain("AWS_S3");
    expect(all).toContain("AZURE_BLOB");
    expect(all).toContain("GCP_STORAGE");
  });

  it("flat componentTypes equals the concatenation of groups", () => {
    const fromGroups = componentTypeGroups.flatMap((g) =>
      g.options.map((o) => o.value),
    );
    expect(componentTypes.map((t) => t.value)).toEqual(fromGroups);
  });

  it("has no duplicate type values across groups", () => {
    const values = componentTypeGroups.flatMap((g) =>
      g.options.map((o) => o.value),
    );
    expect(new Set(values).size).toBe(values.length);
  });
});
