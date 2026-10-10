/**
 * Username Utility Tests
 *
 * Tests for username generation and validation.
 */
import { describe, it, expect } from "vitest";
import {
  validateUsernameFormat,
  generatePersonalOrgSlug,
  isPersonalOrgSlug,
  RESERVED_USERNAMES,
} from "./username";

// Note: generateUsername and validateUsername require database access
// and are tested in integration tests. Here we test the sync functions.

describe("username utilities", () => {
  describe("validateUsernameFormat", () => {
    it("accepts valid usernames", () => {
      const validUsernames = [
        "john",
        "john-doe",
        "john123",
        "a1b2c3",
        "123abc",
        "my-user-name",
      ];

      for (const username of validUsernames) {
        const result = validateUsernameFormat(username);
        expect(result.valid, `Expected "${username}" to be valid`).toBe(true);
      }
    });

    it("rejects usernames shorter than 3 characters", () => {
      const result = validateUsernameFormat("ab");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("at least 3 characters");
    });

    it("rejects usernames longer than 30 characters", () => {
      const longUsername = "a".repeat(31);
      const result = validateUsernameFormat(longUsername);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("at most 30 characters");
    });

    it("rejects usernames with uppercase letters", () => {
      const result = validateUsernameFormat("JohnDoe");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("lowercase letters");
    });

    it("rejects usernames with spaces", () => {
      const result = validateUsernameFormat("john doe");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("lowercase letters");
    });

    it("rejects usernames with special characters", () => {
      const invalidUsernames = [
        "john_doe",
        "john.doe",
        "john@doe",
        "john!doe",
        "john#doe",
      ];

      for (const username of invalidUsernames) {
        const result = validateUsernameFormat(username);
        expect(result.valid, `Expected "${username}" to be invalid`).toBe(
          false,
        );
        expect(result.error).toContain("lowercase letters");
      }
    });

    it("rejects usernames starting with a hyphen", () => {
      const result = validateUsernameFormat("-johndoe");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("start or end with a hyphen");
    });

    it("rejects usernames ending with a hyphen", () => {
      const result = validateUsernameFormat("johndoe-");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("start or end with a hyphen");
    });

    it("rejects usernames with consecutive hyphens", () => {
      const result = validateUsernameFormat("john--doe");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("consecutive hyphens");
    });

    it("rejects reserved usernames", () => {
      const reservedToTest = ["admin", "api", "login", "system", "dashboard"];

      for (const username of reservedToTest) {
        const result = validateUsernameFormat(username);
        expect(result.valid, `Expected "${username}" to be reserved`).toBe(
          false,
        );
        expect(result.error).toContain("reserved");
      }
    });

    it("accepts usernames containing reserved words as substrings", () => {
      // "admin" is reserved, but "myadmin" or "adminuser" should be allowed
      const validUsernames = ["myadmin", "adminuser", "superadmin", "sysadmin"];

      for (const username of validUsernames) {
        // Only exact matches should be blocked
        if (!RESERVED_USERNAMES.includes(username)) {
          const result = validateUsernameFormat(username);
          expect(result.valid, `Expected "${username}" to be valid`).toBe(true);
        }
      }
    });

    it("accepts exactly 3 character usernames", () => {
      const result = validateUsernameFormat("abc");
      expect(result.valid).toBe(true);
    });

    it("accepts exactly 30 character usernames", () => {
      const username = "a".repeat(30);
      const result = validateUsernameFormat(username);
      expect(result.valid).toBe(true);
    });
  });

  describe("generatePersonalOrgSlug", () => {
    it("appends -personal to username", () => {
      expect(generatePersonalOrgSlug("johndoe")).toBe("johndoe-personal");
      expect(generatePersonalOrgSlug("jane-doe")).toBe("jane-doe-personal");
      expect(generatePersonalOrgSlug("user123")).toBe("user123-personal");
    });
  });

  describe("isPersonalOrgSlug", () => {
    it("returns true for personal org slugs", () => {
      expect(isPersonalOrgSlug("johndoe-personal")).toBe(true);
      expect(isPersonalOrgSlug("jane-doe-personal")).toBe(true);
      expect(isPersonalOrgSlug("user-personal")).toBe(true);
    });

    it("returns false for non-personal org slugs", () => {
      expect(isPersonalOrgSlug("acme-corp")).toBe(false);
      expect(isPersonalOrgSlug("my-team")).toBe(false);
      expect(isPersonalOrgSlug("personal-team")).toBe(false); // Contains "personal" but doesn't end with "-personal"
      expect(isPersonalOrgSlug("johndoe")).toBe(false);
    });
  });

  describe("RESERVED_USERNAMES", () => {
    it("includes common system routes", () => {
      expect(RESERVED_USERNAMES).toContain("admin");
      expect(RESERVED_USERNAMES).toContain("api");
      expect(RESERVED_USERNAMES).toContain("auth");
      expect(RESERVED_USERNAMES).toContain("login");
      expect(RESERVED_USERNAMES).toContain("logout");
      expect(RESERVED_USERNAMES).toContain("register");
      expect(RESERVED_USERNAMES).toContain("settings");
    });

    it("includes app-specific routes", () => {
      expect(RESERVED_USERNAMES).toContain("dashboard");
      expect(RESERVED_USERNAMES).toContain("projects");
      expect(RESERVED_USERNAMES).toContain("models");
      expect(RESERVED_USERNAMES).toContain("templates");
      expect(RESERVED_USERNAMES).toContain("shared");
    });

    it("includes common reserved words", () => {
      expect(RESERVED_USERNAMES).toContain("null");
      expect(RESERVED_USERNAMES).toContain("undefined");
      expect(RESERVED_USERNAMES).toContain("root");
      expect(RESERVED_USERNAMES).toContain("system");
    });
  });
});
