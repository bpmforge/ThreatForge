/**
 * CreateModelDialog Tests
 *
 * Tests methodology selector, form validation, and submission.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CreateModelDialog } from "./CreateModelDialog";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

const mockMutateAsync = vi.fn();
vi.mock("../hooks/useDashboard", () => ({
  useCreateThreatModel: () => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
  }),
}));

vi.mock("@/features/projects", () => ({
  useProjects: () => ({ data: [] }),
}));

function renderDialog(props = {}) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <CreateModelDialog open onOpenChange={vi.fn()} {...props} />
    </QueryClientProvider>,
  );
}

describe("CreateModelDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMutateAsync.mockResolvedValue({ id: "new-model" });
  });

  it("renders methodology selector with STRIDE selected by default", () => {
    renderDialog();
    const strideBtn = screen.getByText("STRIDE").closest("button");
    expect(strideBtn).toHaveClass("border-primary");
  });

  it("shows all four methodology options", () => {
    renderDialog();
    expect(screen.getByText("STRIDE")).toBeInTheDocument();
    expect(screen.getByText("PASTA")).toBeInTheDocument();
    expect(screen.getByText("Kill Chain")).toBeInTheDocument();
    expect(screen.getByText(/MITRE ATT&CK/)).toBeInTheDocument();
  });

  it("shows methodology descriptions", () => {
    renderDialog();
    expect(
      screen.getByText(/Spoofing, Tampering, Repudiation/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Process for Attack Simulation/),
    ).toBeInTheDocument();
  });

  it("allows selecting a different methodology", () => {
    renderDialog();
    const pastaBtn = screen.getByText("PASTA").closest("button");
    fireEvent.click(pastaBtn!);
    expect(pastaBtn).toHaveClass("border-primary");

    const strideBtn = screen.getByText("STRIDE").closest("button");
    expect(strideBtn).not.toHaveClass("border-primary");
  });

  it("disables Create button when name is empty", () => {
    renderDialog();
    const createBtn = screen.getByRole("button", { name: /create model/i });
    expect(createBtn).toBeDisabled();
  });

  it("disables Create button when name is less than 3 chars", () => {
    renderDialog();
    const input = screen.getByPlaceholderText("My Application Threat Model");
    fireEvent.change(input, { target: { value: "AB" } });
    const createBtn = screen.getByRole("button", { name: /create model/i });
    expect(createBtn).toBeDisabled();
  });

  it("enables Create button with valid name", () => {
    renderDialog();
    const input = screen.getByPlaceholderText("My Application Threat Model");
    fireEvent.change(input, { target: { value: "Payment API" } });
    const createBtn = screen.getByRole("button", { name: /create model/i });
    expect(createBtn).toBeEnabled();
  });

  it("passes methodology to mutation on submit", async () => {
    renderDialog();
    const input = screen.getByPlaceholderText("My Application Threat Model");
    fireEvent.change(input, { target: { value: "Payment API" } });

    const pastaBtn = screen.getByText("PASTA").closest("button");
    fireEvent.click(pastaBtn!);

    const form = screen.getByRole("button", { name: /create model/i });
    fireEvent.click(form);

    expect(mockMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Payment API",
        methodology: "PASTA",
      }),
    );
  });

  it("shows character counter", () => {
    renderDialog();
    expect(screen.getByText("0/100")).toBeInTheDocument();
    const input = screen.getByPlaceholderText("My Application Threat Model");
    fireEvent.change(input, { target: { value: "Test" } });
    expect(screen.getByText("4/100")).toBeInTheDocument();
  });
});
