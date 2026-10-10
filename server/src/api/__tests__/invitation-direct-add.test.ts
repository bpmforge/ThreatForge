/**
 * `addDirectly: true` made any registered user an ACTIVE member of the org
 * without their consent, and silently reactivated a SUSPENDED membership.
 * Every invite now goes through the invitation (the user accepts it), and a
 * suspended member is refused with 409: unsuspend them instead.
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

const prisma = {
  membership: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
  },
  user: { findUnique: vi.fn() },
  organization: { findUnique: vi.fn() },
  auditLog: { create: vi.fn() },
};
vi.mock("../../db.js", () => ({ getPrisma: vi.fn(async () => prisma) }));
const createInvitation = vi.fn();
vi.mock("../../services/invitation/invitation-service.js", () => ({
  createInvitation,
  getPendingInvitations: vi.fn(),
  revokeInvitation: vi.fn(),
}));
vi.mock("../../services/webhooks/webhook-dispatcher.js", () => ({
  dispatchWebhookEvent: vi.fn(),
}));

const { invitationRoutes } = await import("../invitations.js");
const realService = await vi.importActual<
  typeof import("../../services/invitation/invitation-service.js")
>("../../services/invitation/invitation-service.js");

describe("invitations: no direct add", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify();
    app.addHook("preHandler", async (request) => {
      request.authUser = { id: "owner", email: "o@x.test", name: "O" };
    });
    await invitationRoutes(app, {});
    await app.ready();
  });
  afterAll(() => app.close());

  beforeEach(() => {
    vi.clearAllMocks();
    prisma.membership.findFirst.mockResolvedValue({
      role: "OWNER",
      status: "ACTIVE",
    });
    prisma.user.findUnique.mockResolvedValue({
      id: "bob",
      name: "Bob",
      status: "ACTIVE",
    });
    createInvitation.mockResolvedValue({
      success: true,
      invitationId: "m1",
      invitationToken: "t",
    });
  });

  const invite = () =>
    app.inject({
      method: "POST",
      url: "/api/organizations/o1/invitations",
      payload: { email: "bob@x.test", role: "EDITOR", addDirectly: true },
    });

  it("a registered user gets an invitation, not a membership", async () => {
    prisma.membership.findUnique.mockResolvedValue(null);
    const res = await invite();
    expect(res.statusCode).toBe(201);
    expect(createInvitation).toHaveBeenCalled();
    expect(prisma.membership.create).not.toHaveBeenCalled();
    expect(res.json().data.addedDirectly).toBeUndefined();
  });

  it("a suspended member is not reactivated (409)", async () => {
    createInvitation.mockImplementationOnce(realService.createInvitation);
    prisma.organization.findUnique.mockResolvedValue({ id: "o1", name: "O" });
    prisma.membership.findUnique.mockResolvedValue({
      id: "m1",
      status: "SUSPENDED",
    });
    const res = await invite();
    expect(res.statusCode).toBe(409);
    expect(prisma.membership.update).not.toHaveBeenCalled();
    expect(prisma.membership.create).not.toHaveBeenCalled();
  });
});
