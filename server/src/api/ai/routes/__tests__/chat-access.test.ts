/**
 * Security regression test for the chat IDOR fix (Phase 0 / S1).
 *
 * Both chat routes must verify org membership for the target model before
 * doing any work. Prior to the fix they resolved the model from the :modelId
 * param alone, letting any authenticated user read any model's AI context.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import Fastify from "fastify";

const mockCanAccess = vi.fn();
const mockGetAIServiceForModel = vi.fn();

vi.mock("../../../threat-models/helpers.js", () => ({
  canAccessThreatModel: mockCanAccess,
}));

// The spend cap and rate limit run after authz in production; not under test.
vi.mock("../../guards.js", () => ({ aiGuarded: () => ({}) }));

// Stub the AI helper module so the access check is the only gate under test.
// The response helpers are trivial reply wrappers reimplemented here.
vi.mock("../../helpers.js", () => ({
  getAIServiceForModel: mockGetAIServiceForModel,
  buildThreatModelContext: vi.fn().mockResolvedValue(null),
  getPrisma: vi.fn(),
  AIProviderManager: class {},
  StreamingHandler: class {},
  sanitizeMessage: (s: string) => s,
  sanitizeMessages: (m: unknown) => m,
  sendSuccess: (reply: { send: (b: unknown) => unknown }, data: unknown) =>
    reply.send({ data }),
  sendBadRequest: (
    reply: { status: (n: number) => { send: (b: unknown) => unknown } },
    msg: string,
  ) => reply.status(400).send({ error: msg }),
  sendNotFound: (
    reply: { status: (n: number) => { send: (b: unknown) => unknown } },
    msg: string,
  ) => reply.status(404).send({ error: msg }),
  sendInternalError: (
    reply: { status: (n: number) => { send: (b: unknown) => unknown } },
    msg: string,
  ) => reply.status(500).send({ error: msg }),
}));

async function buildApp(authUserId: string | null) {
  const { chatRoutes } = await import("../chat.js");
  const app = Fastify();
  app.addHook("preHandler", async (request) => {
    if (authUserId) {
      (request as unknown as Record<string, unknown>).authUser = {
        id: authUserId,
      };
    }
  });
  await app.register(chatRoutes);
  return app;
}

describe("chat route access control (IDOR fix)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 403 and never builds the AI service when the user lacks access", async () => {
    mockCanAccess.mockResolvedValue(false);
    const app = await buildApp("attacker-user");

    const res = await app.inject({
      method: "POST",
      url: "/api/threat-models/victim-model/ai/chat",
      payload: { message: "leak the context" },
    });

    expect(res.statusCode).toBe(403);
    expect(mockCanAccess).toHaveBeenCalledWith("attacker-user", "victim-model");
    expect(mockGetAIServiceForModel).not.toHaveBeenCalled();
    await app.close();
  });

  it("returns 401 when unauthenticated", async () => {
    const app = await buildApp(null);

    const res = await app.inject({
      method: "POST",
      url: "/api/threat-models/victim-model/ai/chat",
      payload: { message: "hi" },
    });

    expect(res.statusCode).toBe(401);
    expect(mockGetAIServiceForModel).not.toHaveBeenCalled();
    await app.close();
  });

  it("passes the access check, then proceeds (AI service consulted)", async () => {
    mockCanAccess.mockResolvedValue(true);
    mockGetAIServiceForModel.mockResolvedValue(null); // -> 400 AI not configured
    const app = await buildApp("member-user");

    const res = await app.inject({
      method: "POST",
      url: "/api/threat-models/my-model/ai/chat",
      payload: { message: "hi" },
    });

    expect(mockCanAccess).toHaveBeenCalledWith("member-user", "my-model");
    expect(mockGetAIServiceForModel).toHaveBeenCalledWith("my-model");
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it("SSE stream route also enforces access (403 cross-org)", async () => {
    mockCanAccess.mockResolvedValue(false);
    const app = await buildApp("attacker-user");

    const res = await app.inject({
      method: "GET",
      url: "/api/ai/stream/victim-model/chat?message=leak",
    });

    expect(res.statusCode).toBe(403);
    expect(mockCanAccess).toHaveBeenCalledWith("attacker-user", "victim-model");
    await app.close();
  });
});
