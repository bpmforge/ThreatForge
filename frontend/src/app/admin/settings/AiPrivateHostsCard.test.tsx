import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AiPrivateHostsCard } from "./AiPrivateHostsCard";
import type { AdminSettings } from "./useAdminSettings";

function settings(overrides: Partial<AdminSettings> = {}): AdminSettings {
  return {
    aiPrivateHostAllowlistText: "",
    aiAllowAllPrivateHosts: false,
    aiPrivateHostAllowlistFromEnv: [],
    aiAllowAllPrivateHostsFromEnv: false,
    ...overrides,
  } as AdminSettings;
}

describe("AiPrivateHostsCard", () => {
  it("edits the allowlist one entry per line", () => {
    const onUpdate = vi.fn();
    render(<AiPrivateHostsCard settings={settings()} onUpdate={onUpdate} />);
    fireEvent.change(screen.getByLabelText(/allowed private hosts/i), {
      target: { value: "192.168.50.0/24\nlmstudio.lan" },
    });
    expect(onUpdate).toHaveBeenCalledWith({
      aiPrivateHostAllowlistText: "192.168.50.0/24\nlmstudio.lan",
    });
  });

  it("toggles allow-all, which is off by default", () => {
    const onUpdate = vi.fn();
    render(<AiPrivateHostsCard settings={settings()} onUpdate={onUpdate} />);
    const toggle = screen.getByRole("switch", {
      name: /allow all private hosts/i,
    });
    expect(toggle.getAttribute("aria-checked")).toBe("false");
    fireEvent.click(toggle);
    expect(onUpdate).toHaveBeenCalledWith({ aiAllowAllPrivateHosts: true });
  });

  it("shows what the server environment adds, read-only", () => {
    render(
      <AiPrivateHostsCard
        settings={settings({
          aiPrivateHostAllowlistFromEnv: ["127.0.0.1"],
          aiAllowAllPrivateHostsFromEnv: true,
        })}
        onUpdate={vi.fn()}
      />,
    );
    expect(screen.getByText("127.0.0.1")).toBeTruthy();
    expect(screen.getByText(/AI_ALLOW_ALL_PRIVATE_HOSTS/)).toBeTruthy();
  });
});
