/**
 * useSystemAdminGuard Hook Tests
 *
 * Tests the system admin guard logic:
 * - Only system admins (isSystemAdmin) have access
 * - Org admins (OWNER/ADMIN roles) do NOT have access
 * - Proper redirects for unauthenticated and non-admin users
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useSystemAdminGuard } from "./useSystemAdminGuard";

// Mock next-auth/react
const mockUseSession = vi.fn();

vi.mock("next-auth/react", () => ({
  useSession: () => mockUseSession(),
}));

// Mock next/navigation
const mockRouterReplace = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: mockRouterReplace,
  }),
}));

describe("useSystemAdminGuard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("loading state", () => {
    it("returns isLoading true when session is loading", () => {
      mockUseSession.mockReturnValue({
        data: null,
        status: "loading",
      });

      const { result } = renderHook(() => useSystemAdminGuard());

      expect(result.current.isLoading).toBe(true);
      expect(result.current.isSystemAdmin).toBe(false);
      expect(result.current.user).toBeNull();
    });

    it("does not redirect while loading", () => {
      mockUseSession.mockReturnValue({
        data: null,
        status: "loading",
      });

      renderHook(() => useSystemAdminGuard());

      expect(mockRouterReplace).not.toHaveBeenCalled();
    });
  });

  describe("unauthenticated state", () => {
    it("redirects to login when not authenticated", async () => {
      mockUseSession.mockReturnValue({
        data: null,
        status: "unauthenticated",
      });

      renderHook(() => useSystemAdminGuard());

      await waitFor(() => {
        expect(mockRouterReplace).toHaveBeenCalledWith(
          "/login?callbackUrl=/admin",
        );
      });
    });

    it("returns isSystemAdmin false when not authenticated", () => {
      mockUseSession.mockReturnValue({
        data: null,
        status: "unauthenticated",
      });

      const { result } = renderHook(() => useSystemAdminGuard());

      expect(result.current.isSystemAdmin).toBe(false);
      expect(result.current.user).toBeNull();
    });
  });

  describe("authenticated non-admin user", () => {
    it("redirects to dashboard when user is not system admin", async () => {
      mockUseSession.mockReturnValue({
        data: {
          user: {
            id: "user-1",
            name: "Regular User",
            email: "user@example.com",
            isSystemAdmin: false,
            memberships: [],
          },
        },
        status: "authenticated",
      });

      renderHook(() => useSystemAdminGuard());

      await waitFor(() => {
        expect(mockRouterReplace).toHaveBeenCalledWith("/dashboard");
      });
    });

    it("redirects org admin (OWNER) to dashboard - they are NOT system admins", async () => {
      // This is the critical test: org admins should NOT have system admin access
      mockUseSession.mockReturnValue({
        data: {
          user: {
            id: "user-1",
            name: "Org Admin",
            email: "orgadmin@example.com",
            isSystemAdmin: false, // NOT a system admin
            memberships: [
              {
                orgId: "org-1",
                orgSlug: "acme",
                orgName: "Acme",
                role: "OWNER",
              },
            ],
          },
        },
        status: "authenticated",
      });

      renderHook(() => useSystemAdminGuard());

      await waitFor(() => {
        expect(mockRouterReplace).toHaveBeenCalledWith("/dashboard");
      });
    });

    it("redirects org ADMIN role to dashboard - they are NOT system admins", async () => {
      mockUseSession.mockReturnValue({
        data: {
          user: {
            id: "user-1",
            name: "Org Admin",
            email: "orgadmin@example.com",
            isSystemAdmin: false, // NOT a system admin
            memberships: [
              {
                orgId: "org-1",
                orgSlug: "acme",
                orgName: "Acme",
                role: "ADMIN",
              },
            ],
          },
        },
        status: "authenticated",
      });

      renderHook(() => useSystemAdminGuard());

      await waitFor(() => {
        expect(mockRouterReplace).toHaveBeenCalledWith("/dashboard");
      });
    });
  });

  describe("authenticated system admin", () => {
    it("does not redirect for system admin", async () => {
      mockUseSession.mockReturnValue({
        data: {
          user: {
            id: "admin-1",
            name: "System Admin",
            email: "sysadmin@example.com",
            isSystemAdmin: true,
            memberships: [],
          },
        },
        status: "authenticated",
      });

      renderHook(() => useSystemAdminGuard());

      // Wait a bit to ensure no redirect happens
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(mockRouterReplace).not.toHaveBeenCalled();
    });

    it("returns correct state for system admin", () => {
      mockUseSession.mockReturnValue({
        data: {
          user: {
            id: "admin-1",
            name: "System Admin",
            email: "sysadmin@example.com",
            isSystemAdmin: true,
            memberships: [],
          },
        },
        status: "authenticated",
      });

      const { result } = renderHook(() => useSystemAdminGuard());

      expect(result.current.isLoading).toBe(false);
      expect(result.current.isSystemAdmin).toBe(true);
      expect(result.current.user).toEqual({
        id: "admin-1",
        name: "System Admin",
        email: "sysadmin@example.com",
        isSystemAdmin: true,
      });
    });

    it("system admin who also has org roles still has access", () => {
      // A user can be both a system admin AND have org roles
      mockUseSession.mockReturnValue({
        data: {
          user: {
            id: "admin-1",
            name: "Super User",
            email: "superuser@example.com",
            isSystemAdmin: true,
            memberships: [
              {
                orgId: "org-1",
                orgSlug: "acme",
                orgName: "Acme",
                role: "OWNER",
              },
              {
                orgId: "org-2",
                orgSlug: "beta",
                orgName: "Beta",
                role: "EDITOR",
              },
            ],
          },
        },
        status: "authenticated",
      });

      const { result } = renderHook(() => useSystemAdminGuard());

      expect(result.current.isSystemAdmin).toBe(true);
    });
  });

  describe("edge cases", () => {
    it("handles undefined isSystemAdmin as false", () => {
      mockUseSession.mockReturnValue({
        data: {
          user: {
            id: "user-1",
            name: "User",
            email: "user@example.com",
            // isSystemAdmin is undefined
            memberships: [],
          },
        },
        status: "authenticated",
      });

      const { result } = renderHook(() => useSystemAdminGuard());

      expect(result.current.isSystemAdmin).toBe(false);
    });

    it("handles null user in session", () => {
      mockUseSession.mockReturnValue({
        data: {
          user: null,
        },
        status: "authenticated",
      });

      const { result } = renderHook(() => useSystemAdminGuard());

      expect(result.current.isSystemAdmin).toBe(false);
      expect(result.current.user).toBeNull();
    });
  });
});
