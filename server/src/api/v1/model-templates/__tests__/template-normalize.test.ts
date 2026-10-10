import { describe, it, expect } from "vitest";
import { ALL_TEMPLATES } from "../../../../../prisma/seed/templates.js";
import {
  buildCanvasState,
  normalizeTemplate,
  type TemplateRow,
} from "../template-normalize.js";

const COMPONENT_TYPES = new Set([
  "EXTERNAL_USER",
  "INTERNAL_USER",
  "EXTERNAL_SYSTEM",
  "SERVICE",
  "API",
  "FUNCTION",
  "PROCESS",
  "DATABASE",
  "FILE_STORAGE",
  "CACHE",
  "QUEUE",
  "LOAD_BALANCER",
  "FIREWALL",
  "API_GATEWAY",
]);
const TRUST = new Set(["HIGH", "MEDIUM", "LOW", "UNTRUSTED"]);

/** Same row the seed script writes (prisma/seed/index.ts): canvasState + threats + boundaries only. */
function seedRow(t: (typeof ALL_TEMPLATES)[number]): TemplateRow {
  const nodes = t.components.map((c) => ({
    id: c.id,
    type: "component",
    position: c.position,
    data: {
      name: c.name,
      type: c.type,
      trustLevel: c.trustLevel || "INTERNAL",
      description: c.description || "",
    },
  }));
  const edges = t.connections.map((c) => ({
    id: c.id,
    source: c.source,
    target: c.target,
    type: "security",
    data: {
      protocol: c.protocol || "HTTPS",
      encrypted: c.encrypted ?? true,
      authMethod: c.authMethod || "NONE",
    },
  }));
  return {
    canvasState: JSON.stringify({ nodes, edges }),
    components: null,
    boundaries: JSON.stringify(t.boundaries),
    threats: JSON.stringify(t.threats),
  };
}

describe("normalizeTemplate — built-in seeded templates", () => {
  it.each(ALL_TEMPLATES.map((t) => [t.name, t] as const))(
    "%s instantiates with valid enums and geometry",
    (_name, t) => {
      const n = normalizeTemplate(seedRow(t));
      expect(n.components).toHaveLength(t.components.length);
      expect(n.boundaries).toHaveLength(t.boundaries.length);
      expect(n.threats).toHaveLength(t.threats.length);
      for (const c of n.components) {
        expect(COMPONENT_TYPES.has(c.type)).toBe(true);
        expect(TRUST.has(c.trustLevel)).toBe(true);
        expect(Number.isFinite(c.positionX)).toBe(true);
        expect(Number.isFinite(c.positionY)).toBe(true);
      }
      for (const b of n.boundaries) {
        expect(TRUST.has(b.trustLevel)).toBe(true);
        expect(b.width).toBeGreaterThan(0);
        expect(b.height).toBeGreaterThan(0);
        expect(Number.isFinite(b.positionX)).toBe(true);
      }
      for (const th of n.threats) {
        expect(th.strideCategories.length).toBeGreaterThan(0);
      }
    },
  );

  it("keeps template node ids so components line up with canvasState", () => {
    const t = ALL_TEMPLATES[0];
    const n = normalizeTemplate(seedRow(t));
    expect(n.components.map((c) => c.templateId)).toEqual(
      t.components.map((c) => c.id),
    );
  });

  it("derives a boundary box around its member components", () => {
    const n = normalizeTemplate(seedRow(ALL_TEMPLATES[0]));
    const dmz = n.boundaries.find((b) => b.name === "DMZ");
    expect(dmz?.trustLevel).toBe("LOW");
    // cdn (300,100) and frontend (300,300): padded box would reach into the
    // Public Internet box around the user (100..260), so the shared edge sits
    // at the middle of the 260..300 gap plus half the 8px boundary gap.
    expect(dmz?.positionX).toBe(284);
    expect(dmz?.positionY).toBe(40);
  });

  it("turns a seed mitigation string into a mitigation record", () => {
    const n = normalizeTemplate(seedRow(ALL_TEMPLATES[0]));
    const xss = n.threats.find((t) => t.name === "XSS via user input");
    expect(xss?.mitigations).toHaveLength(1);
    expect(xss?.strideCategories).toEqual(["TAMPERING"]);
  });
});

