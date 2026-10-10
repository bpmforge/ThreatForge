/**
 * Creating models (POST /api/threat-models, the JSON import and the five
 * /import/* routes) and projects (POST /api/projects) needed only an ACTIVE
 * membership, so an org VIEWER could create them. They now need EDITOR or
 * above in the target organization, and when no project / org is given the
 * route only picks one where the caller is EDITOR+, never one where they
 * only view. A user whose memberships are all SUSPENDED is refused instead
 * of being given a fresh org.
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

type Role = "OWNER" | "ADMIN" | "EDITOR" | "VIEWER";
type Status = "ACTIVE" | "SUSPENDED";
/** The caller's memberships: org -> { role, status }. Each org has one project p-<org>. */
let memberships: Record<string, { role: Role; status: Status }> = {};

type Some = { userId?: string; status?: string; role?: { in: Role[] } };
const matches = (org: string, some: Some = {}) => {
  const m = memberships[org];
  if (!m) return false;
  if (some.status && m.status !== some.status) return false;
  if (some.role && !some.role.in.includes(m.role)) return false;
  return true;
};
const projectOf = (org: string) => ({ id: `p-${org}`, organizationId: org });

const mockPrisma = {
  project: {
    findFirst: vi.fn(
      async ({
        where,
      }: {
        where: {
          id?: string;
          organization?: { memberships?: { some?: Some } };
        };
      }) => {
        const some = where.organization?.memberships?.some;
        const org = Object.keys(memberships).find(
          (o) => (!where.id || where.id === `p-${o}`) && matches(o, some),
        );
        return org ? projectOf(org) : null;
      },
    ),
    create: vi.fn(async ({ data }: { data: { organizationId: string } }) => ({
      ...projectOf(data.organizationId),
      name: "p",
      description: null,
      status: "ACTIVE",
      createdById: "caller",
      organization: { id: data.organizationId, name: "o", slug: "o" },
      createdBy: { id: "caller", name: "C" },
      projectMembers: [],
      threatModels: [],
      _count: { threatModels: 0 },
      createdAt: new Date(),
      updatedAt: new Date(),
    })),
  },
  membership: {
    findFirst: vi.fn(async ({ where }: { where: Some }) => {
      const org = Object.keys(memberships).find((o) => matches(o, where));
      return org ? { organizationId: org, ...memberships[org] } : null;
    }),
    findMany: vi.fn(async ({ where }: { where: Some }) =>
      Object.keys(memberships)
        .filter((o) => matches(o, where))
        .map((o) => ({ organizationId: o, role: memberships[o].role })),
    ),
    count: vi.fn(async () => Object.keys(memberships).length),
    create: vi.fn(),
  },
  organization: { create: vi.fn(async () => ({ id: "o-new" })) },
  projectMember: { create: vi.fn(async () => ({})) },
  threatModel: {
    create: vi.fn(async ({ data }: { data: { projectId: string } }) => ({
      id: "m-new",
      name: "m",
      canvasState: "{}",
      projectId: data.projectId,
      project: { organizationId: "o" },
    })),
  },
};

vi.mock("../../db.js", () => ({
  getPrisma: vi.fn(() => Promise.resolve(mockPrisma)),
}));
vi.mock("../../services/audit.js", () => ({
  logAudit: vi.fn(() => Promise.resolve()),
}));
vi.mock(
  "../../services/access-control/access-control-service.js",
  async (orig) => {
    const mock = await import("../../test/helpers/access-control-mock.js");
    return {
      ...(await orig<object>()),
      ...mock.accessControlModule,
    };
  },
);

const { projectGrants, orgUserRoles, resetGrants } = await import(
  "../../test/helpers/access-control-mock.js"
);
const { crudRoutes: modelCrud } = await import(
  "../threat-models/routes/crud.js"
);
const { importRoutes } = await import("../threat-models/routes/import.js");
const { exportImportRoutes } = await import(
  "../threat-models/routes/export-import.js"
);
const { crudRoutes: projectCrud } = await import("../projects/routes/crud.js");

/** Make the caller `role` (ACTIVE) in each org, for both the fake DB and the access mock. */
function member(orgs: Record<string, Role>, status: Status = "ACTIVE") {
  resetGrants();
  memberships = {};
  for (const [org, role] of Object.entries(orgs)) {
    memberships[org] = { role, status };
    if (status === "ACTIVE") {
      orgUserRoles.set(`${org}:caller`, role);
      projectGrants.set(`p-${org}`, { role, organizationId: org });
    }
  }
}

const yaml = 'name: "Imported"\n';
const modelCreates = [
  { url: "/api/threat-models", payload: { name: "m" } },
  { url: "/api/threat-models/import", payload: { name: "m" } },
  { url: "/api/threat-models/import/yaml", payload: { content: yaml } },
];

describe("creating models and projects requires EDITOR", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify();
    app.addHook("preHandler", async (request) => {
      request.authUser = { id: "caller", email: "c@x.test", name: "C" };
    });
    await app.register(modelCrud);
    await app.register(importRoutes);
    await app.register(exportImportRoutes);
    await app.register(projectCrud);
    await app.ready();
  });

  afterAll(() => app.close());
  beforeEach(() => vi.clearAllMocks());

  for (const r of modelCreates) {
    it(`POST ${r.url} into a project where the caller is VIEWER: 403`, async () => {
      member({ o1: "VIEWER" });
      const res = await app.inject({
        method: "POST",
        url: r.url,
        payload: { ...r.payload, projectId: "p-o1" },
      });
      expect(res.statusCode).toBe(403);
      expect(mockPrisma.threatModel.create).not.toHaveBeenCalled();
    });

    it(`POST ${r.url} without projectId skips orgs where the caller only views`, async () => {
      member({ o1: "VIEWER", o2: "EDITOR" });
      const res = await app.inject({
        method: "POST",
        url: r.url,
        payload: r.payload,
      });
      expect(res.statusCode).toBe(201);
      expect(mockPrisma.threatModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ projectId: "p-o2" }),
        }),
      );
    });

    it(`POST ${r.url} without projectId, VIEWER everywhere: refused`, async () => {
      member({ o1: "VIEWER" });
      const res = await app.inject({
        method: "POST",
        url: r.url,
        payload: r.payload,
      });
      expect([400, 403]).toContain(res.statusCode);
      expect(mockPrisma.threatModel.create).not.toHaveBeenCalled();
      expect(mockPrisma.organization.create).not.toHaveBeenCalled();
    });
  }

  it("POST /api/threat-models: a fully suspended user gets 403, not a new org", async () => {
    member({ o1: "EDITOR" }, "SUSPENDED");
    const res = await app.inject({
      method: "POST",
      url: "/api/threat-models",
      payload: { name: "m" },
    });
    expect(res.statusCode).toBe(403);
    expect(mockPrisma.organization.create).not.toHaveBeenCalled();
  });

  it("POST /api/projects: 403 for an org VIEWER", async () => {
    member({ o1: "VIEWER" });
    const res = await app.inject({
      method: "POST",
      url: "/api/projects",
      payload: { name: "proj", organizationId: "o1" },
    });
    expect(res.statusCode).toBe(403);
    expect(mockPrisma.project.create).not.toHaveBeenCalled();
  });

  it("POST /api/projects without organizationId picks an org where the caller is EDITOR+", async () => {
    member({ o1: "VIEWER", o2: "EDITOR" });
    const res = await app.inject({
      method: "POST",
      url: "/api/projects",
      payload: { name: "proj" },
    });
    expect(res.statusCode).toBe(201);
    expect(mockPrisma.project.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ organizationId: "o2" }),
      }),
    );
  });
});
