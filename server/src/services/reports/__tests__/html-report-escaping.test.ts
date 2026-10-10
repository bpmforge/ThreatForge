/**
 * Model, threat and branding text in the HTML report is user- or AI-supplied,
 * so it must come out escaped.
 */
import { describe, it, expect } from "vitest";
import {
  generateReport,
  type ReportData,
  type ReportTemplate,
} from "../template-engine.js";

const PAYLOAD = '<img src=x onerror="alert(1)">';

const template: ReportTemplate = {
  id: "t",
  name: "Report",
  format: "html",
  sections: [
    { title: "Threats", type: "threat_table" },
    { title: "Mitigations", type: "mitigation_table" },
  ],
  branding: {
    companyName: PAYLOAD,
    footerText: PAYLOAD,
    primaryColor: "red;}</style><script>alert(1)</script>",
  },
};

const data: ReportData = {
  modelName: `</title>${PAYLOAD}`,
  generatedAt: "2026-10-09",
  components: [],
  connections: [],
  threats: [
    {
      name: PAYLOAD,
      severity: "HIGH",
      status: "IDENTIFIED",
      strideCategory: "SPOOFING",
      mitigationCount: 1,
    },
  ],
  mitigations: [
    {
      description: PAYLOAD,
      status: "PLANNED",
      priority: "HIGH",
      threatName: PAYLOAD,
    },
  ],
  summary: {
    totalComponents: 0,
    totalConnections: 0,
    totalThreats: 1,
    threatsBySeverity: { HIGH: 1 },
    threatsByStride: { SPOOFING: 1 },
    threatsByStatus: { IDENTIFIED: 1 },
    mitigationRate: 0,
  },
};

describe("HTML report escaping", () => {
  it("escapes model, threat, mitigation and branding text", () => {
    const html = generateReport(template, data);
    expect(html).not.toContain(PAYLOAD);
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;img");
  });
});
