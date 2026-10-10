import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { UnverifiedBadge } from "./UnverifiedBadge";

describe("UnverifiedBadge", () => {
  it("flags Jira as unverified with the reason in its title", () => {
    render(<UnverifiedBadge type="JIRA" />);
    const badge = screen.getByText("Unverified");
    expect(badge.getAttribute("title")).toMatch(/live Jira instance/);
  });

  it("renders nothing for integrations that are not flagged", () => {
    const { container } = render(<UnverifiedBadge type="SLACK" />);
    expect(container).toBeEmptyDOMElement();
  });
});
