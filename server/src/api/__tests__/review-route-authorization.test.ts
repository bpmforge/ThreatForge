/**
 * S2 regression guard: review routes must authorize per resource.
 *
 * Same shape as the S1 guard on AI routes, and for the same reason. Every
 * review handler already authenticated — `request.authUser?.id` or a 401 — and
 * then trusted the `:reviewId` in the URL. Authentication proves who you are;
 * it says nothing about whether this review is yours. The result was
 * cross-tenant read of reviewer identities and comment threads, and
 * cross-tenant write via decisions, comments, checklist completion and
 * sign-off.
 *
 * Asserted over the source rather than through mocks, because the failure mode
 * is a NEW route forgetting, not an existing one misbehaving. A route keyed on
 * a resource id must resolve that id to an access decision.
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

/** Handler chunks, split on the route registration boundary. */
function handlers(): Array<{ route: string; body: string }> {
  const source = readFileSync(REVIEWS, "utf8");
  return source
    .split(/\n {2}fastify\./)
    .slice(1)
    .map((body) => {
      const m = body.match(/"(\/api\/[^"]+)"/);
      return m ? { route: m[1], body } : null;
    })
    .filter((h): h is { route: string; body: string } => h !== null);
}

describe("review routes authorize per resource", () => {
  const all = handlers();

  it("finds review routes (guards against a silently empty sweep)", () => {
    expect(all.length).toBeGreaterThan(8);
  });

  for (const { route, body } of all) {
    // Routes keyed on a resource id, plus the create path whose body names the
    // target model. `/api/reviews/pending` is scoped to the caller's own user
    // id and needs no per-resource check.
    const needsGate =
      route.includes(":reviewId") ||
      route.includes(":modelId") ||
      /threatModelId/.test(body);
    if (!needsGate) continue;

    it(`${route} resolves the caller's access`, () => {
      // reviewCaller() wraps canAccessReview; authorizeModelAction is the
      // role-aware model check.
      const gated = [
        "canAccessReview(",
        "reviewCaller(",
        "canAccessThreatModel(",
        "authorizeModelAction(",
      ].some((check) => body.includes(check));
      expect(
        gated,
        `${route} is keyed on a resource the caller does not necessarily own, ` +
          `but never calls reviewCaller/canAccessReview or a model access check. An ` +
          `authenticated user is not an authorized one.`,
      ).toBe(true);
    });
  }
});
