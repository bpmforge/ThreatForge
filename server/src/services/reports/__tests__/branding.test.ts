import { describe, it, expect, vi } from "vitest";
import JSZip from "jszip";

vi.mock("../../../db.js", () => ({ getPrisma: vi.fn() }));

import { generateDocxBuffer } from "../docx-generator.js";
import { generateReport, BUILTIN_TEMPLATES } from "../template-engine.js";
import type { ReportData } from "../template-engine.js";
import { isValidLogoDataUrl, resolveBranding } from "../branding.js";

// 1x1 PNG
const PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

function data(branding?: ReportData["branding"]): ReportData {
  return {
    modelName: "Test Model",
    generatedAt: "2026-10-01T00:00:00.000Z",
    branding,
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
}

async function docxParts(d: ReportData) {
  const zip = await JSZip.loadAsync(await generateDocxBuffer(d));
  return {
    xml: (await zip.file("word/document.xml")?.async("string")) ?? "",
    media: Object.keys(zip.files).filter((f) =>
      /^word\/media\/.+\.png$/.test(f),
    ),
  };
}

describe("DOCX branding", () => {
  it("embeds logo and applies brand colours when branding present", async () => {
    const { xml, media } = await docxParts(
      data({
        logoDataUrl: PNG,
        primaryColor: "#112233",
        accentColor: "#AABBCC",
      }),
    );
    expect(media.length).toBe(1);
    expect(xml).toContain('w:fill="112233"');
    expect(xml).toContain('w:color="AABBCC"');
    expect(xml).not.toContain("1D4ED8");
  });

  it("falls back to defaults with no logo when branding absent", async () => {
    const { xml, media } = await docxParts(data());
    expect(media.length).toBe(0);
    expect(xml).toContain('w:fill="1D4ED8"');
  });
});

describe("HTML report branding", () => {
  const tpl = BUILTIN_TEMPLATES[0];
  it("renders logo and primary colour", () => {
    const html = generateReport(
      tpl,
      data({ logoDataUrl: PNG, primaryColor: "#112233" }),
    );
    expect(html).toContain(PNG);
    expect(html).toContain("#112233");
  });
  it("uses defaults when absent", () => {
    const html = generateReport(tpl, data());
    expect(html).not.toContain("Organization logo");
    expect(html).toContain("#2563eb");
  });
});

describe("branding validation", () => {
  it("accepts png/jpeg, rejects svg/gif/webp and oversize", () => {
    expect(isValidLogoDataUrl(PNG)).toBe(true);
    expect(isValidLogoDataUrl("data:image/jpeg;base64,AAAA")).toBe(true);
    expect(isValidLogoDataUrl("data:image/gif;base64,AAAA")).toBe(false);
    expect(isValidLogoDataUrl("data:image/svg+xml;base64,AAAA")).toBe(false);
    const big = `data:image/png;base64,${"A".repeat(3 * 1024 * 1024)}`;
    expect(isValidLogoDataUrl(big)).toBe(false);
  });

  it("ignores invalid colours in stored settings", () => {
    const b = resolveBranding({
      logoUrl: null,
      settings: JSON.stringify({
        branding: { primaryColor: "red;}", accentColor: "#ABCDEF" },
      }),
    });
    expect(b).toEqual({ accentColor: "#ABCDEF" });
    expect(resolveBranding({ logoUrl: null, settings: "{}" })).toBeUndefined();
  });
});
