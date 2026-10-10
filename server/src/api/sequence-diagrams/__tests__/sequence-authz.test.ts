/**
 * Sequence diagram routes authorization: every seq/participant/message id in
 * the URL or body must belong to the threat model the caller was checked
 * against, and writes need edit permission on that model.
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
import { createFakePrisma } from "../../../test/helpers/fake-prisma.js";

const prisma = createFakePrisma(
  {
    sequenceDiagram: [
      { id: "s-a", threatModelId: "m-a" },
      { id: "s-b", threatModelId: "m-b" },
      { id: "s-view", threatModelId: "m-view" },
    ],
    sequenceParticipant: [
      { id: "p-a1", sequenceDiagramId: "s-a" },
      { id: "p-a2", sequenceDiagramId: "s-a" },
      { id: "p-b1", sequenceDiagramId: "s-b" },
    ],
    sequenceMessage: [
      { id: "g-a1", sequenceDiagramId: "s-a", fromId: "p-a1", toId: "p-a2" },
      { id: "g-b1", sequenceDiagramId: "s-b", fromId: "p-b1", toId: "p-b1" },
    ],
  },
  {
    sequenceParticipant: {
      sequenceDiagram: ["sequenceDiagram", "sequenceDiagramId"],
    },
    sequenceMessage: {
      sequenceDiagram: ["sequenceDiagram", "sequenceDiagramId"],
    },
  },
);

// u1 edits m-a, only views m-view, has no access to m-b.
const access = (modelId: string) =>
  modelId === "m-a"
    ? { hasAccess: true, permissions: ["view", "edit"], isGuest: false }
    : modelId === "m-view"
      ? { hasAccess: true, permissions: ["view"], isGuest: false }
      : { hasAccess: false, permissions: [], isGuest: false };

vi.mock("../../../db.js", () => ({ getPrisma: vi.fn(async () => prisma) }));
vi.mock("../../../services/access-control/access-control-service.js", () => ({
  checkThreatModelAccess: vi.fn(async (_u: string, m: string) => access(m)),
  canPerformAction: vi.fn(async (_u: string, m: string, action: string) => {
    const a = access(m);
    if (!a.hasAccess) return { allowed: false, error: "not found" };
    return a.permissions.includes(action)
      ? { allowed: true, access: a }
      : { allowed: false, error: `no '${action}' permission`, access: a };
  }),
}));

const { diagramRoutes } = await import("../routes/diagrams.js");
const { entityRoutes } = await import("../routes/entities.js");
const { messageRoutes } = await import("../routes/messages.js");

const base = "/api/threat-models";

describe("sequence diagram routes authorization", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify();
    app.addHook("preHandler", async (request) => {
      request.authUser = { id: "u1", email: "u1@x.test", name: "U1" };
    });
    await app.register(diagramRoutes);
    await app.register(entityRoutes);
    await app.register(messageRoutes);
    await app.ready();
  });

  afterAll(() => app.close());
  beforeEach(() => vi.clearAllMocks());

  describe("diagrams", () => {
    it("does not return another model's diagram", async () => {
      const res = await app.inject({
        method: "GET",
        url: `${base}/m-a/sequences/s-b`,
      });
      expect(res.statusCode).toBe(404);
    });

    it("does not update another model's diagram", async () => {
      const res = await app.inject({
        method: "PATCH",
        url: `${base}/m-a/sequences/s-b`,
        payload: { name: "pwned" },
      });
      expect(res.statusCode).toBe(404);
      expect(prisma.sequenceDiagram.update).not.toHaveBeenCalled();
    });

    it("does not delete another model's diagram", async () => {
      const res = await app.inject({
        method: "DELETE",
        url: `${base}/m-a/sequences/s-b`,
      });
      expect(res.statusCode).toBe(404);
      expect(prisma.sequenceDiagram.delete).not.toHaveBeenCalled();
    });

    it("rejects writes from a view-only user", async () => {
      const res = await app.inject({
        method: "PATCH",
        url: `${base}/m-view/sequences/s-view`,
        payload: { name: "x" },
      });
      expect(res.statusCode).toBe(403);
      expect(prisma.sequenceDiagram.update).not.toHaveBeenCalled();
    });

    it("deletes a diagram of the caller's model", async () => {
      const res = await app.inject({
        method: "DELETE",
        url: `${base}/m-a/sequences/s-a`,
      });
      expect(res.statusCode).toBe(204);
    });
  });

  describe("participants", () => {
    it("does not add a participant to another model's diagram", async () => {
      const res = await app.inject({
        method: "POST",
        url: `${base}/m-a/sequences/s-b/participants`,
        payload: { label: "x", order: 0 },
      });
      expect(res.statusCode).toBe(404);
      expect(prisma.sequenceParticipant.create).not.toHaveBeenCalled();
    });

    it("does not update a participant of another diagram", async () => {
      const res = await app.inject({
        method: "PATCH",
        url: `${base}/m-a/sequences/s-a/participants/p-b1`,
        payload: { label: "x" },
      });
      expect(res.statusCode).toBe(404);
      expect(prisma.sequenceParticipant.update).not.toHaveBeenCalled();
    });

    it("does not delete a participant of another diagram", async () => {
      const res = await app.inject({
        method: "DELETE",
        url: `${base}/m-a/sequences/s-a/participants/p-b1`,
      });
      expect(res.statusCode).toBe(404);
      expect(prisma.sequenceParticipant.delete).not.toHaveBeenCalled();
    });

    it("updates a participant of the caller's diagram", async () => {
      const res = await app.inject({
        method: "PATCH",
        url: `${base}/m-a/sequences/s-a/participants/p-a1`,
        payload: { label: "ok" },
      });
      expect(res.statusCode).toBe(200);
    });
  });

  describe("messages", () => {
    const msg = { label: "m", order: 0, fromId: "p-a1", toId: "p-a2" };

    it("does not add a message to another model's diagram", async () => {
      const res = await app.inject({
        method: "POST",
        url: `${base}/m-a/sequences/s-b/messages`,
        payload: { ...msg, fromId: "p-b1", toId: "p-b1" },
      });
      expect(res.statusCode).toBe(404);
      expect(prisma.sequenceMessage.create).not.toHaveBeenCalled();
    });

    it("rejects a message whose participants belong to another diagram", async () => {
      const res = await app.inject({
        method: "POST",
        url: `${base}/m-a/sequences/s-a/messages`,
        payload: { ...msg, toId: "p-b1" },
      });
      expect(res.statusCode).toBe(400);
      expect(prisma.sequenceMessage.create).not.toHaveBeenCalled();
    });

    it("creates a message between the diagram's own participants", async () => {
      const res = await app.inject({
        method: "POST",
        url: `${base}/m-a/sequences/s-a/messages`,
        payload: msg,
      });
      expect(res.statusCode).toBe(201);
    });

    it("does not update a message of another diagram", async () => {
      const res = await app.inject({
        method: "PATCH",
        url: `${base}/m-a/sequences/s-a/messages/g-b1`,
        payload: { label: "x" },
      });
      expect(res.statusCode).toBe(404);
      expect(prisma.sequenceMessage.update).not.toHaveBeenCalled();
    });

    it("rejects re-pointing a message at another diagram's participant", async () => {
      const res = await app.inject({
        method: "PATCH",
        url: `${base}/m-a/sequences/s-a/messages/g-a1`,
        payload: { toId: "p-b1" },
      });
      expect(res.statusCode).toBe(400);
      expect(prisma.sequenceMessage.update).not.toHaveBeenCalled();
    });

    it("does not delete a message of another diagram", async () => {
      const res = await app.inject({
        method: "DELETE",
        url: `${base}/m-a/sequences/s-a/messages/g-b1`,
      });
      expect(res.statusCode).toBe(404);
      expect(prisma.sequenceMessage.delete).not.toHaveBeenCalled();
    });

    it("refuses to reorder messages from another diagram", async () => {
      const res = await app.inject({
        method: "PUT",
        url: `${base}/m-a/sequences/s-a/messages/reorder`,
        payload: { messageIds: ["g-a1", "g-b1"] },
      });
      expect(res.statusCode).toBe(400);
      expect(prisma.sequenceMessage.update).not.toHaveBeenCalled();
    });

    it("refuses to reorder messages of another model's diagram", async () => {
      const res = await app.inject({
        method: "PUT",
        url: `${base}/m-a/sequences/s-b/messages/reorder`,
        payload: { messageIds: ["g-b1"] },
      });
      expect(res.statusCode).toBe(404);
      expect(prisma.sequenceMessage.update).not.toHaveBeenCalled();
    });

    it("reorders the diagram's own messages", async () => {
      const res = await app.inject({
        method: "PUT",
        url: `${base}/m-a/sequences/s-a/messages/reorder`,
        payload: { messageIds: ["g-a1"] },
      });
      expect(res.statusCode).toBe(200);
    });
  });
});
