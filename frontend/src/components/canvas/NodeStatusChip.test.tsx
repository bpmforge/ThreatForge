import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { NodeStatusChip } from "./NodeStatusChip";
import type { NodeStatus } from "./NodeStatusChip";

describe("NodeStatusChip", () => {
  it("renders 'Draft' for draft status", () => {
    render(<NodeStatusChip status="draft" />);
    expect(screen.getByText("Draft")).toBeTruthy();
  });

  it("renders 'In Review' for in-review status", () => {
    render(<NodeStatusChip status="in-review" />);
    expect(screen.getByText("In Review")).toBeTruthy();
  });

  it("renders 'Approved' for approved status", () => {
    render(<NodeStatusChip status="approved" />);
    expect(screen.getByText("Approved")).toBeTruthy();
  });

  it("renders 'Deprecated' for deprecated status", () => {
    render(<NodeStatusChip status="deprecated" />);
    expect(screen.getByText("Deprecated")).toBeTruthy();
  });

  it("returns nothing when status is null", () => {
    const { container } = render(<NodeStatusChip status={null} />);
    expect(container.firstChild).toBeNull();
  });

  it("returns nothing when status is undefined", () => {
    const { container } = render(<NodeStatusChip />);
    expect(container.firstChild).toBeNull();
  });

  it("has accessible aria-label for each status", () => {
    const statuses: NodeStatus[] = [
      "draft",
      "in-review",
      "approved",
      "deprecated",
    ];
    const labels = [
      "Status: Draft",
      "Status: In Review",
      "Status: Approved",
      "Status: Deprecated",
    ];
    statuses.forEach((status, i) => {
      const { container } = render(<NodeStatusChip status={status} />);
      expect(
        container.querySelector(`[aria-label="${labels[i]}"]`),
      ).toBeTruthy();
    });
  });
});
