/**
 * DOCX Report Generator
 *
 * Thin orchestrator: assembles section builders from docx-sections.ts into a
 * complete Word document and returns a Buffer via Packer.toBuffer().
 *
 * NOTE: `docx` ships ESM types with extensionless re-export paths that
 * TypeScript NodeNext resolution cannot follow. We load via createRequire
 * (a working CJS loader in ESM) and cast to sidestep the broken type resolution.
 */
import { createRequire } from "node:module";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const docxPkg = createRequire(import.meta.url)("docx") as Record<string, any>;

import type { ReportData } from "./template-engine.js";
import {
  titlePage,
  summaryTable,
  componentsTable,
  threatsTable,
  mitigationParagraphs,
} from "./docx-sections.js";

const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  Footer,
  PageNumber,
} = docxPkg;

function h2(text: string) {
  return new Paragraph({
    text,
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 400, after: 160 },
  });
}

function pageFooter() {
  return new Footer({
    children: [
      new Paragraph({
        children: [
          new TextRun({
            text: "ThreatForge · threatforge.bpmforge.com · Page ",
          }),
          new TextRun({ children: [PageNumber.CURRENT] }),
          new TextRun({ text: " of " }),
          new TextRun({ children: [PageNumber.TOTAL_PAGES] }),
        ],
        alignment: AlignmentType.CENTER,
      }),
    ],
  });
}

export async function generateDocxBuffer(data: ReportData): Promise<Buffer> {
  const doc = new Document({
    sections: [
      {
        properties: {},
        footers: { default: pageFooter() },
        children: [
          ...titlePage(data),
          h2("Executive Summary"),
          summaryTable(data),
          ...(data.components.length > 0
            ? [h2("Components"), componentsTable(data)]
            : []),
          ...(data.threats.length > 0
            ? [h2("Threat Register"), threatsTable(data)]
            : []),
          h2("Mitigations"),
          ...mitigationParagraphs(data),
        ],
      },
    ],
  });

  return Packer.toBuffer(doc) as Promise<Buffer>;
}
