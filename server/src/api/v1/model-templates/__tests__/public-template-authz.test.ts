/**
 * An org EDITOR could create a public template, or save a threat model as a
 * public template (organizationId null): it then shows in every tenant's
 * marketplace. Publishing is an org ADMIN action, as for
 * /marketplace/publish; private templates still need only EDITOR.
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
import { createFakePrisma } from "../../../../test/helpers/fake-prisma.js";

const prisma = createFakePrisma({
  threatModel: [
    {
      id: "m1",
      canvasState: "{}",
      project: { organizationId: "o1" },
      components: [],
      boundaries: [],
      threats: [],
    },
  ],
});
prisma.modelTemplate.create.mockImplementation(async ({ data }) => ({
  id: "t1",
  createdAt: new Date(),
  ...data,
}));
vi.mock("../../../../db.js", () => ({
  getPrisma: vi.fn(() => Promise.resolve(prisma)),
}));
vi.mock("../../../../services/audit.js", () => ({ logAudit: vi.fn() }));
vi.mock(
  "../../../../services/access-control/access-control-service.js",
  async () =>
    (await import("../../../../test/helpers/access-control-mock.js"))
      .accessControlModule,
);

const { orgRoles, resetGrants } = await import(
  "../../../../test/helpers/access-control-mock.js"
);
const { createRoutes } = await import("../create-routes.js");

describe("public model templates need org ADMIN", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify();
    app.addHook("preHandler", async (request) => {
      request.authUser = { id: "caller", email: "c@x.test", name: "C" };
    });
    await app.register(createRoutes);
    await app.ready();
  });
  afterAll(() => app.close());
  beforeEach(() => {
    vi.clearAllMocks();
    resetGrants();
  });

  const create = (isPublic: boolean) =>
    app.inject({
      method: "POST",
      url: "/model-templates",
      payload: { organizationId: "o1", name: "T", isPublic },
    });
  const saveAs = (isPublic: boolean) =>
    app.inject({
      method: "POST",
      url: "/threat-models/m1/save-as-template",
      payload: { name: "T", isPublic },
    });

  for (const [label, send] of [
    ["create", create],
    ["save-as-template", saveAs],
  ] as const) {
    it(`${label}: 403 for an editor making it public`, async () => {
      orgRoles.set("o1", "EDITOR");
      const res = await send(true);
      expect(res.statusCode).toBe(403);
      expect(prisma.modelTemplate.create).not.toHaveBeenCalled();
    });

    it(`${label}: an editor may still save a private template`, async () => {
      orgRoles.set("o1", "EDITOR");
      const res = await send(false);
      expect(res.statusCode).toBe(201);
    });

    it(`${label}: an admin may publish`, async () => {
      orgRoles.set("o1", "ADMIN");
      const res = await send(true);
      expect(res.statusCode).toBe(201);
    });
  }
});
