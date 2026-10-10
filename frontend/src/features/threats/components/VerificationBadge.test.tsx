import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { VerificationBadge } from "./VerificationBadge";

describe("VerificationBadge", () => {
  it("renders nothing when status is undefined", () => {
    const { container } = render(<VerificationBadge status={undefined} />);
    expect(container.firstChild).toBeNull();
  });

  it("hides VERIFIED by default to reduce visual noise", () => {
    const { container } = render(<VerificationBadge status="VERIFIED" />);
    expect(container.firstChild).toBeNull();
  });

  it("shows VERIFIED when hideWhenVerified={false}", () => {
    render(<VerificationBadge status="VERIFIED" hideWhenVerified={false} />);
    expect(screen.getByLabelText(/Verification: Verified/)).toBeInTheDocument();
  });

  it("renders UNVERIFIED with warning style", () => {
    render(<VerificationBadge status="UNVERIFIED" />);
    const badge = screen.getByLabelText(/Verification: Unverified/);
    expect(badge).toBeInTheDocument();
    expect(badge.className).toMatch(/amber/);
  });

  it("renders PHANTOM with red/danger style", () => {
    render(<VerificationBadge status="PHANTOM" />);
    const badge = screen.getByLabelText(/Verification: Phantom/);
    expect(badge.className).toMatch(/red/);
  });

  it("renders PENDING with neutral style", () => {
    render(<VerificationBadge status="PENDING" />);
    expect(screen.getByLabelText(/Verification: Pending/)).toBeInTheDocument();
  });

  it("hides EXEMPT entirely (Not found claims don't need badging)", () => {
    const { container } = render(<VerificationBadge status="EXEMPT" />);
    expect(container.firstChild).toBeNull();
  });

  it("composes with adjacent badges via role=listitem", () => {
    render(<VerificationBadge status="UNVERIFIED" />);
    const badge = screen.getByLabelText(/Verification: Unverified/);
    expect(badge.getAttribute("role")).toBe("listitem");
  });
});
