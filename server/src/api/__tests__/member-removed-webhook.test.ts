/**
 * DELETE /api/organizations/:organizationId/members/:memberId looked the
 * membership up by id alone and then fired member.removed (with the removed
 * user's email) at the org named in the URL. An admin of org A could remove
 * an A member through /organizations/B/... and deliver A's member data to
 * B's webhooks. The membership must now belong to the URL's org.
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

const prisma = createFakePrisma({
  membership: [
    {
      id: "m-bob",
      organizationId: "oA",
      userId: "bob",
      role: "VIEWER",
      status: "ACTIVE",
      organization: { id: "oA", name: "A", isPersonal: false },
      user: { id: "bob", email: "bob@x.test" },
    },
    {
      id: "m-admin",
      organizationId: "oA",
      userId: "admin",
      role: "ADMIN",
      status: "ACTIVE",
    },
  ],
});
vi.mock("../../db.js", () => ({
  getPrisma: vi.fn(() => Promise.resolve(prisma)),
}));
const dispatchWebhookEvent = vi.fn();
vi.mock("../../services/webhooks/webhook-dispatcher.js", () => ({
  dispatchWebhookEvent,
}));

const { memberRoutes } = await import("../members.js");

describe("member.removed is bound to the membership's org", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify();
    app.addHook("preHandler", async (request) => {
      request.authUser = { id: "admin", email: "a@x.test", name: "A" };
    });
    await app.register(memberRoutes);
    await app.ready();
  });
  afterAll(() => app.close());
  beforeEach(() => vi.clearAllMocks());

  it("404 when the membership is not in the URL's org; nothing removed or sent", async () => {
    const res = await app.inject({
      method: "DELETE",
      url: "/api/organizations/oB/members/m-bob",
    });
    expect(res.statusCode).toBe(404);
    expect(dispatchWebhookEvent).not.toHaveBeenCalled();
  });
});
