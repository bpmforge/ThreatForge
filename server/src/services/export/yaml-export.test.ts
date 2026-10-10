import { describe, it, expect } from "vitest";
import {
  exportToYAML,
  parseYAMLThreatModel,
  normalizeRichLabel,
  RICH_LABEL_MAX_LENGTH,
} from "./yaml-export.js";

const base = {
  name: "M",
  connections: [],
  boundaries: [],
  threats: [],
  mitigations: [],
};

describe("richLabel YAML round-trip", () => {
  const rich =
    'Gateway **v2** with "quotes", a: colon # hash\n- item *one*\n- item two\n1. first\\path';

  it("round-trips richLabel with quotes, colons, newlines and backslashes", () => {
    const yaml = exportToYAML({
      ...base,
      components: [
        {
          id: "c1",
          name: "Gateway v2",
          type: "SERVICE",
          data: { description: "d", richLabel: rich },
        },
        { id: "c2", name: "Plain", type: "SERVICE", data: {} },
      ],
    });
    const parsed = parseYAMLThreatModel(yaml);
    expect(parsed?.components[0]?.richLabel).toBe(rich);
    expect(parsed?.components[0]?.name).toBe("Gateway v2");
    expect(parsed?.components[0]?.description).toBe("d");
    expect(parsed?.components[1]?.richLabel).toBeUndefined();
  });

  it("omits richLabel when absent so old exports stay identical", () => {
    const yaml = exportToYAML({
      ...base,
      components: [{ id: "c1", name: "A", type: "SERVICE", data: {} }],
    });
    expect(yaml).not.toContain("richLabel");
  });

  it("imports old YAML (no richLabel) unchanged", () => {
    const parsed = parseYAMLThreatModel(
      'name: "X"\ncomponents:\n  - id: a\n    name: "A"\n    type: SERVICE\n',
    );
    expect(parsed?.components[0]?.richLabel).toBeUndefined();
  });

  it("normalizes: strips control chars and caps length", () => {
    expect(normalizeRichLabel("a\u0000b\r\nc")).toBe("ab\nc");
    expect(normalizeRichLabel("   ")).toBeUndefined();
    expect(
      normalizeRichLabel("x".repeat(RICH_LABEL_MAX_LENGTH + 50)),
    ).toHaveLength(RICH_LABEL_MAX_LENGTH);
  });
});
