import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReadOnlyBanner } from "./ReadOnlyBanner";
import { isReadOnlyError } from "@/lib/read-only";
import { ApiError, apiPost } from "@/lib/api-client";

const session = vi.hoisted(() => ({ status: "authenticated" }));
vi.mock("next-auth/react", () => ({
  useSession: () => ({ status: session.status }),
}));

function renderBanner() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <ReadOnlyBanner />
    </QueryClientProvider>,
  );
}

function mockMe(readOnly: boolean) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      Response.json({ data: { id: "u1", email: "x@y.z", readOnly } }),
    ),
  );
}

describe("ReadOnlyBanner", () => {
  beforeEach(() => {
    session.status = "authenticated";
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows a demo banner for a read-only account", async () => {
    mockMe(true);
    renderBanner();
    expect(await screen.findByText(/Demo — read-only/)).toBeTruthy();
  });

  it("shows nothing for a normal account", async () => {
    mockMe(false);
    const { container } = renderBanner();
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(container.textContent).toBe("");
  });

  it("does not ask the server before sign-in", () => {
    session.status = "unauthenticated";
    mockMe(true);
    renderBanner();
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("isReadOnlyError", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("recognises the server's read-only rejection through apiClient", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json(
          {
            error: "Forbidden",
            code: "READ_ONLY_ACCOUNT",
            message: "This is a read-only demo account.",
          },
          { status: 403 },
        ),
      ),
    );
    const err = await apiPost("/api/organizations", {}).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(isReadOnlyError(err)).toBe(true);
  });

  it("recognises it from hand-rolled fetch helpers that keep only the message", () => {
    expect(
      isReadOnlyError(new Error("This is a read-only demo account. Sign up…")),
    ).toBe(true);
  });

  it("ignores other 403s and errors", () => {
    expect(isReadOnlyError(new ApiError("Forbidden", 403))).toBe(false);
    expect(isReadOnlyError(new Error("boom"))).toBe(false);
    expect(isReadOnlyError(undefined)).toBe(false);
  });
});
