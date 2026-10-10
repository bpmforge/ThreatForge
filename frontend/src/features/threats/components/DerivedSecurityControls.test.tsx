/**
 * DerivedSecurityControls Component Tests
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DerivedSecurityControls } from "./DerivedSecurityControls";
import type { ConnectionData } from "@/types/canvas";

describe("DerivedSecurityControls", () => {
  it("should render nothing when connectionData is undefined", () => {
    const { container } = render(
      <DerivedSecurityControls connectionData={undefined} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("should render nothing when no security controls are enabled", () => {
    const connectionData: ConnectionData = {
      label: "API Request",
    };
    const { container } = render(
      <DerivedSecurityControls connectionData={connectionData} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("should show TLS Encryption when encrypted is true", () => {
    const connectionData: ConnectionData = {
      encrypted: true,
    };
    render(<DerivedSecurityControls connectionData={connectionData} />);
    expect(screen.getByText("TLS Encryption")).toBeInTheDocument();
    expect(screen.getByText("Applied Security Controls")).toBeInTheDocument();
  });

  it("should show mTLS authentication when authentication is mTLS", () => {
    const connectionData: ConnectionData = {
      authentication: "mTLS",
    };
    render(<DerivedSecurityControls connectionData={connectionData} />);
    expect(screen.getByText("Mutual TLS (mTLS)")).toBeInTheDocument();
  });

  it("should show JWT authentication when authentication is JWT", () => {
    const connectionData: ConnectionData = {
      authentication: "JWT",
    };
    render(<DerivedSecurityControls connectionData={connectionData} />);
    expect(screen.getByText("JWT Token Authentication")).toBeInTheDocument();
  });

  it("should show OAuth2 authentication", () => {
    const connectionData: ConnectionData = {
      authentication: "OAuth2",
    };
    render(<DerivedSecurityControls connectionData={connectionData} />);
    expect(screen.getByText("OAuth 2.0 Authorization")).toBeInTheDocument();
  });

  it("should show API Key authentication", () => {
    const connectionData: ConnectionData = {
      authentication: "API_KEY",
    };
    render(<DerivedSecurityControls connectionData={connectionData} />);
    expect(screen.getByText("API Key Authentication")).toBeInTheDocument();
  });

  it("should not show authentication control when set to None", () => {
    const connectionData: ConnectionData = {
      authentication: "None",
    };
    const { container } = render(
      <DerivedSecurityControls connectionData={connectionData} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("should show HTTPS protocol when set and not encrypted", () => {
    const connectionData: ConnectionData = {
      protocol: "HTTPS",
      encrypted: false,
    };
    render(<DerivedSecurityControls connectionData={connectionData} />);
    expect(screen.getByText("HTTPS Protocol")).toBeInTheDocument();
  });

  it("should NOT show HTTPS when encrypted is already true (avoid duplication)", () => {
    const connectionData: ConnectionData = {
      protocol: "HTTPS",
      encrypted: true,
    };
    render(<DerivedSecurityControls connectionData={connectionData} />);
    expect(screen.getByText("TLS Encryption")).toBeInTheDocument();
    expect(screen.queryByText("HTTPS Protocol")).not.toBeInTheDocument();
  });

  it("should show multiple controls when multiple are enabled", () => {
    const connectionData: ConnectionData = {
      encrypted: true,
      authentication: "OAuth2",
    };
    render(<DerivedSecurityControls connectionData={connectionData} />);
    expect(screen.getByText("TLS Encryption")).toBeInTheDocument();
    expect(screen.getByText("OAuth 2.0 Authorization")).toBeInTheDocument();
  });

  it("should show authenticated flag when authenticated is true without specific method", () => {
    const connectionData: ConnectionData = {
      authenticated: true,
    };
    render(<DerivedSecurityControls connectionData={connectionData} />);
    expect(screen.getByText("Authentication Required")).toBeInTheDocument();
  });

  it("should show SAML authentication", () => {
    const connectionData: ConnectionData = {
      authentication: "SAML",
    };
    render(<DerivedSecurityControls connectionData={connectionData} />);
    expect(screen.getByText("SAML Authentication")).toBeInTheDocument();
  });

  it("should show Basic authentication", () => {
    const connectionData: ConnectionData = {
      authentication: "Basic",
    };
    render(<DerivedSecurityControls connectionData={connectionData} />);
    expect(screen.getByText("Basic Authentication")).toBeInTheDocument();
  });
});
