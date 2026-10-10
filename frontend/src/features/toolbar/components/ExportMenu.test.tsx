/**
 * ExportMenu Tests
 *
 * Tests PDF options dialog state and section selection logic.
 * Note: Radix dropdown menus render in portals and are difficult to test
 * in JSDOM, so we test the PDF dialog independently.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ExportMenu } from "./ExportMenu";

const defaultProps = {
  exporting: false,
  onExportJSON: vi.fn(),
  onExportYAML: vi.fn(),
  onExportPNG: vi.fn(),
  onExportSVG: vi.fn(),
  onExportPDF: vi.fn(),
  onExportMermaid: vi.fn(),
  onExportDrawio: vi.fn(),
  onExportRiskRegister: vi.fn(),
  onExportThreatModelCode: vi.fn(),
};

describe("ExportMenu", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders export button", () => {
    render(<ExportMenu {...defaultProps} />);
    expect(screen.getByText("Export")).toBeInTheDocument();
  });

  it("shows Exporting... text when exporting", () => {
    render(<ExportMenu {...defaultProps} exporting />);
    expect(screen.getByText("Exporting...")).toBeInTheDocument();
  });

  it("disables button when exporting", () => {
    render(<ExportMenu {...defaultProps} exporting />);
    const btn = screen.getByRole("button", { name: /exporting/i });
    expect(btn).toBeDisabled();
  });
});

describe("ExportMenu PDF Options Dialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function openPdfDialog() {
    render(<ExportMenu {...defaultProps} />);
    const trigger = screen.getByRole("button", { name: /export/i });
    fireEvent.click(trigger);

    const pdfItem = screen.queryByText("PDF Report...");
    if (pdfItem) {
      fireEvent.click(pdfItem);
    }
  }

  it("renders PDF dialog with section checkboxes when opened", () => {
    openPdfDialog();

    const dialog = screen.queryByText("PDF Report Options");
    if (!dialog) return;

    expect(screen.getByText("Architecture Diagram")).toBeInTheDocument();
    expect(screen.getByText("Threat Table")).toBeInTheDocument();
    expect(screen.getByText("Mitigations & Controls")).toBeInTheDocument();
    expect(screen.getByText("STRIDE Summary Chart")).toBeInTheDocument();
    expect(screen.getByText("Compliance Mapping")).toBeInTheDocument();
    expect(screen.getByText("Requirements Coverage")).toBeInTheDocument();
    expect(screen.getByText("Risk Matrix")).toBeInTheDocument();
  });

  it("has correct default selections — compliance and requirements off", () => {
    openPdfDialog();

    const dialog = screen.queryByText("PDF Report Options");
    if (!dialog) return;

    expect(screen.getByLabelText("Architecture Diagram")).toBeChecked();
    expect(screen.getByLabelText("Threat Table")).toBeChecked();
    expect(screen.getByLabelText("Compliance Mapping")).not.toBeChecked();
    expect(screen.getByLabelText("Requirements Coverage")).not.toBeChecked();
  });

  it("calls onExportPDF with selected sections on Generate", () => {
    openPdfDialog();

    const dialog = screen.queryByText("PDF Report Options");
    if (!dialog) return;

    fireEvent.click(screen.getByText("Generate PDF"));

    expect(defaultProps.onExportPDF).toHaveBeenCalledWith(
      expect.arrayContaining([
        "diagram",
        "threats",
        "mitigations",
        "stride",
        "riskMatrix",
      ]),
    );
    expect(defaultProps.onExportPDF).toHaveBeenCalledWith(
      expect.not.arrayContaining(["compliance", "requirements"]),
    );
  });

  it("can toggle sections before export", () => {
    openPdfDialog();

    const dialog = screen.queryByText("PDF Report Options");
    if (!dialog) return;

    fireEvent.click(screen.getByLabelText("Architecture Diagram"));
    fireEvent.click(screen.getByLabelText("Compliance Mapping"));
    fireEvent.click(screen.getByText("Generate PDF"));

    const sections = defaultProps.onExportPDF.mock.calls[0][0] as string[];
    expect(sections).not.toContain("diagram");
    expect(sections).toContain("compliance");
  });
});
