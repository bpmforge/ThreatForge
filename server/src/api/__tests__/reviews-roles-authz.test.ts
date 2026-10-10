/**
 * Review creation only required view access and accepted any user id as a
 * reviewer, so a viewer could open a review naming themselves SIGN_OFF
 * authority and then sign it off. Creating a review now needs edit, every
 * reviewer must be an ACTIVE member of the model's organization, and signing
 * off needs edit at the time of sign-off. Comment resolution resolved any
 * comment id, in any review; it is now bound to the review in the URL.
 */
import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  vi,
} from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import { createFakePrisma } from "../../test/helpers/fake-prisma.js";

let prisma = createFakePrisma({});

vi.mock("../../db.js", () => ({
  getPrisma: vi.fn(() => Promise.resolve(prisma)),
}));
vi.mock(
  "../../services/access-control/access-control-service.js",
  async () =>
    (await import("../../test/helpers/access-control-mock.js"))
      .accessControlModule,
);
vi.mock("../mention-notifications.js", () => ({
  dispatchMentionNotifications: vi.fn(),
}));
const createReviewRequest = vi.fn(async () => ({ id: "r-new" }));
const signOffReview = vi.fn(async () => ({ id: "so" }));
vi.mock("../../services/review-workflow/index.js", async (orig) => ({
  ...(await orig<typeof import("../../services/review-workflow/index.js")>()),
  createReviewRequest: (...a: unknown[]) => createReviewRequest(...(a as [])),
  signOffReview: (...a: unknown[]) => signOffReview(...(a as [])),
}));

const { modelGrants, orgUserRoles, resetGrants } = await import(
  "../../test/helpers/access-control-mock.js"
);
const { reviewRoutes } = await import("../reviews.js");

const reviewBody = (userId: string, role = "SIGN_OFF_AUTHORITY") => ({
  threatModelId: "m1",
  reviewers: [{ userId, role, required: true }],
});

describe("review authorization", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify();
    app.addHook("preHandler", async (request) => {
      request.authUser = { id: "caller", email: "c@x.test", name: "C" };
    });
    await app.register(reviewRoutes);
    await app.ready();
  });

  afterAll(() => app.close());

  beforeEach(() => {
    resetGrants();
    createReviewRequest.mockClear();
    signOffReview.mockClear();
    prisma = createFakePrisma({
      reviewRequest: [
        { id: "r1", threatModelId: "m1" },
        { id: "r-victim", threatModelId: "victim" },
      ],
      reviewComment: [
        { id: "rc1", reviewRequestId: "r1" },
        { id: "rc-victim", reviewRequestId: "r-victim" },
      ],
      reviewActivity: [],
    });
  });

  it("POST /api/reviews: 403 for a viewer naming themselves reviewer", async () => {
    modelGrants.set("m1", { role: "VIEWER", organizationId: "o1" });
    orgUserRoles.set("o1:caller", "VIEWER");
    const res = await app.inject({
      method: "POST",
      url: "/api/reviews",
      payload: reviewBody("caller"),
    });
    expect(res.statusCode).toBe(403);
    expect(createReviewRequest).not.toHaveBeenCalled();
  });

  it("POST /api/reviews: 400 when a reviewer is not an active org member", async () => {
    modelGrants.set("m1", { role: "EDITOR", organizationId: "o1" });
    orgUserRoles.set("o1:caller", "EDITOR");
    const res = await app.inject({
      method: "POST",
      url: "/api/reviews",
      payload: reviewBody("outsider"),
    });
    expect(res.statusCode).toBe(400);
    expect(createReviewRequest).not.toHaveBeenCalled();
  });

  it("POST /api/reviews: a VIEWER can review but not be sign-off authority", async () => {
    // Sign-off needs edit, so a VIEWER named sign-off authority could never
    // complete the review: refuse it up front.
    modelGrants.set("m1", { role: "EDITOR", organizationId: "o1" });
    orgUserRoles.set("o1:caller", "EDITOR");
    orgUserRoles.set("o1:alice", "VIEWER");
    const asSignOff = await app.inject({
      method: "POST",
      url: "/api/reviews",
      payload: reviewBody("alice"),
    });
    expect(asSignOff.statusCode).toBe(400);
    expect(asSignOff.body).toContain("sign-off authority");
    expect(createReviewRequest).not.toHaveBeenCalled();

    const asReviewer = await app.inject({
      method: "POST",
      url: "/api/reviews",
      payload: reviewBody("alice", "REVIEWER"),
    });
    expect(asReviewer.statusCode).toBe(200);
    expect(createReviewRequest).toHaveBeenCalled();
  });

  it("POST /api/reviews: an EDITOR may be sign-off authority", async () => {
    modelGrants.set("m1", { role: "EDITOR", organizationId: "o1" });
    orgUserRoles.set("o1:caller", "EDITOR");
    orgUserRoles.set("o1:bob", "EDITOR");
    const res = await app.inject({
      method: "POST",
      url: "/api/reviews",
      payload: reviewBody("bob"),
    });
    expect(res.statusCode).toBe(200);
  });

  const signOff = { statement: "I have reviewed this model." };

  it("sign-off: 403 for a viewer even when assigned", async () => {
    modelGrants.set("m1", { role: "VIEWER", organizationId: "o1" });
    const res = await app.inject({
      method: "POST",
      url: "/api/reviews/r1/sign-off",
      payload: signOff,
    });
    expect(res.statusCode).toBe(403);
    expect(signOffReview).not.toHaveBeenCalled();
  });

  it("sign-off: an editor reaches the sign-off service", async () => {
    modelGrants.set("m1", { role: "EDITOR", organizationId: "o1" });
    const res = await app.inject({
      method: "POST",
      url: "/api/reviews/r1/sign-off",
      payload: signOff,
    });
    expect(res.statusCode).toBe(200);
    expect(signOffReview).toHaveBeenCalled();
  });

  it("resolve: a comment from another review is a 404", async () => {
    modelGrants.set("m1", { role: "EDITOR", organizationId: "o1" });
    const res = await app.inject({
      method: "POST",
      url: "/api/reviews/r1/comments/rc-victim/resolve",
    });
    expect(res.statusCode).toBe(404);
    expect(prisma.reviewComment.update).not.toHaveBeenCalled();
  });

  it("comment, resolve and checklist: 403 for a viewer, ok for an editor", async () => {
    const calls = [
      { url: "/api/reviews/r1/comments", payload: { content: "hi" } },
      { url: "/api/reviews/r1/comments/rc1/resolve", payload: undefined },
      {
        url: "/api/reviews/r1/checklist",
        payload: { checklistItemId: "c1" },
      },
    ];
    for (const c of calls) {
      modelGrants.set("m1", { role: "VIEWER", organizationId: "o1" });
      const denied = await app.inject({ method: "POST", ...c });
      expect(denied.statusCode, c.url).toBe(403);
      expect(prisma.reviewComment.update).not.toHaveBeenCalled();
    }
    modelGrants.set("m1", { role: "EDITOR", organizationId: "o1" });
    const ok = await app.inject({
      method: "POST",
      url: "/api/reviews/r1/comments/rc1/resolve",
    });
    expect(ok.statusCode).not.toBe(403);
  });
});
