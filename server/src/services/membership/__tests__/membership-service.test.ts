/**
 * Membership Service Tests
 *
 * Tests for the membership service utility functions.
 */
import { describe, it, expect } from "vitest";
import { canManageRole, canAssignRole } from "../membership-service.js";

describe("Membership Service Utilities", () => {
  describe("canManageRole", () => {
    it("OWNER can manage all roles", () => {
      expect(canManageRole("OWNER", "OWNER")).toBe(true);
      expect(canManageRole("OWNER", "ADMIN")).toBe(true);
      expect(canManageRole("OWNER", "EDITOR")).toBe(true);
      expect(canManageRole("OWNER", "VIEWER")).toBe(true);
    });

    it("ADMIN can manage EDITOR and VIEWER", () => {
      expect(canManageRole("ADMIN", "EDITOR")).toBe(true);
      expect(canManageRole("ADMIN", "VIEWER")).toBe(true);
    });

    it("ADMIN cannot manage OWNER or ADMIN", () => {
      expect(canManageRole("ADMIN", "OWNER")).toBe(false);
      expect(canManageRole("ADMIN", "ADMIN")).toBe(false);
    });

    it("EDITOR cannot manage anyone", () => {
      expect(canManageRole("EDITOR", "OWNER")).toBe(false);
      expect(canManageRole("EDITOR", "ADMIN")).toBe(false);
      expect(canManageRole("EDITOR", "EDITOR")).toBe(false);
      expect(canManageRole("EDITOR", "VIEWER")).toBe(false);
    });

    it("VIEWER cannot manage anyone", () => {
      expect(canManageRole("VIEWER", "OWNER")).toBe(false);
      expect(canManageRole("VIEWER", "ADMIN")).toBe(false);
      expect(canManageRole("VIEWER", "EDITOR")).toBe(false);
      expect(canManageRole("VIEWER", "VIEWER")).toBe(false);
    });
  });

  describe("canAssignRole", () => {
    it("no one can assign OWNER role", () => {
      expect(canAssignRole("OWNER", "OWNER")).toBe(false);
      expect(canAssignRole("ADMIN", "OWNER")).toBe(false);
      expect(canAssignRole("EDITOR", "OWNER")).toBe(false);
      expect(canAssignRole("VIEWER", "OWNER")).toBe(false);
    });

    it("OWNER can assign ADMIN, EDITOR, VIEWER", () => {
      expect(canAssignRole("OWNER", "ADMIN")).toBe(true);
      expect(canAssignRole("OWNER", "EDITOR")).toBe(true);
      expect(canAssignRole("OWNER", "VIEWER")).toBe(true);
    });

    it("ADMIN can assign EDITOR and VIEWER", () => {
      expect(canAssignRole("ADMIN", "EDITOR")).toBe(true);
      expect(canAssignRole("ADMIN", "VIEWER")).toBe(true);
    });

    it("ADMIN cannot assign ADMIN", () => {
      expect(canAssignRole("ADMIN", "ADMIN")).toBe(false);
    });

    it("EDITOR cannot assign any role", () => {
      expect(canAssignRole("EDITOR", "ADMIN")).toBe(false);
      expect(canAssignRole("EDITOR", "EDITOR")).toBe(false);
      expect(canAssignRole("EDITOR", "VIEWER")).toBe(false);
    });

    it("VIEWER cannot assign any role", () => {
      expect(canAssignRole("VIEWER", "ADMIN")).toBe(false);
      expect(canAssignRole("VIEWER", "EDITOR")).toBe(false);
      expect(canAssignRole("VIEWER", "VIEWER")).toBe(false);
    });
  });
});
