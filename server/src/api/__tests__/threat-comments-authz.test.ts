/**
 * Adding a threat comment needs the "comment" permission; VIEWER only has
 * "view". Reading comments stays view.
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

const mockPrisma = {
  threat: { findFirst: vi.fn() },
  threatComment: {
    create: vi.fn(),
    findMany: vi.fn(),
  },
};

vi.mock("../../db.js", () => ({
  getPrisma: vi.fn(() => Promise.resolve(mockPrisma)),
}));
vi.mock("../../utils/access-cache.js", async () => {
  const acl = await import("../../test/helpers/access-control-mock.js");
  return {
    getAccessCache: () => ({
      canAccessThreatModel: async (userId: string, modelId: string) =>
        (await acl.checkThreatModelAccess(userId, modelId)).hasAccess,
    }),
  };
});
vi.mock("../mention-notifications.js", () => ({
  dispatchMentionNotifications: vi.fn(),
}));
vi.mock(
  "../../services/access-control/access-control-service.js",
  async () =>
    (await import("../../test/helpers/access-control-mock.js"))
      .accessControlModule,
);

const { modelGrants, resetGrants } = await import(
  "../../test/helpers/access-control-mock.js"
);
const { threatCommentRoutes } = await import("../threat-comments.js");

const url = "/api/threat-models/m1/threats/t1/comments";

describe("threat comment authorization", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify();
    app.addHook("preHandler", async (request) => {
      request.authUser = { id: "caller", email: "c@x.test", name: "C" };
    });
    await app.register(threatCommentRoutes);
    await app.ready();
  });

  afterAll(() => app.close());

  beforeEach(() => {
    vi.clearAllMocks();
    resetGrants();
    mockPrisma.threat.findFirst.mockResolvedValue({ id: "t1" });
    mockPrisma.threatComment.create.mockResolvedValue({ id: "c1" });
    mockPrisma.threatComment.findMany.mockResolvedValue([]);
  });

  it("POST: 403 for a viewer, nothing written", async () => {
    modelGrants.set("m1", { role: "VIEWER", organizationId: "o1" });
    const res = await app.inject({
      method: "POST",
      url,
      payload: { body: "hi" },
    });
    expect(res.statusCode).toBe(403);
    expect(mockPrisma.threatComment.create).not.toHaveBeenCalled();
  });

  it("POST: an editor can comment", async () => {
    modelGrants.set("m1", { role: "EDITOR", organizationId: "o1" });
    const res = await app.inject({
      method: "POST",
      url,
      payload: { body: "hi" },
    });
    expect(res.statusCode).toBe(201);
  });

  it("GET: a viewer can still read", async () => {
    modelGrants.set("m1", { role: "VIEWER", organizationId: "o1" });
    const res = await app.inject({ method: "GET", url });
    expect(res.statusCode).toBe(200);
  });
});
