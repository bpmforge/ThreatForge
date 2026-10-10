/**
 * useProjects Hook Tests
 *
 * Tests for:
 * - useProjects (list query — fetches projects, passes filters)
 * - useProject (single query — enabled guard, fetches by id)
 * - useCreateProject (mutation — API call, cache invalidation)
 * - useUpdateProject (mutation — optimistic cache set + list invalidation)
 * - useDeleteProject (mutation — cache invalidation on success)
 * - useInviteProjectMember (mutation — invalidates project cache)
 * - useUpdateProjectMemberRole (mutation — invalidates project cache)
 * - useRemoveProjectMember (mutation — invalidates project cache)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import {
  useProjects,
  useProject,
  useCreateProject,
  useUpdateProject,
  useDeleteProject,
  useInviteProjectMember,
  useUpdateProjectMemberRole,
  useRemoveProjectMember,
} from "./useProjects";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("../services/api", () => ({
  getProjects: vi.fn(),
  getProject: vi.fn(),
  createProject: vi.fn(),
  updateProject: vi.fn(),
  deleteProject: vi.fn(),
  inviteProjectMember: vi.fn(),
  updateProjectMemberRole: vi.fn(),
  removeProjectMember: vi.fn(),
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

const makeProject = (overrides = {}) => ({
  id: "proj-1",
  name: "Test Project",
  description: "A test project",
  status: "ACTIVE" as const,
  organizationId: "org-1",
  createdById: "user-1",
  threatModelCount: 0,
  projectMembers: [] as [],
  threatModels: [] as [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

const makeProjectSummary = (overrides = {}) => ({
  id: "proj-1",
  name: "Test Project",
  status: "ACTIVE" as const,
  organizationId: "org-1",
  createdById: "user-1",
  threatModelCount: 0,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useProjects", () => {
  let client: QueryClient;

  beforeEach(() => {
    client = makeClient();
    vi.clearAllMocks();
  });

  it("fetches projects successfully", async () => {
    const projects = [makeProjectSummary()];
    vi.mocked(api.getProjects).mockResolvedValue(projects);

    const { result } = renderHook(() => useProjects(), {
      wrapper: wrapper(client),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(projects);
    expect(api.getProjects).toHaveBeenCalledWith(undefined);
  });

  it("passes filters to API", async () => {
    vi.mocked(api.getProjects).mockResolvedValue([]);
    const filters = { organizationId: "org-1", search: "auth" };

    renderHook(() => useProjects(filters), { wrapper: wrapper(client) });

    await waitFor(() => expect(api.getProjects).toHaveBeenCalledWith(filters));
  });

  it("exposes error state when fetch fails", async () => {
    vi.mocked(api.getProjects).mockRejectedValue(new Error("Network error"));

    const { result } = renderHook(() => useProjects(), {
      wrapper: wrapper(client),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe("useProject", () => {
  let client: QueryClient;

  beforeEach(() => {
    client = makeClient();
    vi.clearAllMocks();
  });

  it("fetches a single project by id", async () => {
    const project = makeProject();
    vi.mocked(api.getProject).mockResolvedValue(project);

    const { result } = renderHook(() => useProject("proj-1"), {
      wrapper: wrapper(client),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(project);
    expect(api.getProject).toHaveBeenCalledWith("proj-1");
  });

  it("does not fetch when id is undefined", () => {
    renderHook(() => useProject(undefined), { wrapper: wrapper(client) });
    expect(api.getProject).not.toHaveBeenCalled();
  });
});

describe("useCreateProject", () => {
  let client: QueryClient;

  beforeEach(() => {
    client = makeClient();
    vi.clearAllMocks();
  });

  it("calls createProject and invalidates list cache", async () => {
    const project = makeProject();
    vi.mocked(api.createProject).mockResolvedValue(project);
    const invalidate = vi.spyOn(client, "invalidateQueries");

    const { result } = renderHook(() => useCreateProject(), {
      wrapper: wrapper(client),
    });

    result.current.mutate({ name: "New Project", organizationId: "org-1" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.createProject).toHaveBeenCalledWith({
      name: "New Project",
      organizationId: "org-1",
    });
    expect(invalidate).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ["projects"] }),
    );
  });

  it("exposes error state when creation fails", async () => {
    vi.mocked(api.createProject).mockRejectedValue(new Error("Server error"));

    const { result } = renderHook(() => useCreateProject(), {
      wrapper: wrapper(client),
    });

    result.current.mutate({ name: "Bad", organizationId: "org-1" });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe("useUpdateProject", () => {
  let client: QueryClient;

  beforeEach(() => {
    client = makeClient();
    vi.clearAllMocks();
  });

  it("calls updateProject and sets cache for the project", async () => {
    const updated = makeProject({ name: "Updated" });
    vi.mocked(api.updateProject).mockResolvedValue(updated);
    const setData = vi.spyOn(client, "setQueryData");

    const { result } = renderHook(() => useUpdateProject("proj-1"), {
      wrapper: wrapper(client),
    });

    result.current.mutate({ name: "Updated" });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.updateProject).toHaveBeenCalledWith("proj-1", {
      name: "Updated",
    });
    expect(setData).toHaveBeenCalledWith(["project", "proj-1"], updated);
  });
});

describe("useDeleteProject", () => {
  let client: QueryClient;

  beforeEach(() => {
    client = makeClient();
    vi.clearAllMocks();
  });

  it("calls deleteProject and invalidates list", async () => {
    vi.mocked(api.deleteProject).mockResolvedValue(undefined);
    const invalidate = vi.spyOn(client, "invalidateQueries");

    const { result } = renderHook(() => useDeleteProject(), {
      wrapper: wrapper(client),
    });

    result.current.mutate("proj-1");
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.deleteProject).toHaveBeenCalledWith("proj-1");
    expect(invalidate).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ["projects"] }),
    );
  });
});

describe("useInviteProjectMember", () => {
  let client: QueryClient;

  beforeEach(() => {
    client = makeClient();
    vi.clearAllMocks();
  });

  it("calls inviteProjectMember and invalidates project cache", async () => {
    const member = { id: "member-1", userId: "user-2", role: "VIEWER" };
    vi.mocked(api.inviteProjectMember).mockResolvedValue(member as never);
    const invalidate = vi.spyOn(client, "invalidateQueries");

    const { result } = renderHook(() => useInviteProjectMember("proj-1"), {
      wrapper: wrapper(client),
    });

    result.current.mutate({ email: "alice@example.com", role: "VIEWER" });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidate).toHaveBeenCalled();
  });

  it("exposes error state when invitation fails", async () => {
    vi.mocked(api.inviteProjectMember).mockRejectedValue(
      new Error("Not found"),
    );

    const { result } = renderHook(() => useInviteProjectMember("proj-1"), {
      wrapper: wrapper(client),
    });

    result.current.mutate({ email: "x@x.com", role: "VIEWER" });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe("useUpdateProjectMemberRole", () => {
  let client: QueryClient;

  beforeEach(() => {
    client = makeClient();
    vi.clearAllMocks();
  });

  it("calls updateProjectMemberRole with correct args", async () => {
    const member = { id: "member-1", role: "ADMIN" };
    vi.mocked(api.updateProjectMemberRole).mockResolvedValue(member as never);

    const { result } = renderHook(() => useUpdateProjectMemberRole("proj-1"), {
      wrapper: wrapper(client),
    });

    result.current.mutate({ memberId: "member-1", role: "ADMIN" });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.updateProjectMemberRole).toHaveBeenCalledWith(
      "proj-1",
      "member-1",
      "ADMIN",
    );
  });
});

describe("useRemoveProjectMember", () => {
  let client: QueryClient;

  beforeEach(() => {
    client = makeClient();
    vi.clearAllMocks();
  });

  it("calls removeProjectMember and invalidates project cache", async () => {
    vi.mocked(api.removeProjectMember).mockResolvedValue(undefined);
    const invalidate = vi.spyOn(client, "invalidateQueries");

    const { result } = renderHook(() => useRemoveProjectMember("proj-1"), {
      wrapper: wrapper(client),
    });

    result.current.mutate("member-1");
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.removeProjectMember).toHaveBeenCalledWith("proj-1", "member-1");
    expect(invalidate).toHaveBeenCalled();
  });
});
