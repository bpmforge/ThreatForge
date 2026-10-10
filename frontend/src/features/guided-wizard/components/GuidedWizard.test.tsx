/**
 * GuidedWizard Tests
 *
 * Tests STRIDE explainer step presence and component guard.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { GuidedWizard } from "./GuidedWizard";

const mockState = {
  step: 1,
  answers: { systemType: "WEB_APP", systemName: "Test App" },
  suggestedComponents: [
    {
      id: "s-0",
      name: "Web Server",
      type: "SERVICE",
      description: "",
      selected: true,
    },
    {
      id: "s-1",
      name: "Database",
      type: "DATABASE",
      description: "",
      selected: true,
    },
  ],
  isGenerating: false,
};

const mockHook = {
  state: { ...mockState },
  setAnswers: vi.fn(),
  nextStep: vi.fn(),
  prevStep: vi.fn(),
  generateSuggestions: vi.fn(),
  toggleComponent: vi.fn(),
  reset: vi.fn(),
  totalSteps: 4,
};

vi.mock("../hooks/useGuidedWizard", () => ({
  useGuidedWizard: () => mockHook,
}));

vi.mock("./WizardProgress", () => ({
  WizardProgress: ({
    currentStep,
    totalSteps,
  }: {
    currentStep: number;
    totalSteps: number;
  }) => (
    <div data-testid="progress">
      Step {currentStep}/{totalSteps}
    </div>
  ),
}));

vi.mock("./steps/SystemTypeStep", () => ({
  SystemTypeStep: () => <div data-testid="system-type-step">System Type</div>,
}));

vi.mock("./steps/ComponentsStep", () => ({
  ComponentsStep: () => <div data-testid="components-step">Components</div>,
}));

describe("GuidedWizard", () => {
  const onComplete = vi.fn();
  const onOpenChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockHook.state = { ...mockState, step: 1 };
  });

  it("renders step 1 with system type form", () => {
    render(
      <GuidedWizard open onOpenChange={onOpenChange} onComplete={onComplete} />,
    );
    expect(screen.getByTestId("system-type-step")).toBeInTheDocument();
    expect(screen.getByTestId("progress")).toHaveTextContent("Step 1/4");
  });

  it("shows 4 total steps", () => {
    render(
      <GuidedWizard open onOpenChange={onOpenChange} onComplete={onComplete} />,
    );
    expect(screen.getByTestId("progress")).toHaveTextContent("4");
  });

  it("shows Skip Wizard button", () => {
    render(
      <GuidedWizard open onOpenChange={onOpenChange} onComplete={onComplete} />,
    );
    expect(screen.getByText("Skip Wizard")).toBeInTheDocument();
  });

  it("does not show Back on step 1", () => {
    render(
      <GuidedWizard open onOpenChange={onOpenChange} onComplete={onComplete} />,
    );
    expect(screen.queryByText("Back")).not.toBeInTheDocument();
  });

  it("shows STRIDE explainer on step 2", () => {
    mockHook.state = { ...mockState, step: 2 };
    render(
      <GuidedWizard open onOpenChange={onOpenChange} onComplete={onComplete} />,
    );
    expect(
      screen.getByText("How STRIDE Threat Modeling Works"),
    ).toBeInTheDocument();
    expect(screen.getByText(/Spoofing/)).toBeInTheDocument();
    expect(screen.getByText(/Tampering/)).toBeInTheDocument();
    expect(screen.getByText(/Repudiation/)).toBeInTheDocument();
    expect(screen.getByText(/Info Disclosure/)).toBeInTheDocument();
    expect(screen.getByText(/Denial of Service/)).toBeInTheDocument();
    expect(screen.getByText(/Elevation of Privilege/)).toBeInTheDocument();
  });

  it("shows STRIDE teaching note on step 2", () => {
    mockHook.state = { ...mockState, step: 2 };
    render(
      <GuidedWizard open onOpenChange={onOpenChange} onComplete={onComplete} />,
    );
    expect(
      screen.getByText(/AI will suggest relevant threats/),
    ).toBeInTheDocument();
  });

  it("shows Back button on step 2", () => {
    mockHook.state = { ...mockState, step: 2 };
    render(
      <GuidedWizard open onOpenChange={onOpenChange} onComplete={onComplete} />,
    );
    expect(screen.getByText("Back")).toBeInTheDocument();
  });

  it("shows components step on step 3", () => {
    mockHook.state = { ...mockState, step: 3 };
    render(
      <GuidedWizard open onOpenChange={onOpenChange} onComplete={onComplete} />,
    );
    expect(screen.getByTestId("components-step")).toBeInTheDocument();
  });

  it("shows Create Model on step 4", () => {
    mockHook.state = { ...mockState, step: 4 };
    render(
      <GuidedWizard open onOpenChange={onOpenChange} onComplete={onComplete} />,
    );
    expect(screen.getByText("Ready to create your model")).toBeInTheDocument();
    expect(screen.getByText("Create Model")).toBeInTheDocument();
  });

  it("disables Next on step 3 when no components selected", () => {
    mockHook.state = {
      ...mockState,
      step: 3,
      suggestedComponents: [
        {
          id: "s-0",
          name: "Web Server",
          type: "SERVICE",
          description: "",
          selected: false,
        },
        {
          id: "s-1",
          name: "Database",
          type: "DATABASE",
          description: "",
          selected: false,
        },
      ],
    };
    render(
      <GuidedWizard open onOpenChange={onOpenChange} onComplete={onComplete} />,
    );
    const nextBtn = screen.getByText("Next");
    expect(nextBtn).toBeDisabled();
  });

  it("enables Next on step 3 when at least one component selected", () => {
    mockHook.state = {
      ...mockState,
      step: 3,
      suggestedComponents: [
        {
          id: "s-0",
          name: "Web Server",
          type: "SERVICE",
          description: "",
          selected: true,
        },
        {
          id: "s-1",
          name: "Database",
          type: "DATABASE",
          description: "",
          selected: false,
        },
      ],
    };
    render(
      <GuidedWizard open onOpenChange={onOpenChange} onComplete={onComplete} />,
    );
    const nextBtn = screen.getByText("Next");
    expect(nextBtn).toBeEnabled();
  });
});
