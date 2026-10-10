import { describe, it, expect, vi, afterEach } from "vitest";

// next-auth's entry imports next/server, which vitest cannot resolve here.
vi.mock("next-auth", () => ({
  CredentialsSignin: class CredentialsSignin extends Error {
    code = "credentials";
  },
}));
vi.mock("./backend-url", () => ({
  internalBackendUrl: () => "http://backend",
}));

const { CredentialsSignin } = await import("next-auth");
const { authorizeCredentials } = await import("./credentials-authorize");

function backendReplies(status: number, body: unknown) {
  const fetchMock = vi.fn(() =>
    Promise.resolve(new Response(JSON.stringify(body), { status })),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const form = { email: "user@example.com", password: "pw" };

describe("authorizeCredentials", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("returns the user the backend accepted", async () => {
    const fetchMock = backendReplies(200, {
      data: { id: "u1", email: "user@example.com", name: "U", image: null },
    });
    await expect(
      authorizeCredentials({ ...form, code: "123456" }),
    ).resolves.toEqual({
      id: "u1",
      email: "user@example.com",
      name: "U",
      image: null,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "http://backend/api/auth/credentials",
      expect.objectContaining({
        body: JSON.stringify({ ...form, code: "123456" }),
      }),
    );
  });

  it("passes form-specific codes through to the login page", async () => {
    backendReplies(401, { code: "two_factor_required" });
    const err = await authorizeCredentials(form).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(CredentialsSignin);
    expect(err).toMatchObject({ code: "two_factor_required" });
  });

  it("returns null for a plain wrong password or an unreachable backend", async () => {
    backendReplies(401, { code: "invalid_credentials" });
    await expect(authorizeCredentials(form)).resolves.toBeNull();

    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new Error("down"))),
    );
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(authorizeCredentials(form)).resolves.toBeNull();
  });
});

describe("authorizeCredentials client IP", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("forwards the browser address to the backend", async () => {
    const fetchMock = backendReplies(401, {});
    const request = new Request("http://app/api/auth/callback/credentials", {
      headers: { "x-forwarded-for": "6.6.6.6, 203.0.113.7" },
    });
    await authorizeCredentials(form, request);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://backend/api/auth/credentials",
      expect.objectContaining({
        headers: expect.objectContaining({
          "x-forwarded-for": "203.0.113.7",
        }),
      }),
    );
  });
});
