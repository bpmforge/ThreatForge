/**
 * The Slack integration route re-initialised the process-wide notification
 * service with the caller's bot token: any signed-in user replaced the Slack
 * client every tenant's notifications go through. Slack is an instance-wide
 * integration, so only a super-admin may configure it.
 *
 * The Teams route stored a webhook URL the server POSTs to, unchecked, and
 * also replaced the shared Teams client. It now needs a public URL, and each
 * send builds a client from the recipient's own webhook.
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

const service = {
  initialize: vi.fn(),
  updateUserPreferences: vi.fn(async (_u: string, p: unknown) => p),
};
vi.mock("../../services/notifications/index.js", () => ({
  getNotificationService: () => service,
}));
const isSuperAdmin = vi.fn();
vi.mock("../admin/utils.js", () => ({ isSuperAdmin }));

const { notificationRoutes } = await import("../notifications.js");

describe("notification integration routes", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify();
    app.addHook("preHandler", async (request) => {
      request.authUser = { id: "caller", email: "c@x.test", name: "C" };
    });
    await app.register(notificationRoutes);
    await app.ready();
  });
  afterAll(() => app.close());
  beforeEach(() => vi.clearAllMocks());

  const slack = () =>
    app.inject({
      method: "POST",
      url: "/api/notifications/integrations/slack",
      payload: { botToken: "xoxb-attacker", defaultChannel: "C1" },
    });

  it("Slack: 403 for a user who is not a super-admin", async () => {
    isSuperAdmin.mockResolvedValue(false);
    const res = await slack();
    expect(res.statusCode).toBe(403);
    expect(service.initialize).not.toHaveBeenCalled();
  });

  it("Slack: a super-admin configures the instance client", async () => {
    isSuperAdmin.mockResolvedValue(true);
    const res = await slack();
    expect(res.statusCode).toBe(200);
    expect(service.initialize).toHaveBeenCalledWith({
      slack: { botToken: "xoxb-attacker", defaultChannel: "C1" },
    });
  });

  const teams = (webhookUrl: string) =>
    app.inject({
      method: "POST",
      url: "/api/notifications/integrations/teams",
      payload: { webhookUrl },
    });

  it("Teams: 400 for a private or metadata webhook URL", async () => {
    for (const url of ["http://169.254.169.254/x", "http://127.0.0.1:8080/"]) {
      const res = await teams(url);
      expect(res.statusCode).toBe(400);
    }
    expect(service.updateUserPreferences).not.toHaveBeenCalled();
  });

  it("Teams: a public URL is stored on the caller only", async () => {
    const res = await teams("https://93.184.216.34/hook");
    expect(res.statusCode).toBe(200);
    expect(service.updateUserPreferences).toHaveBeenCalledWith("caller", {
      teams: { enabled: true, webhookUrl: "https://93.184.216.34/hook" },
    });
    expect(service.initialize).not.toHaveBeenCalled();
  });
});
