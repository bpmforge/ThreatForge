/**
 * Threat model write service tests
 *
 * - moveThreatModelToProject: PATCH (the server registers no PUT route)
 * - moveThreatModelToProject: surfaces the server error message
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { moveThreatModelToProject } from "./threat-model-writes";

function mockFetch(body: unknown, ok = true, status = 200) {
  return vi.fn().mockResolvedValue({
    ok,
    status,
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Response);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("moveThreatModelToProject", () => {
  it("sends PATCH /api/threat-models/:id with the projectId", async () => {
    const fetchMock = mockFetch({
      data: {
        id: "tm-1",
        name: "Model",
        version: 3,
        updatedAt: "2026-01-01T00:00:00Z",
        projectId: "proj-2",
        threats: [],
      },
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await moveThreatModelToProject("tm-1", "proj-2");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/api\/threat-models\/tm-1$/);
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body as string)).toEqual({ projectId: "proj-2" });
    expect(result.id).toBe("tm-1");
  });

  it("throws the server error message on failure", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch({ error: "Access denied to target project" }, false, 403),
    );

    await expect(moveThreatModelToProject("tm-1", "proj-2")).rejects.toThrow(
      "Access denied to target project",
    );
  });
});
