import { describe, it, expect, vi, afterEach } from "vitest";
import { jobStatusRefetchInterval, fetchJobStatus } from "./useJobStatus";

describe("jobStatusRefetchInterval", () => {
  it.each(["COMPLETED", "FAILED", "CANCELLED", "PAUSED"])(
    "stops polling on %s",
    (status) => {
      expect(jobStatusRefetchInterval(status)).toBe(false);
    },
  );

  it.each([undefined, "PENDING", "PROCESSING"])(
    "keeps polling on %s",
    (status) => {
      expect(jobStatusRefetchInterval(status)).toBe(3000);
    },
  );

  it("stops polling once the status request has failed", () => {
    expect(jobStatusRefetchInterval(undefined, true)).toBe(false);
    expect(jobStatusRefetchInterval("PROCESSING", true)).toBe(false);
  });
});

describe("fetchJobStatus", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("throws on an HTTP error instead of resolving to nothing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("{}", { status: 404 })),
    );
    await expect(fetchJobStatus("j1")).rejects.toThrow("404");
  });

  it("throws when the response carries no job", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("{}", { status: 200 })),
    );
    await expect(fetchJobStatus("j1")).rejects.toThrow("no job");
  });

  it("returns the job data", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ data: { status: "QUEUED" } })),
      ),
    );
    expect(await fetchJobStatus("j1")).toEqual({ status: "QUEUED" });
  });
});
