import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { requirementsApi } from "./requirements-api";

function mockFetch(body: unknown, ok = true, status = 200) {
  return vi.spyOn(globalThis, "fetch").mockResolvedValue({
    ok,
    status,
    json: async () => body,
  } as Response);
}

/** Extract the URL + init of the most recent fetch call. */
function lastCall(spy: ReturnType<typeof vi.spyOn>) {
  const [url, init] = spy.mock.calls.at(-1) as [string, RequestInit];
  return { url, init };
}

afterEach(() => vi.restoreAllMocks());

describe("requirementsApi.list", () => {
  beforeEach(() => mockFetch({ data: [] }));

  it("hits the model's requirements path with no query when no filters", async () => {
    const spy = mockFetch({ data: [{ id: "r1" }] });
    const out = await requirementsApi.list("m1");
    expect(lastCall(spy).url).toBe("/api/threat-models/m1/requirements");
    expect(out).toEqual([{ id: "r1" }]); // unwrapped from { data }
  });

  it("encodes category + source filters into the query string", async () => {
    const spy = mockFetch({ data: [] });
    await requirementsApi.list("m1", { category: "IAM", source: "SRS" });
    expect(lastCall(spy).url).toBe(
      "/api/threat-models/m1/requirements?category=IAM&source=SRS",
    );
  });
});

describe("requirementsApi mutations", () => {
  it("create POSTs the input to the base path", async () => {
    const spy = mockFetch({ data: { id: "r1" } });
    await requirementsApi.create("m1", { reqId: "R-1", text: "x" } as never);
    const { url, init } = lastCall(spy);
    expect(url).toBe("/api/threat-models/m1/requirements");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({
      reqId: "R-1",
      text: "x",
    });
  });

  it("update PATCHes the specific requirement id", async () => {
    const spy = mockFetch({ data: { id: "r9" } });
    await requirementsApi.update("m1", "r9", { text: "y" } as never);
    const { url, init } = lastCall(spy);
    expect(url).toBe("/api/threat-models/m1/requirements/r9");
    expect(init.method).toBe("PATCH");
  });

  it("delete issues a DELETE and tolerates 204", async () => {
    const spy = mockFetch({}, true, 204);
    await expect(requirementsApi.delete("m1", "r9")).resolves.toBeUndefined();
    expect(lastCall(spy).init.method).toBe("DELETE");
  });

  it("importCsv sends the CSV text as the request body", async () => {
    const spy = mockFetch({ data: { imported: 2 } });
    await requirementsApi.importCsv("m1", "id,text\n1,a");
    const { url, init } = lastCall(spy);
    expect(url).toBe("/api/threat-models/m1/requirements/import/csv");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toBe("id,text\n1,a");
  });
});

describe("requirementsApi error handling", () => {
  it("throws the server-provided error message on non-ok", async () => {
    mockFetch({ error: "Validation failed" }, false, 400);
    await expect(requirementsApi.list("m1")).rejects.toThrow(
      "Validation failed",
    );
  });

  it("falls back to a status message when no error body", async () => {
    mockFetch({}, false, 500);
    await expect(requirementsApi.list("m1")).rejects.toThrow("status 500");
  });

  it("delete throws on a non-204 failure status", async () => {
    mockFetch({}, false, 403);
    await expect(requirementsApi.delete("m1", "r1")).rejects.toThrow(
      "status 403",
    );
  });
});