describe("normalizeTemplate — save-as-template (flat) rows", () => {
  it("passes flat positions, boundary geometry and threat arrays through", () => {
    const n = normalizeTemplate({
      canvasState: "{}",
      components: JSON.stringify([
        {
          type: "DATABASE",
          name: "DB",
          trustLevel: "HIGH",
          properties: { a: 1 },
          positionX: 10,
          positionY: 20,
        },
      ]),
      boundaries: JSON.stringify([
        {
          name: "Zone",
          trustLevel: "LOW",
          positionX: 1,
          positionY: 2,
          width: 300,
          height: 200,
        },
      ]),
      threats: JSON.stringify([
        {
          name: "T",
          strideCategories: ["SPOOFING"],
          severity: "HIGH",
          complianceControls: {},
          cweIds: ["CWE-1"],
          owaspIds: [],
          mitigations: [
            { description: "m", strategy: "DETECTION", priority: "LOW" },
          ],
        },
      ]),
    });
    expect(n.components[0]).toMatchObject({
      type: "DATABASE",
      trustLevel: "HIGH",
      positionX: 10,
      positionY: 20,
    });
    expect(n.boundaries[0]).toMatchObject({
      positionX: 1,
      width: 300,
      height: 200,
      trustLevel: "LOW",
    });
    expect(n.threats[0]).toMatchObject({
      strideCategories: ["SPOOFING"],
      cweIds: ["CWE-1"],
    });
    expect(n.threats[0].mitigations).toHaveLength(1);
  });

  it("tolerates empty or malformed JSON", () => {
    const n = normalizeTemplate({
      canvasState: "not json",
      components: "[",
      boundaries: null,
      threats: "{}",
    });
    expect(n).toEqual({ components: [], boundaries: [], threats: [] });
  });
});

describe("buildCanvasState", () => {
  const t =
    ALL_TEMPLATES.find((x) => x.name === "API Gateway") ?? ALL_TEMPLATES[0];
  const row = seedRow(t);
  const out = JSON.parse(
    buildCanvasState(row.canvasState, normalizeTemplate(row).boundaries) ??
      "{}",
  );

  it("labels nodes and maps trust to canvas levels", () => {
    const nodes = out.nodes.filter(
      (n: { type: string }) => n.type !== "boundary",
    );
    expect(nodes).toHaveLength(t.components.length);
    for (const n of nodes) {
      expect(n.data.label).toBeTruthy();
      expect(["PUBLIC", "INTERNAL", "CONFIDENTIAL", "RESTRICTED"]).toContain(
        n.data.trustLevel,
      );
    }
    expect(
      nodes.find((n: { id: string }) => n.id === "backend").data.label,
    ).toBe("Backend Service");
  });

  it("adds sized boundary nodes", () => {
    const b = out.nodes.filter((n: { type: string }) => n.type === "boundary");
    expect(b).toHaveLength(t.boundaries.length);
    expect(b[0].style.width).toBeGreaterThan(0);
  });

  it("maps edge auth to editor values", () => {
    expect(
      out.edges.find((e: { id: string }) => e.id === "e3").data.authentication,
    ).toBe("mTLS");
  });

  it("passes editor-shaped canvases through untouched", () => {
    const saved = JSON.stringify({
      nodes: [{ id: "a", type: "component", data: { label: "A" } }],
      edges: [],
    });
    expect(buildCanvasState(saved, [])).toBe(saved);
  });

  it("threats carry their component template id", () => {
    const th = normalizeTemplate(row).threats;
    expect(th.every((x) => x.componentTemplateId)).toBe(true);
  });
});

describe("seeded template boundary layout", () => {
  it.each(ALL_TEMPLATES.map((t) => [t.name, t] as const))(
    "%s: boundaries with different members do not overlap",
    (_name, t) => {
      const { boundaries } = normalizeTemplate(seedRow(t));
      const overlaps: string[] = [];
      for (let i = 0; i < boundaries.length; i++) {
        for (let j = i + 1; j < boundaries.length; j++) {
          const a = boundaries[i];
          const b = boundaries[j];
          const ax =
            a.positionX < b.positionX + b.width &&
            b.positionX < a.positionX + a.width;
          const ay =
            a.positionY < b.positionY + b.height &&
            b.positionY < a.positionY + a.height;
          if (ax && ay) overlaps.push(`${a.name} / ${b.name}`);
        }
      }
      expect(overlaps).toEqual([]);
    },
  );

  it("does not label a DMZ boundary INTERNAL on the canvas", () => {
    const row = seedRow(ALL_TEMPLATES[0]);
    const out = JSON.parse(
      buildCanvasState(row.canvasState, normalizeTemplate(row).boundaries) ??
        "{}",
    );
    const dmz = out.nodes.find(
      (n: { type: string; data: { label: string } }) =>
        n.type === "boundary" && n.data.label === "DMZ",
    );
    expect(dmz.data.trustLevel).not.toBe("INTERNAL");
  });
});
