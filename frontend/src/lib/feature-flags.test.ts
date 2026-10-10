import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { isFeatureEnabled } from "./feature-flags";

describe("feature-flags", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns default value when no override set", () => {
    expect(isFeatureEnabled("security-overlay")).toBe(true);
    expect(isFeatureEnabled("security-overlay")).toBe(true);
  });

  it("localStorage override takes precedence over default", () => {
    localStorage.setItem("ff:security-overlay", "true");
    expect(isFeatureEnabled("security-overlay")).toBe(true);

    localStorage.setItem("ff:security-overlay", "false");
    expect(isFeatureEnabled("security-overlay")).toBe(false);
  });

  it("env override takes precedence over default but not localStorage", () => {
    vi.stubEnv("NEXT_PUBLIC_FF_LUCID_LINES", "true");
    expect(isFeatureEnabled("security-overlay")).toBe(true);

    // localStorage beats env
    localStorage.setItem("ff:security-overlay", "false");
    expect(isFeatureEnabled("security-overlay")).toBe(false);
  });

  it("unknown flag returns false", () => {
    expect(isFeatureEnabled("nonexistent-flag")).toBe(false);
    expect(isFeatureEnabled("")).toBe(false);
  });
});
