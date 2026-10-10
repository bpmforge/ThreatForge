import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("@/lib/backend-url", () => ({
  internalBackendUrl: () => "http://backend",
}));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ cookie: "s=1" }),
}));

const { POST } = await import("./route");

describe("catch-all proxy", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("forwards X-Setup-Token and the client address", async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        new Response("{}", { headers: { "content-type": "application/json" } }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const req = new Request("http://app/api/setup/initialize", {
      method: "POST",
      body: "{}",
      headers: {
        "x-setup-token": "tok",
        "x-forwarded-for": "1.1.1.1, 203.0.113.7",
      },
    });
    await POST(req as never);
    const init = (fetchMock.mock.calls[0] as unknown[])[1] as {
      headers: Record<string, string>;
    };
    expect(init.headers["x-setup-token"]).toBe("tok");
    expect(init.headers["x-forwarded-for"]).toBe("203.0.113.7");
    expect(init.headers.cookie).toBe("s=1");
  });
});
