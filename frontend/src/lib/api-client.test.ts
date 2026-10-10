import { describe, it, expect, vi, afterEach } from "vitest";
import { ApiError, apiGet, apiGetBlob, apiPost } from "./api-client";

function respond(status: number, body: unknown, blob?: Blob) {
  const fetchMock = vi.fn((_url: string, _init?: RequestInit) =>
    Promise.resolve({
      ok: status < 400,
      status,
      json: () => Promise.resolve(body),
      blob: () => Promise.resolve(blob),
    }),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("api-client", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("unwraps { data } and sends cookies", async () => {
    const fetchMock = respond(200, { data: { id: "m1" } });
    await expect(apiGet("/api/threat-models/m1")).resolves.toEqual({
      id: "m1",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/threat-models/m1",
      expect.objectContaining({ credentials: "include", method: "GET" }),
    );
  });

  it("keeps paginated responses whole", async () => {
    respond(200, { data: [1], pagination: { page: 1 } });
    await expect(apiGet("/api/items")).resolves.toEqual({
      data: [1],
      pagination: { page: 1 },
    });
  });

  it("throws ApiError with the server's message and code", async () => {
    respond(403, { error: "Read-only account", code: "READ_ONLY_ACCOUNT" });
    const err = await apiPost("/api/x", { a: 1 }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({
      statusCode: 403,
      code: "READ_ONLY_ACCOUNT",
    });
  });

  it("sends JSON bodies as JSON and FormData as multipart", async () => {
    const fetchMock = respond(200, { data: {} });
    await apiPost("/api/json", { name: "x" });
    const jsonInit = fetchMock.mock.calls[0][1] as RequestInit;
    expect(jsonInit.body).toBe('{"name":"x"}');
    expect(jsonInit.headers).toMatchObject({
      "Content-Type": "application/json",
    });

    const form = new FormData();
    form.append("file", "content");
    await apiPost("/api/upload", form);
    const formInit = fetchMock.mock.calls[1][1] as RequestInit;
    expect(formInit.body).toBe(form);
    expect(formInit.headers).not.toHaveProperty("Content-Type");
  });

  it("apiGetBlob returns the file and throws ApiError on failure", async () => {
    const file = new Blob(["a,b"]);
    respond(200, null, file);
    await expect(apiGetBlob("/api/export")).resolves.toBe(file);

    respond(404, { error: "Report not found" });
    await expect(apiGetBlob("/api/export")).rejects.toBeInstanceOf(ApiError);
  });
});
