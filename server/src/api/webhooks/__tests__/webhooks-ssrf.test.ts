/**
 * Outgoing webhooks may only target public hosts, and the test-delivery
 * endpoint never hands the remote response body back to the caller.
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
  webhook: {
    findFirst: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
};
const fetchMock = vi.fn();

vi.mock("../../../db.js", () => ({
  getPrisma: vi.fn(() => Promise.resolve(mockPrisma)),
}));
vi.mock("../../../services/access-control/access-control-service.js", () => ({
  checkOrganizationAccess: vi.fn(() =>
    Promise.resolve({ hasAccess: true, permissions: ["manage"] }),
  ),
}));
vi.mock("../../../services/audit.js", () => ({ logAudit: vi.fn() }));

const { webhookCrudRoutes } = await import("../routes/crud.js");
const { webhookDeliveryRoutes } = await import("../routes/delivery.js");

const PRIVATE_URL = "http://10.0.0.5:8080/admin";
const PUBLIC_URL = "http://93.184.216.34/hook";
const BASE = "/api/organizations/org-a/webhooks";

describe("webhook target URLs", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    vi.stubGlobal("fetch", fetchMock);
    app = Fastify();
    app.addHook("preHandler", async (request) => {
      request.authUser = { id: "u1", email: "u1@x.test", name: "U1" };
    });
    await app.register(webhookCrudRoutes);
    await app.register(webhookDeliveryRoutes);
    await app.ready();
  });

  afterAll(async () => {
    vi.unstubAllGlobals();
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.webhook.count.mockResolvedValue(0);
    mockPrisma.webhook.create.mockImplementation(({ data }) =>
      Promise.resolve({
        id: "wh-1",
        ...data,
        isActive: true,
        createdAt: new Date(),
      }),
    );
    mockPrisma.webhook.update.mockImplementation(({ data }) =>
      Promise.resolve({
        id: "wh-1",
        name: "n",
        url: PUBLIC_URL,
        events: "[]",
        isActive: true,
        ...data,
        updatedAt: new Date(),
      }),
    );
    mockPrisma.webhook.findFirst.mockResolvedValue({
      id: "wh-1",
      name: "n",
      url: PUBLIC_URL,
      secret: null,
    });
  });

  it("refuses to create a webhook pointing at a private address", async () => {
    const res = await app.inject({
      method: "POST",
      url: BASE,
      payload: { name: "n", url: PRIVATE_URL, events: ["threat.created"] },
    });

    expect(res.statusCode).toBe(400);
    expect(mockPrisma.webhook.create).not.toHaveBeenCalled();
  });

  it("refuses to repoint a webhook at loopback", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `${BASE}/wh-1`,
      payload: { url: "http://127.0.0.1:6379/" },
    });

    expect(res.statusCode).toBe(400);
    expect(mockPrisma.webhook.update).not.toHaveBeenCalled();
  });

  it("still creates a webhook for a public host", async () => {
    const res = await app.inject({
      method: "POST",
      url: BASE,
      payload: { name: "n", url: PUBLIC_URL, events: ["threat.created"] },
    });

    expect(res.statusCode).toBe(201);
  });

  it("test delivery does not call a stored private URL", async () => {
    mockPrisma.webhook.findFirst.mockResolvedValue({
      id: "wh-1",
      name: "n",
      url: PRIVATE_URL,
      secret: null,
    });

    const res = await app.inject({
      method: "POST",
      url: `${BASE}/wh-1/test`,
    });

    expect(res.statusCode).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("test delivery returns the status code but not the remote body", async () => {
    fetchMock.mockResolvedValue(
      new Response("internal secret page", { status: 500 }),
    );

    const res = await app.inject({
      method: "POST",
      url: `${BASE}/wh-1/test`,
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ success: false, statusCode: 500 });
    expect(res.body).not.toContain("internal secret page");
    expect(fetchMock).toHaveBeenCalledWith(
      PUBLIC_URL,
      expect.objectContaining({ redirect: "manual" }),
    );
    const stored = mockPrisma.webhook.update.mock.calls[0][0].data;
    expect(JSON.stringify(stored)).not.toContain("internal secret page");
  });
});
