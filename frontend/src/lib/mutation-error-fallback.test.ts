import { describe, it, expect, vi } from "vitest";
import {
  reportUnhandledMutationError,
  mutationErrorMessage,
} from "./mutation-error-fallback";
import { ApiError } from "./api-client";

function deps(initialToasts = 0) {
  let count = initialToasts;
  const tasks: Array<() => void> = [];
  return {
    d: {
      toastCount: () => count,
      showError: vi.fn(),
      schedule: (fn: () => void) => tasks.push(fn),
    },
    addToast: () => count++,
    flush: () => tasks.forEach((t) => t()),
  };
}

const plain = { options: {} };

describe("reportUnhandledMutationError", () => {
  it("shows an error when nothing else reported the failure", () => {
    const { d, flush } = deps();
    reportUnhandledMutationError(new Error("Name is taken"), plain, d);
    flush();
    expect(d.showError).toHaveBeenCalledWith("Name is taken");
  });

  it("stays quiet when a call-site handler showed its own toast", () => {
    const { d, flush, addToast } = deps();
    reportUnhandledMutationError(new Error("x"), plain, d);
    addToast();
    flush();
    expect(d.showError).not.toHaveBeenCalled();
  });

  it("stays quiet when the mutation has its own onError or opts out", () => {
    const { d, flush } = deps();
    reportUnhandledMutationError(
      new Error("x"),
      { options: { onError: () => {} } },
      d,
    );
    reportUnhandledMutationError(
      new Error("x"),
      { options: { meta: { silentError: true } } },
      d,
    );
    flush();
    expect(d.showError).not.toHaveBeenCalled();
  });

  it("leaves 401 (sign-out) and read-only errors to their own handling", () => {
    const { d, flush } = deps();
    reportUnhandledMutationError(new ApiError("unauth", 401), plain, d);
    reportUnhandledMutationError(
      new ApiError("ro", 403, undefined, "READ_ONLY_ACCOUNT"),
      plain,
      d,
    );
    flush();
    expect(d.showError).not.toHaveBeenCalled();
  });
});

describe("mutationErrorMessage", () => {
  it("uses the server's short message, else a generic one", () => {
    expect(mutationErrorMessage(new Error("Project not found"))).toBe(
      "Project not found",
    );
    expect(mutationErrorMessage("boom")).toMatch(/not saved/);
    expect(mutationErrorMessage(new Error("x".repeat(500)))).toMatch(
      /not saved/,
    );
  });
});
