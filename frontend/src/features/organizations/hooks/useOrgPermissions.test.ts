/**
 * useOrgPermissions Hook Tests
 *
 * Tests the organization permission logic:
 * - Role hierarchy (OWNER > ADMIN > EDITOR > VIEWER)
 * - Permission checks (isOwnerOf, isAdminOf, canEditIn, isMemberOf)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useOrgPermissions } from "./useOrgPermissions";

// Mock next-auth/react
const mockUseSession = vi.fn();

vi.mock("next-auth/react", () => ({
  useSession: () => mockUseSession(),
}));

describe("useOrgPermissions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("with no session", () => {
    it("returns empty memberships when loading", () => {
      mockUseSession.mockReturnValue({
        data: null,
        status: "loading",
      });

      const { result } = renderHook(() => useOrgPermissions());

      expect(result.current.isLoading).toBe(true);
      expect(result.current.memberships).toEqual([]);
    });

    it("returns empty memberships when unauthenticated", () => {
      mockUseSession.mockReturnValue({
        data: null,
        status: "unauthenticated",
      });

      const { result } = renderHook(() => useOrgPermissions());

      expect(result.current.isLoading).toBe(false);
      expect(result.current.memberships).toEqual([]);
      expect(result.current.hasAnyOrgAdminRole).toBe(false);
    });
  });

  describe("with authenticated session", () => {
    const mockMemberships = [
      {
        orgId: "org-1",
        orgSlug: "acme",
        orgName: "Acme Inc",
        role: "OWNER" as const,
      },
      {
        orgId: "org-2",
        orgSlug: "beta",
        orgName: "Beta Corp",
        role: "ADMIN" as const,
      },
      {
        orgId: "org-3",
        orgSlug: "gamma",
        orgName: "Gamma LLC",
        role: "EDITOR" as const,
      },
      {
        orgId: "org-4",
        orgSlug: "delta",
        orgName: "Delta Ltd",
        role: "VIEWER" as const,
      },
    ];

    beforeEach(() => {
      mockUseSession.mockReturnValue({
        data: {
          user: {
            id: "user-1",
            name: "Test User",
            email: "test@example.com",
            memberships: mockMemberships,
          },
        },
        status: "authenticated",
      });
    });

    it("returns memberships from session", () => {
      const { result } = renderHook(() => useOrgPermissions());

      expect(result.current.isLoading).toBe(false);
      expect(result.current.memberships).toEqual(mockMemberships);
    });

    describe("getRoleInOrg", () => {
      it("returns correct role for each org", () => {
        const { result } = renderHook(() => useOrgPermissions());

        expect(result.current.getRoleInOrg("org-1")).toBe("OWNER");
        expect(result.current.getRoleInOrg("org-2")).toBe("ADMIN");
        expect(result.current.getRoleInOrg("org-3")).toBe("EDITOR");
        expect(result.current.getRoleInOrg("org-4")).toBe("VIEWER");
      });

      it("returns null for non-member org", () => {
        const { result } = renderHook(() => useOrgPermissions());

        expect(result.current.getRoleInOrg("org-999")).toBeNull();
      });
    });

    describe("isOwnerOf", () => {
      it("returns true only for OWNER role", () => {
        const { result } = renderHook(() => useOrgPermissions());

        expect(result.current.isOwnerOf("org-1")).toBe(true);
        expect(result.current.isOwnerOf("org-2")).toBe(false);
        expect(result.current.isOwnerOf("org-3")).toBe(false);
        expect(result.current.isOwnerOf("org-4")).toBe(false);
      });

      it("returns false for non-member org", () => {
        const { result } = renderHook(() => useOrgPermissions());

        expect(result.current.isOwnerOf("org-999")).toBe(false);
      });
    });

    describe("isAdminOf", () => {
      it("returns true for OWNER and ADMIN roles", () => {
        const { result } = renderHook(() => useOrgPermissions());

        expect(result.current.isAdminOf("org-1")).toBe(true); // OWNER
        expect(result.current.isAdminOf("org-2")).toBe(true); // ADMIN
        expect(result.current.isAdminOf("org-3")).toBe(false); // EDITOR
        expect(result.current.isAdminOf("org-4")).toBe(false); // VIEWER
      });

      it("returns false for non-member org", () => {
        const { result } = renderHook(() => useOrgPermissions());

        expect(result.current.isAdminOf("org-999")).toBe(false);
      });
    });

    describe("canEditIn", () => {
      it("returns true for OWNER, ADMIN, and EDITOR roles", () => {
        const { result } = renderHook(() => useOrgPermissions());

        expect(result.current.canEditIn("org-1")).toBe(true); // OWNER
        expect(result.current.canEditIn("org-2")).toBe(true); // ADMIN
        expect(result.current.canEditIn("org-3")).toBe(true); // EDITOR
        expect(result.current.canEditIn("org-4")).toBe(false); // VIEWER
      });

      it("returns false for non-member org", () => {
        const { result } = renderHook(() => useOrgPermissions());

        expect(result.current.canEditIn("org-999")).toBe(false);
      });
    });

    describe("isMemberOf", () => {
      it("returns true for any membership role", () => {
        const { result } = renderHook(() => useOrgPermissions());

        expect(result.current.isMemberOf("org-1")).toBe(true);
        expect(result.current.isMemberOf("org-2")).toBe(true);
        expect(result.current.isMemberOf("org-3")).toBe(true);
        expect(result.current.isMemberOf("org-4")).toBe(true);
      });

      it("returns false for non-member org", () => {
        const { result } = renderHook(() => useOrgPermissions());

        expect(result.current.isMemberOf("org-999")).toBe(false);
      });
    });

    describe("hasAnyOrgAdminRole", () => {
      it("returns true when user has OWNER or ADMIN in any org", () => {
        const { result } = renderHook(() => useOrgPermissions());

        expect(result.current.hasAnyOrgAdminRole).toBe(true);
      });

      it("returns false when user only has EDITOR/VIEWER roles", () => {
        mockUseSession.mockReturnValue({
          data: {
            user: {
              id: "user-1",
              memberships: [
                {
                  orgId: "org-1",
                  orgSlug: "test",
                  orgName: "Test",
                  role: "EDITOR" as const,
                },
                {
                  orgId: "org-2",
                  orgSlug: "test2",
                  orgName: "Test2",
                  role: "VIEWER" as const,
                },
              ],
            },
          },
          status: "authenticated",
        });

        const { result } = renderHook(() => useOrgPermissions());

        expect(result.current.hasAnyOrgAdminRole).toBe(false);
      });
    });
  });

  describe("edge cases", () => {
    it("handles empty memberships array", () => {
      mockUseSession.mockReturnValue({
        data: {
          user: {
            id: "user-1",
            memberships: [],
          },
        },
        status: "authenticated",
      });

      const { result } = renderHook(() => useOrgPermissions());

      expect(result.current.memberships).toEqual([]);
      expect(result.current.hasAnyOrgAdminRole).toBe(false);
      expect(result.current.getRoleInOrg("any-org")).toBeNull();
    });

    it("handles missing memberships in session", () => {
      mockUseSession.mockReturnValue({
        data: {
          user: {
            id: "user-1",
            // memberships is undefined
          },
        },
        status: "authenticated",
      });

      const { result } = renderHook(() => useOrgPermissions());

      expect(result.current.memberships).toEqual([]);
    });
  });
});
