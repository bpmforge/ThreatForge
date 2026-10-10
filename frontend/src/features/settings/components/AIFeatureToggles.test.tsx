import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AIFeatureToggles } from "./AIFeatureToggles";
import type { AISettings } from "../types";

/**
 * Admin per-org `agent-chain-v2` toggle. The flag round-trips through the
 * existing org aiSettings.features blob (see server agent-chain-flag.ts); this
 * surfaces it in the AI feature toggles, default OFF.
 */
const features: AISettings["features"] = {
  autoSuggestThreats: true,
  autoSuggestMitigations: true,
  enableChat: true,
  agentChainV2: false,
};

describe("AIFeatureToggles agent-chain-v2", () => {
  it("renders the unified-orchestrator toggle, off by default", () => {
    render(<AIFeatureToggles features={features} onChange={() => {}} />);
    const toggle = screen.getByLabelText(/Unified Orchestrator/i);
    expect(toggle).toBeTruthy();
    expect(toggle.getAttribute("aria-checked")).toBe("false");
  });

  it("emits agentChainV2: true when enabled", () => {
    const onChange = vi.fn();
    render(<AIFeatureToggles features={features} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText(/Unified Orchestrator/i));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ agentChainV2: true }),
    );
  });

  it("reflects an already-enabled flag", () => {
    render(
      <AIFeatureToggles
        features={{ ...features, agentChainV2: true }}
        onChange={() => {}}
      />,
    );
    expect(
      screen
        .getByLabelText(/Unified Orchestrator/i)
        .getAttribute("aria-checked"),
    ).toBe("true");
  });
});
