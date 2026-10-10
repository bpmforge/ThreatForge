import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ChallengeBadge } from "./ChallengeBadge";

describe("ChallengeBadge", () => {
  it("renders nothing when status is undefined", () => {
    const { container } = render(<ChallengeBadge status={undefined} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing for UNVERIFIED (not yet challenged)", () => {
    const { container } = render(<ChallengeBadge status="UNVERIFIED" />);
    expect(container.firstChild).toBeNull();
  });

  it("renders CONFIRMED as a green 'Verified' badge", () => {
    render(<ChallengeBadge status="CONFIRMED" />);
    const badge = screen.getByLabelText(/Challenge verdict: Verified/);
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent("Verified");
    expect(badge.className).toMatch(/emerald/);
  });

  it("renders UNCERTAIN as an amber 'Unverified-uncertain' badge", () => {
    render(<ChallengeBadge status="UNCERTAIN" />);
    const badge = screen.getByLabelText(
      /Challenge verdict: Unverified-uncertain/,
    );
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent("Unverified-uncertain");
    expect(badge.className).toMatch(/amber/);
  });

  it("uses the verificationNote as the UNCERTAIN tooltip and aria-label", () => {
    const note = "Topology check could not confirm an attack path";
    render(<ChallengeBadge status="UNCERTAIN" note={note} />);
    const badge = screen.getByLabelText(new RegExp(note));
    expect(badge.getAttribute("title")).toBe(note);
  });

  it("falls back to a default tooltip when no note is provided", () => {
    render(<ChallengeBadge status="UNCERTAIN" />);
    const badge = screen.getByLabelText(
      /Challenge verdict: Unverified-uncertain/,
    );
    expect(badge.getAttribute("title")).toMatch(/review before relying/i);
  });

  it("exposes an aria-label on every visible badge (accessibility)", () => {
    const { rerender } = render(<ChallengeBadge status="CONFIRMED" />);
    expect(screen.getByLabelText(/Challenge verdict/)).toBeInTheDocument();
    rerender(<ChallengeBadge status="UNCERTAIN" />);
    expect(screen.getByLabelText(/Challenge verdict/)).toBeInTheDocument();
  });

  it("composes with adjacent badges via role=listitem", () => {
    render(<ChallengeBadge status="CONFIRMED" />);
    const badge = screen.getByLabelText(/Challenge verdict: Verified/);
    expect(badge.getAttribute("role")).toBe("listitem");
  });
});
