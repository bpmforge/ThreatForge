import { describe, it, expect, vi } from "vitest";
import JSZip from "jszip";

vi.mock("../../../db.js", () => ({ getPrisma: vi.fn() }));

import { generateDocxBuffer } from "../docx-generator.js";
import type { ReportData } from "../template-engine.js";

const data: ReportData = {
  modelName: "Layout",
  generatedAt: "2026-10-05T00:00:00.000Z",
  branding: { primaryColor: "#0F766E" },
  components: [{ name: "API", type: "SERVICE", threatCount: 1 }],
  connections: [],
  threats: [
    {
      name: "SQLi",
      severity: "HIGH",
      status: "OPEN",
      strideCategory: "TAMPERING",
      mitigationCount: 0,
    },
  ],
  mitigations: [],
  summary: {
    totalComponents: 1,
    totalConnections: 0,
    totalThreats: 1,
    threatsBySeverity: { HIGH: 1 },
    threatsByStride: {},
    threatsByStatus: { OPEN: 1 },
    mitigationRate: 0,
  },
};

describe("DOCX table layout", () => {
  it("writes real column widths and readable header text on a dark brand fill", async () => {
    const zip = await JSZip.loadAsync(await generateDocxBuffer(data));
    const xml = (await zip.file("word/document.xml")?.async("string")) ?? "";
    const cols = [...xml.matchAll(/<w:gridCol w:w="(\d+)"\/>/g)].map((m) =>
      Number(m[1]),
    );
    expect(cols.length).toBeGreaterThan(0);
    expect(Math.min(...cols)).toBeGreaterThan(500);
    expect(xml).toMatch(/w:fill="0F766E"[\s\S]*?<w:color w:val="FFFFFF"\/>/);
  });
});
