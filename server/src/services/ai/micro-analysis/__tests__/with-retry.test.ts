import { describe, it, expect, vi } from "vitest";
import { withRetry } from "../with-retry.js";

describe("withRetry", () => {
  it("fails twice then succeeds — returns the eventual value", async () => {
    let calls = 0;
    const sleep = vi.fn().mockResolvedValue(undefined);
    const fn = vi.fn().mockImplementation(() => {
      calls++;
      if (calls < 3) return Promise.reject(new Error("ECONNREFUSED"));
      return Promise.resolve("ok");
    });

    const result = await withRetry(fn, { sleep });

    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
    // Linear backoff: baseBackoffMs * attemptNumber
    expect(sleep).toHaveBeenNthCalledWith(1, 5_000);
    expect(sleep).toHaveBeenNthCalledWith(2, 10_000);
  });

  it("exhausts maxAttempts and rethrows the last error", async () => {
    const sleep = vi.fn().mockResolvedValue(undefined);
    const err = new Error("always fails");
    const fn = vi.fn().mockRejectedValue(err);

    await expect(withRetry(fn, { sleep, maxAttempts: 3 })).rejects.toThrow(
      "always fails",
    );
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("does not retry an abort/timeout error", async () => {
    const sleep = vi.fn().mockResolvedValue(undefined);
    const abortErr = new Error("aborted");
    abortErr.name = "AbortError";
    const fn = vi.fn().mockRejectedValue(abortErr);

    await expect(withRetry(fn, { sleep })).rejects.toThrow("aborted");
    expect(fn).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("respects a caller-supplied isRetryable predicate", async () => {
    const sleep = vi.fn().mockResolvedValue(undefined);
    const err = new Error("400 - prompt too large");
    const fn = vi.fn().mockRejectedValue(err);

    await expect(
      withRetry(fn, {
        sleep,
        isRetryable: (e) => !(e instanceof Error && e.message.includes("400")),
      }),
    ).rejects.toThrow("400");
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
