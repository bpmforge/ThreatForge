/**
 * The reset page must read the backend's { data: { valid } } envelope;
 * reading `valid` at the top level rejected every valid link.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useResetPassword } from "./useResetPassword";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams("token=abc"),
}));

function mockVerifyResponse(status: number, body: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn(() =>
      Promise.resolve({
        ok: status < 400,
        status,
        json: () => Promise.resolve(body),
      }),
    ),
  );
}

describe("useResetPassword token check", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("accepts a valid token from the wrapped success reply", async () => {
    mockVerifyResponse(200, {
      data: { valid: true, email: "fs***@example.com" },
    });
    const { result } = renderHook(() => useResetPassword());
    await waitFor(() => expect(result.current.validating).toBe(false));
    expect(result.current.tokenValid).toBe(true);
    expect(result.current.maskedEmail).toBe("fs***@example.com");
  });

  it("shows the backend error for a rejected token", async () => {
    mockVerifyResponse(400, {
      error: "Invalid or expired reset token",
      code: "BAD_REQUEST",
    });
    const { result } = renderHook(() => useResetPassword());
    await waitFor(() => expect(result.current.validating).toBe(false));
    expect(result.current.tokenValid).toBe(false);
    expect(result.current.error).toBe("Invalid or expired reset token");
  });
});

describe("useResetPassword submit errors", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("shows the backend's explanation, not just its error code text", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ data: { valid: true } }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: () =>
          Promise.resolve({
            error: "Password unchanged",
            code: "BAD_REQUEST",
            details: {
              message:
                "New password must be different from your current password.",
            },
          }),
      });
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useResetPassword());
    await waitFor(() => expect(result.current.tokenValid).toBe(true));
    act(() => {
      result.current.setPassword("Str0ng!Passw0rd");
      result.current.setConfirmPassword("Str0ng!Passw0rd");
    });
    await act(async () => {
      await result.current.handleSubmit({
        preventDefault() {},
      } as React.FormEvent);
    });
    expect(result.current.error).toBe(
      "New password must be different from your current password.",
    );
  });
});
