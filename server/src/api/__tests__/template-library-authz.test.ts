/**
 * Threat-library and component-template routes authorization: a template id
 * must belong to the library in the URL, so an admin of one org cannot edit
 * or delete templates of another library (including the global defaults)
 * by pairing a library they own with a foreign template id.
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

const threatJson = {
  applicableComponentTypes: "[]",
  suggestedMitigations: "[]",
  complianceControls: "{}",
  cweIds: "[]",
  owaspIds: "[]",
};
const componentJson = {
  defaultProperties: "{}",
  suggestedThreats: "[]",
  tags: "[]",
};

const prisma = createFakePrisma({
  threatLibrary: [
    { id: "lib-a", organizationId: "org-a", isDefault: false },
    { id: "lib-def", organizationId: null, isDefault: true },
  ],
  threatTemplate: [
    { id: "t-a", libraryId: "lib-a", ...threatJson },
    { id: "t-def", libraryId: "lib-def", ...threatJson },
  ],
  componentTemplateLibrary: [
    { id: "clib-a", organizationId: "org-a", isDefault: false },
    { id: "clib-def", organizationId: null, isDefault: true },
  ],
  componentTemplate: [
    { id: "ct-a", libraryId: "clib-a", ...componentJson },
    { id: "ct-def", libraryId: "clib-def", ...componentJson },
  ],
});

vi.mock("../../db.js", () => ({ getPrisma: vi.fn(async () => prisma) }));

const { templateRoutes: threatTemplateRoutes } = await import(
  "../threat-library/routes/templates.js"
);
const { templateRoutes: componentTemplateRoutes } = await import(
  "../component-templates/routes/templates.js"
);

const cases = [
  {
    name: "threat template (org route)",
    url: "/api/organizations/org-a/threat-libraries/lib-a/templates",
    model: "threatTemplate",
  },
  {
    name: "threat template (convenience route)",
    url: "/api/threat-libraries/lib-a/templates",
    model: "threatTemplate",
  },
  {
    name: "component template",
    url: "/api/organizations/org-a/component-templates/clib-a/templates",
    model: "componentTemplate",
  },
] as const;

describe("template routes bind the template to the library in the URL", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    // u1 is OWNER of org-a only.
    prisma.membership.findUnique.mockImplementation(async ({ where }) =>
      (where.userId_organizationId as { organizationId: string })
        .organizationId === "org-a"
        ? { role: "OWNER", status: "ACTIVE" }
        : null,
    );
    app = Fastify();
    app.addHook("preHandler", async (request) => {
      request.authUser = { id: "u1", email: "u1@x.test", name: "U1" };
    });
    await app.register(threatTemplateRoutes);
    await app.register(componentTemplateRoutes);
    await app.ready();
  });

  afterAll(() => app.close());
  beforeEach(() => vi.clearAllMocks());

  for (const c of cases) {
    const foreign = c.model === "threatTemplate" ? "t-def" : "ct-def";
    const own = c.model === "threatTemplate" ? "t-a" : "ct-a";

    describe(c.name, () => {
      it("does not update a default-library template via an owned library", async () => {
        const res = await app.inject({
          method: "PATCH",
          url: `${c.url}/${foreign}`,
          payload: { name: "pwned" },
        });
        expect(res.statusCode).toBe(404);
        expect(prisma[c.model].update).not.toHaveBeenCalled();
        expect(prisma[c.model].updateMany).not.toHaveBeenCalled();
      });

      it("does not delete a default-library template via an owned library", async () => {
        const res = await app.inject({
          method: "DELETE",
          url: `${c.url}/${foreign}`,
        });
        expect(res.statusCode).toBe(404);
        expect(prisma[c.model].delete).not.toHaveBeenCalled();
        // Any bulk delete must be scoped to the library in the URL.
        for (const [args] of prisma[c.model].deleteMany.mock.calls) {
          expect(args.where).toMatchObject({
            libraryId: expect.stringMatching(/^c?lib-a$/),
          });
        }
      });

      it("updates a template of the owned library", async () => {
        const res = await app.inject({
          method: "PATCH",
          url: `${c.url}/${own}`,
          payload: { name: "ok" },
        });
        expect(res.statusCode).toBe(200);
      });

      it("deletes a template of the owned library", async () => {
        const res = await app.inject({
          method: "DELETE",
          url: `${c.url}/${own}`,
        });
        expect(res.statusCode).toBe(204);
      });
    });
  }
});
