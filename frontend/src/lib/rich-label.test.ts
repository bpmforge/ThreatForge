import { describe, it, expect } from "vitest";
import {
  parseRichLabel,
  parseInline,
  normalizeRichLabel,
  richLabelToPlainText,
  RICH_LABEL_MAX_LENGTH,
} from "./rich-label";

describe("rich-label parser", () => {
  it("parses bold, italic and nesting", () => {
    expect(parseInline("a **b *c* e** *d*")).toEqual([
      { text: "a " },
      { text: "b ", bold: true },
      { text: "c", bold: true, italic: true },
      { text: " e", bold: true },
      { text: " " },
      { text: "d", italic: true },
    ]);
  });

  it("groups bullet and numbered lines into lists", () => {
    const b = parseRichLabel("Title\n- a\n- b\n1. x\n2. y");
    expect(b.map((x) => x.kind)).toEqual(["p", "ul", "ol"]);
    expect((b[1] as { items: unknown[] }).items).toHaveLength(2);
  });

  it("leaves unmatched markers and escapes literal", () => {
    expect(richLabelToPlainText("2 * 3 and \\*x\\*")).toBe("2 * 3 and *x*");
  });

  it("plain-text projection drops markup", () => {
    expect(richLabelToPlainText("**API** gateway\n- a\n- b")).toBe(
      "API gateway a b",
    );
  });

  it("normalizes input", () => {
    expect(normalizeRichLabel(42)).toBeUndefined();
    expect(normalizeRichLabel("a\u0007b")).toBe("ab");
    expect(
      normalizeRichLabel("x".repeat(RICH_LABEL_MAX_LENGTH + 1)),
    ).toHaveLength(RICH_LABEL_MAX_LENGTH);
  });
});
