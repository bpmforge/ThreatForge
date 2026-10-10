/**
 * Invitation Service Tests
 *
 * Tests for the invitation service utility functions.
 */
import { describe, it, expect } from "vitest";
import {
  generateInvitationToken,
  calculateExpirationDate,
  isValidTokenFormat,
} from "../invitation-service.js";

describe("Invitation Service Utilities", () => {
  describe("generateInvitationToken", () => {
    it("generates tokens with correct prefix", () => {
      const token = generateInvitationToken();
      expect(token.startsWith("inv_")).toBe(true);
    });

    it("generates tokens of correct length", () => {
      const token = generateInvitationToken();
      // inv_ (4 chars) + 64 hex chars = 68 total
      expect(token.length).toBe(68);
    });

    it("generates unique tokens", () => {
      const tokens = new Set<string>();
      for (let i = 0; i < 100; i++) {
        tokens.add(generateInvitationToken());
      }
      expect(tokens.size).toBe(100);
    });
  });

  describe("calculateExpirationDate", () => {
    it("calculates expiration with default 7 days", () => {
      const now = new Date();
      const expiration = calculateExpirationDate();

      const diffInDays = Math.round(
        (expiration.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
      );
      expect(diffInDays).toBe(7);
    });

    it("calculates expiration with custom days", () => {
      const now = new Date();
      const expiration = calculateExpirationDate(14);

      const diffInDays = Math.round(
        (expiration.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
      );
      expect(diffInDays).toBe(14);
    });

    it("calculates expiration with 1 day", () => {
      const now = new Date();
      const expiration = calculateExpirationDate(1);

      const diffInDays = Math.round(
        (expiration.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
      );
      expect(diffInDays).toBe(1);
    });
  });

  describe("isValidTokenFormat", () => {
    it("accepts valid token format", () => {
      const validToken = "inv_" + "a".repeat(64);
      expect(isValidTokenFormat(validToken)).toBe(true);
    });

    it("accepts token with mixed hex characters", () => {
      const validToken = "inv_" + "abcdef1234567890".repeat(4);
      expect(isValidTokenFormat(validToken)).toBe(true);
    });

    it("rejects token without prefix", () => {
      const invalidToken = "a".repeat(64);
      expect(isValidTokenFormat(invalidToken)).toBe(false);
    });

    it("rejects token with wrong prefix", () => {
      const invalidToken = "tok_" + "a".repeat(64);
      expect(isValidTokenFormat(invalidToken)).toBe(false);
    });

    it("rejects token that is too short", () => {
      const invalidToken = "inv_" + "a".repeat(32);
      expect(isValidTokenFormat(invalidToken)).toBe(false);
    });

    it("rejects token that is too long", () => {
      const invalidToken = "inv_" + "a".repeat(128);
      expect(isValidTokenFormat(invalidToken)).toBe(false);
    });

    it("rejects empty string", () => {
      expect(isValidTokenFormat("")).toBe(false);
    });

    it("rejects just prefix", () => {
      expect(isValidTokenFormat("inv_")).toBe(false);
    });
  });
});
