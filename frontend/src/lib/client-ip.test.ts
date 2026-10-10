import { describe, it, expect } from "vitest";
import { clientIpHeaders } from "./client-ip";

const from = (h: Record<string, string>) => (n: string) => h[n] ?? null;

describe("clientIpHeaders", () => {
  it("uses the last x-forwarded-for entry", () => {
    expect(
      clientIpHeaders(from({ "x-forwarded-for": "6.6.6.6, 203.0.113.7" })),
    ).toEqual({ "x-forwarded-for": "203.0.113.7" });
  });

  it("falls back to x-real-ip", () => {
    expect(clientIpHeaders(from({ "x-real-ip": "198.51.100.2" }))).toEqual({
      "x-forwarded-for": "198.51.100.2",
    });
  });

  it("sends nothing when neither header is present", () => {
    expect(clientIpHeaders(from({}))).toEqual({});
  });
});
