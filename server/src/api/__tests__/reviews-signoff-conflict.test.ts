/**
 * S4 route guard: the sign-off handler must map InvalidReviewStateError to a
 * 409, not the generic 400 it shares with every other sign-off failure.
 *
 * Asserted over the source (same style as review-route-authorization.test.ts)
 * rather than through a full fastify harness, because the cheap failure mode
 * to guard is a future edit collapsing the `instanceof InvalidReviewStateError`
 * branch back into the catch-all `sendBadRequest`.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const REVIEWS = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "reviews.ts",
);

describe("sign-off route maps InvalidReviewStateError to 409", () => {
  const source = readFileSync(REVIEWS, "utf8");
  const signOffHandler = source
    .split(/\n {2}fastify\./)
    .find((chunk) => chunk.includes('"/api/reviews/:reviewId/sign-off"'));

  it("finds the sign-off route (guards against a silently empty match)", () => {
    expect(signOffHandler).toBeDefined();
  });

  it("imports InvalidReviewStateError and sendConflict", () => {
    expect(source).toContain("InvalidReviewStateError");
    expect(source).toContain("sendConflict");
  });

  it("catches InvalidReviewStateError and responds via sendConflict before the generic fallback", () => {
    const body = signOffHandler ?? "";
    expect(body).toContain("instanceof InvalidReviewStateError");
    expect(body).toContain("sendConflict(");

    // The InvalidReviewStateError check must come before the generic
    // sendBadRequest fallback, or it is dead code.
    const conflictIndex = body.indexOf("sendConflict(");
    const badRequestIndex = body.indexOf("sendBadRequest(");
    expect(conflictIndex).toBeGreaterThan(-1);
    expect(badRequestIndex).toBeGreaterThan(-1);
    expect(conflictIndex).toBeLessThan(badRequestIndex);
  });
});
