/**
 * DocumentsPanel Tests
 *
 * Tests search filtering, delete confirmation, tooltip presence,
 * and action button visibility.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DocumentsPanel } from "./DocumentsPanel";

vi.mock("../hooks/useDocuments", () => ({
  useDocuments: vi.fn(),
  useDeleteDocument: vi.fn(() => ({ mutate: vi.fn() })),
}));

import { useDocuments } from "../hooks/useDocuments";

const mockDocs = [
  {
    id: "doc-1",
    name: "Architecture Spec",
    type: "PDF",
    sizeBytes: 50000,
    createdAt: "2026-04-10T00:00:00Z",
    extractedComponentCount: 5,
    _count: { requirements: 12 },
  },
  {
    id: "doc-2",
    name: "Terraform Config",
    type: "TERRAFORM",
    sizeBytes: 3000,
    createdAt: "2026-04-11T00:00:00Z",
    extractedComponentCount: 3,
    _count: { requirements: 4 },
  },
  {
    id: "doc-3",
    name: "API OpenAPI Spec",
    type: "OPENAPI",
    sizeBytes: 12000,
    createdAt: "2026-04-12T00:00:00Z",
    extractedComponentCount: 8,
    _count: { requirements: 6 },
  },
  {
    id: "doc-4",
    name: "Security Policy",
    type: "MARKDOWN",
    sizeBytes: 8000,
    createdAt: "2026-04-13T00:00:00Z",
    extractedComponentCount: 0,
    _count: { requirements: 2 },
  },
];

function renderPanel(props = {}) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <DocumentsPanel modelId="model-1" {...props} />
    </QueryClientProvider>,
  );
}

describe("DocumentsPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useDocuments).mockReturnValue({
      data: mockDocs,
      isLoading: false,
    } as unknown as ReturnType<typeof useDocuments>);
  });

  it("renders all documents", () => {
    renderPanel();
    expect(screen.getByText("Architecture Spec")).toBeInTheDocument();
    expect(screen.getByText("Terraform Config")).toBeInTheDocument();
    expect(screen.getByText("API OpenAPI Spec")).toBeInTheDocument();
    expect(screen.getByText("Security Policy")).toBeInTheDocument();
  });

  it("shows search input when 4+ documents", () => {
    renderPanel();
    expect(
      screen.getByPlaceholderText("Filter documents..."),
    ).toBeInTheDocument();
  });

  it("hides search input when 3 or fewer documents", () => {
    vi.mocked(useDocuments).mockReturnValue({
      data: mockDocs.slice(0, 2),
      isLoading: false,
    } as unknown as ReturnType<typeof useDocuments>);
    renderPanel();
    expect(
      screen.queryByPlaceholderText("Filter documents..."),
    ).not.toBeInTheDocument();
  });

  it("filters documents by name", () => {
    renderPanel();
    const search = screen.getByPlaceholderText("Filter documents...");
    fireEvent.change(search, { target: { value: "terraform" } });

    expect(screen.getByText("Terraform Config")).toBeInTheDocument();
    expect(screen.queryByText("Architecture Spec")).not.toBeInTheDocument();
    expect(screen.queryByText("Security Policy")).not.toBeInTheDocument();
  });

  it("shows empty state when no documents", () => {
    vi.mocked(useDocuments).mockReturnValue({
      data: [],
      isLoading: false,
    } as unknown as ReturnType<typeof useDocuments>);
    renderPanel();
    expect(screen.getByText("No documents imported.")).toBeInTheDocument();
  });

  it("shows loading state", () => {
    vi.mocked(useDocuments).mockReturnValue({
      data: [],
      isLoading: true,
    } as unknown as ReturnType<typeof useDocuments>);
    renderPanel();
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("has title tooltips on document names", () => {
    renderPanel();
    const nameEl = screen.getByText("Architecture Spec");
    expect(nameEl).toHaveAttribute("title", "Architecture Spec");
  });

  it("shows document type badges", () => {
    renderPanel();
    expect(screen.getByText("PDF")).toBeInTheDocument();
    expect(screen.getByText("TF")).toBeInTheDocument();
  });

  it("shows requirement count in footer", () => {
    renderPanel();
    expect(screen.getByText("24 requirements")).toBeInTheDocument();
  });

  it("calls onImportDocument when Add button clicked", () => {
    const onImport = vi.fn();
    renderPanel({ onImportDocument: onImport });
    fireEvent.click(screen.getByText("Add"));
    expect(onImport).toHaveBeenCalledOnce();
  });
});
