/**
 * DOCX section builders — used by docx-generator.ts.
 *
 * Each function returns a docx node or array of nodes (typed as unknown[]
 * to avoid the broken NodeNext re-export problem in the docx package).
 */
import { createRequire } from "node:module";
// `require` is undefined in ESM runtime ("type":"module"); createRequire gives
// us a working CJS loader for the docx package, whose NodeNext re-exports TS
// can't follow as a normal import.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const docxPkg = createRequire(import.meta.url)("docx") as Record<string, any>;

import type { ReportData } from "./template-engine.js";

const {
  Paragraph,
  Table,
  TableRow,
  TableCell,
  TextRun,
  HeadingLevel,
  AlignmentType,
  WidthType,
  BorderStyle,
  ImageRun,
} = docxPkg;

// =============================================================================
// Primitive helpers
// =============================================================================

const SEVERITY_COLORS: Record<string, string> = {
  CRITICAL: "DC2626",
  HIGH: "EA580C",
  MEDIUM: "D97706",
  LOW: "16A34A",
};

// Column widths in twips for the default Letter page (9360 twips between
// margins). Without them docx writes 100-twip grid columns, which Word
// autofits but LibreOffice, Google Docs and Quick Look render one letter wide.
const SUMMARY_COLUMNS = [2400, 1344];
const COMPONENT_COLUMNS = [4680, 2808, 1872];
const THREAT_COLUMNS = [3500, 1200, 1860, 1100, 1700];

function severityRun(text: string) {
  return new TextRun({
    text,
    color: SEVERITY_COLORS[text] ?? "374151",
    bold: true,
  });
}

const DEFAULT_FILL = "1D4ED8";

