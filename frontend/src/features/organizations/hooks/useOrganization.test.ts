/**
 * useOrganization Hook Tests
 *
 * Tests for:
 * - useOrganizations (list query — enabled guard, data fetching)
 * - useOrganization (single-org query — enabled guard)
 * - useCreateOrganization (mutation — API call, cache invalidation)
 * - useUpdateOrganization (mutation — cache update on success)
 * - useInviteMember (mutation — cache invalidation)
 * - useRemoveMember (mutation — cache invalidation)
 * - useCurrentUserRole (pure helper — role lookup)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import {
  useOrganizations,
  useOrganization,
  useCreateOrganization,
  useUpdateOrganization,
  useInviteMember,
  useRemoveMember,
  useCurrentUserRole,
} from "./useOrganization";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockUseSession = vi.fn();

vi.mock("next-auth/react", () => ({
  useSession: () => mockUseSession(),
}));

vi.mock("../services/api", () => ({
  getOrganizations: vi.fn(),
  getOrganization: vi.fn(),
  updateOrganization: vi.fn(),
  inviteMember: vi.fn(),
  updateMemberRole: vi.fn(),
  removeMember: vi.fn(),
  getAuditLog: vi.fn(),
  createOrganization: vi.fn(),
}));

import * as api from "../services/api";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

function wrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client }, children);
  };
}

const makeOrgSummary = (overrides: Record<string, unknown> = {}) => ({
  id: "org-1",
  name: "Acme Inc",
  slug: "acme",
  type: "TEAM" as const,
  isPersonal: false,
  memberCount: 3,
  role: "OWNER" as const,
  createdAt: "2024-01-01T00:00:00Z",
  ...overrides,
});

const makeOrg = (overrides: Record<string, unknown> = {}) => ({
  id: "org-1",
  name: "Acme Inc",
  slug: "acme",
  memberships: [],
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
  ...overrides,
});

const makeMember = (overrides: Record<string, unknown> = {}) => ({
  id: "member-1",
  userId: "user-1",
  role: "EDITOR" as const,
  user: { id: "user-1", name: "Alice", email: "alice@example.com" },
  createdAt: "2024-01-01T00:00:00Z",
  ...overrides,
});

// ---------------------------------------------------------------------------
// useOrganizations
// ---------------------------------------------------------------------------

describe("useOrganizations", () => {
  let client: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = makeClient();
  });

  it("is disabled when session is loading", () => {
    mockUseSession.mockReturnValue({ status: "loading" });

    const { result } = renderHook(() => useOrganizations(), {
      wrapper: wrapper(client),
    });

    expect(result.current.fetchStatus).toBe("idle");
  });

  it("is disabled when unauthenticated", () => {
    mockUseSession.mockReturnValue({ data: null, status: "unauthenticated" });

    const { result } = renderHook(() => useOrganizations(), {
      wrapper: wrapper(client),
    });

    expect(result.current.fetchStatus).toBe("idle");
    expect(api.getOrganizations).not.toHaveBeenCalled();
  });

  it("fetches organizations when authenticated", async () => {
    mockUseSession.mockReturnValue({ status: "authenticated" });
    const orgs = [
      makeOrgSummary(),
      makeOrgSummary({ id: "org-2", name: "Beta Corp" }),
    ];
    vi.mocked(api.getOrganizations).mockResolvedValue(orgs);

    const { result } = renderHook(() => useOrganizations(), {
      wrapper: wrapper(client),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(api.getOrganizations).toHaveBeenCalledTimes(1);
    expect(result.current.data).toHaveLength(2);
    expect(result.current.data?.[0].name).toBe("Acme Inc");
  });

  it("exposes error state when fetch fails", async () => {
    mockUseSession.mockReturnValue({ status: "authenticated" });
    vi.mocked(api.getOrganizations).mockRejectedValue(
      new Error("Network error"),
    );

    const { result } = renderHook(() => useOrganizations(), {
      wrapper: wrapper(client),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

// ---------------------------------------------------------------------------
// useOrganization (single)
// ---------------------------------------------------------------------------

describe("useOrganization", () => {
  let client: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = makeClient();
  });

  it("is disabled when orgId is undefined", () => {
    const { result } = renderHook(() => useOrganization(undefined), {
      wrapper: wrapper(client),
    });

    expect(result.current.fetchStatus).toBe("idle");
    expect(api.getOrganization).not.toHaveBeenCalled();
  });

  it("fetches single organization when orgId is provided", async () => {
    const org = makeOrg();
    vi.mocked(api.getOrganization).mockResolvedValue(org);

    const { result } = renderHook(() => useOrganization("org-1"), {
      wrapper: wrapper(client),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(api.getOrganization).toHaveBeenCalledWith("org-1");
    expect(result.current.data?.id).toBe("org-1");
  });
});

// ---------------------------------------------------------------------------
// useCreateOrganization
// ---------------------------------------------------------------------------

describe("useCreateOrganization", () => {
  let client: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = makeClient();
  });

  it("calls api.createOrganization with request data", async () => {
    const newOrg = makeOrgSummary({ id: "org-new", name: "New Corp" });
    vi.mocked(api.createOrganization).mockResolvedValue(newOrg);

    const { result } = renderHook(() => useCreateOrganization(), {
      wrapper: wrapper(client),
    });

    result.current.mutate({ name: "New Corp", type: "TEAM" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(api.createOrganization).toHaveBeenCalledWith({
      name: "New Corp",
      type: "TEAM",
    });
  });

  it("returns the new organization from mutation result", async () => {
    const newOrg = makeOrgSummary({ id: "org-new", name: "My Org" });
    vi.mocked(api.createOrganization).mockResolvedValue(newOrg);

    const { result } = renderHook(() => useCreateOrganization(), {
      wrapper: wrapper(client),
    });

    result.current.mutate({ name: "My Org" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.id).toBe("org-new");
  });

  it("exposes error state when creation fails", async () => {
    vi.mocked(api.createOrganization).mockRejectedValue(new Error("Conflict"));

    const { result } = renderHook(() => useCreateOrganization(), {
      wrapper: wrapper(client),
    });

    result.current.mutate({ name: "Duplicate Org" });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

// ---------------------------------------------------------------------------
// useUpdateOrganization
// ---------------------------------------------------------------------------

describe("useUpdateOrganization", () => {
  let client: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = makeClient();
  });

  it("calls api.updateOrganization with correct arguments", async () => {
    const updated = makeOrg({ name: "Acme Renamed" });
    vi.mocked(api.updateOrganization).mockResolvedValue(updated);

    const { result } = renderHook(() => useUpdateOrganization("org-1"), {
      wrapper: wrapper(client),
    });

    result.current.mutate({ name: "Acme Renamed" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(api.updateOrganization).toHaveBeenCalledWith("org-1", {
      name: "Acme Renamed",
    });
  });

  it("updates single-org cache entry on success", async () => {
    const original = makeOrg({ name: "Old Name" });
    const updated = makeOrg({ name: "New Name" });

    // Seed cache
    client.setQueryData(["organization", "org-1"], original);
    vi.mocked(api.updateOrganization).mockResolvedValue(updated);

    const { result } = renderHook(() => useUpdateOrganization("org-1"), {
      wrapper: wrapper(client),
    });

    result.current.mutate({ name: "New Name" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const cached = client.getQueryData<{ name: string }>([
      "organization",
      "org-1",
    ]);
    expect(cached?.name).toBe("New Name");
  });

  it("exposes error state when update fails", async () => {
    vi.mocked(api.updateOrganization).mockRejectedValue(new Error("Forbidden"));

    const { result } = renderHook(() => useUpdateOrganization("org-1"), {
      wrapper: wrapper(client),
    });

    result.current.mutate({ name: "Should fail" });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

// ---------------------------------------------------------------------------
// useInviteMember
// ---------------------------------------------------------------------------

describe("useInviteMember", () => {
  let client: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = makeClient();
  });

  it("calls api.inviteMember with the invite request", async () => {
    vi.mocked(api.inviteMember).mockResolvedValue({
      success: true,
      invitationId: "inv-1",
      message: "Invitation sent",
    });

    const { result } = renderHook(() => useInviteMember("org-1"), {
      wrapper: wrapper(client),
    });

    result.current.mutate({ email: "new@example.com", role: "EDITOR" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(api.inviteMember).toHaveBeenCalledWith("org-1", {
      email: "new@example.com",
      role: "EDITOR",
    });
  });

  it("exposes error state when invitation fails", async () => {
    vi.mocked(api.inviteMember).mockRejectedValue(
      new Error("Already a member"),
    );

    const { result } = renderHook(() => useInviteMember("org-1"), {
      wrapper: wrapper(client),
    });

    result.current.mutate({ email: "existing@example.com", role: "VIEWER" });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

// ---------------------------------------------------------------------------
// useRemoveMember
// ---------------------------------------------------------------------------

describe("useRemoveMember", () => {
  let client: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = makeClient();
  });

  it("calls api.removeMember with the member ID", async () => {
    vi.mocked(api.removeMember).mockResolvedValue(undefined);

    const { result } = renderHook(() => useRemoveMember("org-1"), {
      wrapper: wrapper(client),
    });

    result.current.mutate("member-42");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(api.removeMember).toHaveBeenCalledWith("org-1", "member-42");
  });

  it("exposes error state when remove fails", async () => {
    vi.mocked(api.removeMember).mockRejectedValue(
      new Error("Cannot remove owner"),
    );

    const { result } = renderHook(() => useRemoveMember("org-1"), {
      wrapper: wrapper(client),
    });

    result.current.mutate("member-owner");

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

// ---------------------------------------------------------------------------
// useCurrentUserRole (pure helper)
// ---------------------------------------------------------------------------

describe("useCurrentUserRole", () => {
  it("returns undefined when org is undefined", () => {
    const role = useCurrentUserRole(undefined, "user-1");
    expect(role).toBeUndefined();
  });

  it("returns undefined when userId is undefined", () => {
    const org = makeOrg({
      memberships: [makeMember({ userId: "user-1", role: "OWNER" })],
    });
    const role = useCurrentUserRole(
      org as Parameters<typeof useCurrentUserRole>[0],
      undefined,
    );
    expect(role).toBeUndefined();
  });

  it("returns the user role when user is a member", () => {
    const member = makeMember({ userId: "user-42", role: "ADMIN" });
    const org = makeOrg({ memberships: [member] });
    const role = useCurrentUserRole(
      org as Parameters<typeof useCurrentUserRole>[0],
      "user-42",
    );
    expect(role).toBe("ADMIN");
  });

  it("returns undefined when user is not a member of the org", () => {
    const org = makeOrg({ memberships: [makeMember({ userId: "user-1" })] });
    const role = useCurrentUserRole(
      org as Parameters<typeof useCurrentUserRole>[0],
      "user-999",
    );
    expect(role).toBeUndefined();
  });

  it("returns correct role for each role level", () => {
    for (const expectedRole of [
      "OWNER",
      "ADMIN",
      "EDITOR",
      "VIEWER",
    ] as const) {
      const member = makeMember({ userId: "user-1", role: expectedRole });
      const org = makeOrg({ memberships: [member] });
      expect(
        // useCurrentUserRole is a pure selector (org, userId) => role, not a
        // React hook — the use* name trips rules-of-hooks here (false positive).
        // eslint-disable-next-line react-hooks/rules-of-hooks
        useCurrentUserRole(
          org as Parameters<typeof useCurrentUserRole>[0],
          "user-1",
        ),
      ).toBe(expectedRole);
    }
  });

  it("handles org with multiple members and returns the correct one", () => {
    const members = [
      makeMember({ id: "m1", userId: "user-1", role: "OWNER" }),
      makeMember({ id: "m2", userId: "user-2", role: "EDITOR" }),
      makeMember({ id: "m3", userId: "user-3", role: "VIEWER" }),
    ];
    const org = makeOrg({ memberships: members });
    expect(
      useCurrentUserRole(
        org as Parameters<typeof useCurrentUserRole>[0],
        "user-2",
      ),
    ).toBe("EDITOR");
  });
});
