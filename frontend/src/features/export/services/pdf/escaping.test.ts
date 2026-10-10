/**
 * The PDF export HTML is written into a same-origin popup, so every value a
 * user (or the AI) can set must be escaped.
 */
import { describe, it, expect } from "vitest";
import type { Node } from "@xyflow/react";
import { generatePDFHTML } from "./index";

const PAYLOAD = '<img src=x onerror="alert(1)">';

describe("PDF export escaping", () => {
  it("escapes the model name in the title and heading", () => {
    const html = generatePDFHTML(`</title>${PAYLOAD}`, [], [], []);
    expect(html).not.toContain(PAYLOAD);
    expect(html).toContain("&lt;img");
  });

  it("escapes component interface names", () => {
    const nodes = [
      {
        id: "c1",
        type: "component",
        position: { x: 0, y: 0 },
        data: {
          label: "API",
          interfaces: [{ name: PAYLOAD, protocol: "HTTPS" }],
        },
      },
    ] as Node[];
    const html = generatePDFHTML("Model", nodes, [], []);
    expect(html).not.toContain(PAYLOAD);
  });

  it("escapes compliance control ids on threat cards", () => {
    const html = generatePDFHTML(
      "Model",
      [],
      [],
      [
        {
          id: "t1",
          name: "T",
          strideCategories: ["SPOOFING"],
          severity: "HIGH",
          status: "IDENTIFIED",
          mitigations: [],
          complianceControls: { NIST_800_53: [PAYLOAD] },
        },
      ],
    );
    expect(html).not.toContain(PAYLOAD);
  });
});