/** docx wants hex without "#". */
function stripHash(color: string | undefined): string | undefined {
  return color?.replace(/^#/, "");
}

function brandFill(data: ReportData): string {
  return stripHash(data.branding?.primaryColor) ?? DEFAULT_FILL;
}

const LOGO_MAX_W = 180;
const LOGO_MAX_H = 72;

/** Read pixel size from a PNG (IHDR) or JPEG (SOF marker) buffer. */
function imageSize(
  buf: Buffer,
  type: "png" | "jpg",
): { w: number; h: number } | null {
  try {
    if (type === "png")
      return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
    let i = 2;
    while (i < buf.length - 9) {
      if (buf[i] !== 0xff) return null;
      const marker = buf[i + 1];
      if (
        marker >= 0xc0 &&
        marker <= 0xcf &&
        ![0xc4, 0xc8, 0xcc].includes(marker)
      ) {
        return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
      }
      i += 2 + buf.readUInt16BE(i + 2);
    }
  } catch {
    // fall through — unreadable image just gets no logo
  }
  return null;
}

/** Centered logo paragraph, or [] when branding has no usable logo. */
function logoParagraph(data: ReportData): unknown[] {
  const m = /^data:image\/(png|jpeg);base64,(.+)$/i.exec(
    data.branding?.logoDataUrl ?? "",
  );
  if (!m) return [];
  const type = m[1].toLowerCase() === "png" ? "png" : "jpg";
  const buf = Buffer.from(m[2], "base64");
  const size = imageSize(buf, type);
  if (!size || size.w <= 0 || size.h <= 0) return [];
  const scale = Math.min(LOGO_MAX_W / size.w, LOGO_MAX_H / size.h, 1);
  return [
    new Paragraph({
      children: [
        new ImageRun({
          type,
          data: buf,
          transformation: {
            width: Math.round(size.w * scale),
            height: Math.round(size.h * scale),
          },
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { before: 1440, after: 0 },
    }),
  ];
}

/** White text on a dark fill (most brand colours), black on a light one. */
function textOn(fill: string): string {
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(fill.replace("#", "").slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 0.18 ? "FFFFFF" : "000000";
}

function headerCell(text: string, fill = DEFAULT_FILL) {
  return new TableCell({
    children: [
      new Paragraph({
        children: [new TextRun({ text, bold: true, color: textOn(fill) })],
      }),
    ],
    shading: { fill },
  });
}

function dataCell(text: string, runs?: unknown[]) {
  return new TableCell({
    children: [new Paragraph({ children: runs ?? [new TextRun({ text })] })],
  });
}

function thinBorder() {
  const b = { style: BorderStyle.SINGLE, size: 1, color: "D1D5DB" };
  return { top: b, bottom: b, left: b, right: b };
}

// =============================================================================
// Section builders
// =============================================================================

export function titlePage(data: ReportData): unknown[] {
  const date = new Date(data.generatedAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const logo = logoParagraph(data);
  const accent = stripHash(data.branding?.accentColor);
  return [
    ...logo,
    new Paragraph({
      children: [
        new TextRun({
          text: data.modelName,
          bold: true,
          size: 56,
          ...(data.branding?.primaryColor && {
            color: stripHash(data.branding.primaryColor),
          }),
        }),
      ],
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
      spacing: { before: logo.length ? 480 : 2880, after: 240 },
      // accent rule under the title
      ...(accent && {
        border: {
          bottom: {
            style: BorderStyle.SINGLE,
            size: 12,
            color: accent,
            space: 8,
          },
        },
      }),
    }),
    new Paragraph({
      children: [
        new TextRun({ text: "Threat Model Report", size: 36, color: "374151" }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 240 },
    }),
    new Paragraph({
      children: [new TextRun({ text: date, color: "6B7280" })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: "Generated by ThreatForge", color: "6B7280" }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 1440 },
    }),
  ];
}

export function summaryTable(data: ReportData) {
  const { totalComponents, totalThreats, mitigationRate, threatsByStatus } =
    data.summary;
  const rows: [string, string][] = [
    ["Components", String(totalComponents)],
    ["Threats", String(totalThreats)],
    ["Mitigated", String(threatsByStatus["MITIGATED"] ?? 0)],
    ["Coverage", `${mitigationRate}%`],
  ];
  return new Table({
    width: { size: 40, type: WidthType.PERCENTAGE },
    columnWidths: SUMMARY_COLUMNS,
    borders: thinBorder(),
    rows: rows.map(
      ([label, value]) =>
        new TableRow({
          children: [
            dataCell(label, [new TextRun({ text: label, bold: true })]),
            dataCell(value),
          ],
        }),
    ),
  });
}

export function componentsTable(data: ReportData) {
  const fill = brandFill(data);
  const header = new TableRow({
    tableHeader: true,
    children: [
      headerCell("Name", fill),
      headerCell("Type", fill),
      headerCell("Threats", fill),
    ],
  });
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: COMPONENT_COLUMNS,
    borders: thinBorder(),
    rows: [
      header,
      ...data.components.map(
        (c) =>
          new TableRow({
            children: [
              dataCell(c.name),
              dataCell(c.type),
              dataCell(String(c.threatCount)),
            ],
          }),
      ),
    ],
  });
}

export function threatsTable(data: ReportData) {
  const fill = brandFill(data);
  const header = new TableRow({
    tableHeader: true,
    children: [
      headerCell("Threat", fill),
      headerCell("Severity", fill),
      headerCell("STRIDE", fill),
      headerCell("Status", fill),
      headerCell("Mitigations", fill),
    ],
  });
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: THREAT_COLUMNS,
    borders: thinBorder(),
    rows: [
      header,
      ...data.threats.map(
        (t) =>
          new TableRow({
            children: [
              dataCell(t.name),
              dataCell("", [severityRun(t.severity)]),
              dataCell(t.strideCategory),
              dataCell(t.status),
              dataCell(String(t.mitigationCount)),
            ],
          }),
      ),
    ],
  });
}

export function mitigationParagraphs(data: ReportData): unknown[] {
  const byThreat = new Map<string, string[]>();
  for (const m of data.mitigations) {
    const list = byThreat.get(m.threatName) ?? [];
    list.push(m.description);
    byThreat.set(m.threatName, list);
  }
  const result: unknown[] = [];
  for (const [threatName, descriptions] of byThreat) {
    result.push(
      new Paragraph({
        children: [new TextRun({ text: threatName, bold: true })],
        spacing: { before: 160, after: 80 },
      }),
    );
    for (const desc of descriptions) {
      result.push(
        new Paragraph({
          children: [new TextRun({ text: desc })],
          bullet: { level: 0 },
        }),
      );
    }
  }
  return result.length > 0
    ? result
    : [
        new Paragraph({
          children: [new TextRun({ text: "No mitigations recorded." })],
        }),
      ];
}
