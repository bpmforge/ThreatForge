/**
 * Guest Access Service Tests
 *
 * Tests for the guest access service utility functions.
 */
import { describe, it, expect } from "vitest";
import {
  generateAccessToken,
  isValidTokenFormat,
} from "../guest-access-service.js";

describe("Guest Access Service Utilities", () => {
  describe("generateAccessToken", () => {
    it("generates tokens with correct prefix", () => {
      const token = generateAccessToken();
      expect(token.startsWith("gst_")).toBe(true);
    });

    it("generates tokens of correct length", () => {
      const token = generateAccessToken();
      // gst_ (4 chars) + 64 hex chars = 68 total
      expect(token.length).toBe(68);
    });

    it("generates unique tokens", () => {
      const tokens = new Set<string>();
      for (let i = 0; i < 100; i++) {
        tokens.add(generateAccessToken());
      }
      expect(tokens.size).toBe(100);
    });
  });

  describe("isValidTokenFormat", () => {
    it("accepts valid token format", () => {
      const validToken = "gst_" + "a".repeat(64);
      expect(isValidTokenFormat(validToken)).toBe(true);
    });

    it("accepts token with mixed hex characters", () => {
      const validToken = "gst_" + "abcdef1234567890".repeat(4);
      expect(isValidTokenFormat(validToken)).toBe(true);
    });

    it("rejects token without prefix", () => {
      const invalidToken = "a".repeat(64);
      expect(isValidTokenFormat(invalidToken)).toBe(false);
    });

    it("rejects token with wrong prefix", () => {
      const invalidToken = "inv_" + "a".repeat(64);
      expect(isValidTokenFormat(invalidToken)).toBe(false);
    });

    it("rejects token that is too short", () => {
      const invalidToken = "gst_" + "a".repeat(32);
      expect(isValidTokenFormat(invalidToken)).toBe(false);
    });

    it("rejects token that is too long", () => {
      const invalidToken = "gst_" + "a".repeat(128);
      expect(isValidTokenFormat(invalidToken)).toBe(false);
    });

    it("rejects empty string", () => {
      expect(isValidTokenFormat("")).toBe(false);
    });

    it("rejects just prefix", () => {
      expect(isValidTokenFormat("gst_")).toBe(false);
    });
  });
});
