/**
 * Projects API service tests
 *
 * Tests for:
 * - getProjects: builds query string, unwraps paginated response
 * - getProject: fetches by id, unwraps data envelope
 * - createProject / updateProject / deleteProject: correct method + body
 * - inviteProjectMember / updateProjectMemberRole / removeProjectMember
 * - fetchApi error handling: throws on non-ok responses
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject,
  inviteProjectMember,
  updateProjectMemberRole,
  removeProjectMember,
} from "./api";

// ---------------------------------------------------------------------------
// fetch mock helpers
// ---------------------------------------------------------------------------

function mockFetch(body: unknown, ok = true, status = 200) {
  return vi.fn().mockResolvedValue({
    ok,
    status,
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Response);
}

function mockFetchError(body: unknown, status = 400) {
  return mockFetch(body, false, status);
}

const makeProject = (overrides = {}) => ({
  id: "proj-1",
  name: "Test Project",
  status: "ACTIVE",
  organizationId: "org-1",
  ...overrides,
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("getProjects", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it("fetches without filters", async () => {
    const projects = [makeProject()];
    global.fetch = mockFetch({ data: projects, pagination: {} });

    const result = await getProjects();
    expect(result).toEqual(projects);
    expect(fetch).toHaveBeenCalledWith(
      "/api/projects",
      expect.objectContaining({ credentials: "include" }),
    );
  });

  it("builds query string from filters", async () => {
    global.fetch = mockFetch({ data: [], pagination: {} });

    await getProjects({
      search: "auth",
      organizationId: "org-1",
      sortBy: "name",
      sortOrder: "asc",
    });

    const url = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(url).toContain("search=auth");
    expect(url).toContain("organizationId=org-1");
    expect(url).toContain("sortBy=name");
    expect(url).toContain("sortOrder=asc");
  });

  it("throws on non-ok response", async () => {
    global.fetch = mockFetchError({ message: "Unauthorized" }, 401);
    await expect(getProjects()).rejects.toThrow("Unauthorized");
  });
});

describe("getProject", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it("fetches project by id and unwraps data envelope", async () => {
    const project = makeProject();
    global.fetch = mockFetch({ data: project });

    const result = await getProject("proj-1");
    expect(result).toEqual(project);
    expect(fetch).toHaveBeenCalledWith(
      "/api/projects/proj-1",
      expect.anything(),
    );
  });
});

describe("createProject", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it("posts project data and returns created project", async () => {
    const project = makeProject();
    global.fetch = mockFetch({ data: project }, true, 201);

    const result = await createProject({
      name: "Test Project",
      organizationId: "org-1",
    });
    expect(result).toEqual(project);
    expect(fetch).toHaveBeenCalledWith(
      "/api/projects",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ name: "Test Project", organizationId: "org-1" }),
      }),
    );
  });
});

describe("updateProject", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it("patches project and returns updated project", async () => {
    const project = makeProject({ name: "Updated" });
    global.fetch = mockFetch({ data: project });

    const result = await updateProject("proj-1", { name: "Updated" });
    expect(result).toEqual(project);
    expect(fetch).toHaveBeenCalledWith(
      "/api/projects/proj-1",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ name: "Updated" }),
      }),
    );
  });
});

describe("deleteProject", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it("sends DELETE request", async () => {
    global.fetch = mockFetch(null, true, 204);

    await deleteProject("proj-1");
    expect(fetch).toHaveBeenCalledWith(
      "/api/projects/proj-1",
      expect.objectContaining({ method: "DELETE" }),
    );
  });
});

describe("inviteProjectMember", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it("posts invite and returns member", async () => {
    const member = { id: "mem-1", userId: "user-2", role: "VIEWER" };
    global.fetch = mockFetch({ data: member }, true, 201);

    const result = await inviteProjectMember("proj-1", {
      email: "alice@example.com",
      role: "VIEWER",
    });
    expect(result).toEqual(member);
    expect(fetch).toHaveBeenCalledWith(
      "/api/projects/proj-1/members",
      expect.objectContaining({ method: "POST" }),
    );
  });
});

describe("updateProjectMemberRole", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it("patches member role", async () => {
    const member = { id: "mem-1", role: "ADMIN" };
    global.fetch = mockFetch({ data: member });

    const result = await updateProjectMemberRole("proj-1", "mem-1", "ADMIN");
    expect(result).toEqual(member);
    expect(fetch).toHaveBeenCalledWith(
      "/api/projects/proj-1/members/mem-1",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ role: "ADMIN" }),
      }),
    );
  });
});

describe("removeProjectMember", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it("sends DELETE to member endpoint", async () => {
    global.fetch = mockFetch(null, true, 204);

    await removeProjectMember("proj-1", "mem-1");
    expect(fetch).toHaveBeenCalledWith(
      "/api/projects/proj-1/members/mem-1",
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("throws on server error with message", async () => {
    global.fetch = mockFetchError({ message: "Member not found" }, 404);
    await expect(removeProjectMember("proj-1", "bad-id")).rejects.toThrow(
      "Member not found",
    );
  });
});
