import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchJobList } from "./useJobList";

describe("fetchJobList", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("returns the jobs array from the paginated list response", async () => {
    const job = { id: "j1", type: "SUGGEST_THREATS", status: "QUEUED" };
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              data: [job],
              pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
            }),
          ),
      ),
    );
    const jobs = await fetchJobList({ status: "QUEUED,PROCESSING", limit: 10 });
    expect(Array.isArray(jobs)).toBe(true);
    expect(jobs).toEqual([job]);
  });
});
