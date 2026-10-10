/**
 * PATCH /api/projects/:id and the project member routes accepted any ACTIVE
 * org member, viewers included. Updating a project needs edit; managing its
 * members needs manage (org ADMIN/OWNER). Adding a member also created a
 * User row for any email it was given — a ghost account squatting on someone
 * else's address. It now requires an existing, ACTIVE member of the
 * project's organization (invite them to the org first).
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
  project: [{ id: "p1", organizationId: "o1" }],
  user: [
    { id: "alice", email: "alice@x.test", name: "Alice" },
    { id: "outsider", email: "out@x.test", name: "Out" },
  ],
  projectMember: [{ id: "pm1", projectId: "p1", userId: "alice" }],
});

vi.mock("../../db.js", () => ({
  getPrisma: vi.fn(() => Promise.resolve(prisma)),
}));
vi.mock(
  "../../services/access-control/access-control-service.js",
  async () =>
    (await import("../../test/helpers/access-control-mock.js"))
      .accessControlModule,
);

const { projectGrants, orgUserRoles, resetGrants } = await import(
  "../../test/helpers/access-control-mock.js"
);
const { memberRoutes } = await import("../projects/routes/members.js");
const { crudRoutes } = await import("../projects/routes/crud.js");

describe("project update and member management authorization", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify();
    app.addHook("preHandler", async (request) => {
      request.authUser = { id: "caller", email: "c@x.test", name: "C" };
    });
    await app.register(memberRoutes);
    await app.register(crudRoutes);
    await app.ready();
  });

  afterAll(() => app.close());

  beforeEach(() => {
    vi.clearAllMocks();
    resetGrants();
  });

  const as = (role: "VIEWER" | "EDITOR" | "ADMIN") =>
    projectGrants.set("p1", { role, organizationId: "o1" });

  it("PATCH project: 403 for a viewer", async () => {
    as("VIEWER");
    const res = await app.inject({
      method: "PATCH",
      url: "/api/projects/p1",
      payload: { name: "renamed" },
    });
    expect(res.statusCode).toBe(403);
    expect(prisma.project.update).not.toHaveBeenCalled();
  });

  const memberWrites = [
    {
      method: "POST",
      url: "/api/projects/p1/members",
      payload: { email: "alice@x.test", role: "EDITOR" },
    },
    {
      method: "PATCH",
      url: "/api/projects/p1/members/pm1",
      payload: { role: "OWNER" },
    },
    { method: "DELETE", url: "/api/projects/p1/members/pm1" },
  ] as const;

  for (const w of memberWrites) {
    it(`${w.method} ${w.url}: 403 for an editor`, async () => {
      as("EDITOR");
      const res = await app.inject({ ...w });
      expect(res.statusCode).toBe(403);
      expect(prisma.projectMember.create).not.toHaveBeenCalled();
      expect(prisma.projectMember.update).not.toHaveBeenCalled();
      expect(prisma.projectMember.delete).not.toHaveBeenCalled();
    });
  }

  it("POST member: an unknown email is refused and no user is created", async () => {
    as("ADMIN");
    const res = await app.inject({
      method: "POST",
      url: "/api/projects/p1/members",
      payload: { email: "nobody@elsewhere.test", role: "VIEWER" },
    });
    expect(res.statusCode).toBe(400);
    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(prisma.projectMember.create).not.toHaveBeenCalled();
  });

  it("POST member: a registered user outside the org is refused", async () => {
    as("ADMIN");
    const res = await app.inject({
      method: "POST",
      url: "/api/projects/p1/members",
      payload: { email: "out@x.test", role: "VIEWER" },
    });
    expect(res.statusCode).toBe(400);
    expect(prisma.projectMember.create).not.toHaveBeenCalled();
  });

  it("POST member: an admin can add an active org member", async () => {
    as("ADMIN");
    orgUserRoles.set("o1:alice", "VIEWER");
    prisma.projectMember.findUnique.mockResolvedValueOnce(null);
    const res = await app.inject({
      method: "POST",
      url: "/api/projects/p1/members",
      payload: { email: "alice@x.test", role: "EDITOR" },
    });
    expect(res.statusCode).toBe(201);
    expect(prisma.user.create).not.toHaveBeenCalled();
  });
});
