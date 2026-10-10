/**
 * AI API Tests
 *
 * Tests for AI route endpoints:
 * - AI availability check
 * - Provider health
 * - Vision support
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
import Fastify, { FastifyInstance } from "fastify";
import { aiRoutes } from "../ai.js";

const mockUser = { id: "user-1", email: "test@example.com", name: "Test User" };

const mockPrisma = {
  membership: {
    findFirst: vi.fn(),
  },
  organization: {
    findUnique: vi.fn(),
  },
  threatModel: {
    findUnique: vi.fn(),
  },
};

vi.mock("../../db.js", () => ({
  getPrisma: vi.fn(() => Promise.resolve(mockPrisma)),
}));

// Model-scoped AI routes now authorize the caller against the model. These
// tests exercise the handler bodies, so access is granted; the authorization
// behaviour itself is covered by routes/__tests__/model-route-authorization
// and the per-route access tests.
vi.mock("../threat-models/helpers.js", () => ({
  canAccessThreatModel: vi.fn(() => Promise.resolve(true)),
}));

// Mock AI helpers
const mockAIService = {
  isAvailable: vi.fn(),
  chat: vi.fn(),
  complete: vi.fn(),
  suggestThreats: vi.fn(),
};

const mockProviderManager = {
  checkAllHealth: vi.fn(),
};

vi.mock("../ai/helpers.js", () => ({
  getAIServiceForModel: vi.fn(),
  getPrisma: vi.fn(() => Promise.resolve(mockPrisma)),
  AIProviderManager: vi.fn(() => mockProviderManager),
  AISettings: {},
  DEFAULT_AI_SETTINGS: { enabled: false, provider: "none" },
  sendSuccess: vi.fn((reply: any, data: any) =>
    reply.status(200).send({ data }),
  ),
  sendNotFound: vi.fn((reply: any, resource: string) =>
    reply.status(404).send({ error: `${resource} not found` }),
  ),
  sendBadRequest: vi.fn((reply: any, msg: string) =>
    reply.status(400).send({ error: msg }),
  ),
  sendInternalError: vi.fn((reply: any, msg: string) =>
    reply.status(500).send({ error: msg }),
  ),
}));

import { getAIServiceForModel } from "../ai/helpers.js";

const mockGetAIService = getAIServiceForModel as ReturnType<typeof vi.fn>;

describe("AI API", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify();
    app.addHook("preHandler", async (request) => {
      request.authUser = mockUser;
    });
    await aiRoutes(app, {});
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/threat-models/:modelId/ai/available", () => {
    it("returns available when AI is configured", async () => {
      mockGetAIService.mockResolvedValue(mockAIService);
      mockAIService.isAvailable.mockResolvedValue(true);

      const response = await app.inject({
        method: "GET",
        url: "/api/threat-models/tm-1/ai/available",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.available).toBe(true);
    });

    it("returns unavailable when AI not configured", async () => {
      mockGetAIService.mockResolvedValue(null);

      const response = await app.inject({
        method: "GET",
        url: "/api/threat-models/tm-1/ai/available",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.available).toBe(false);
    });

    it("returns unavailable when provider not reachable", async () => {
      mockGetAIService.mockResolvedValue(mockAIService);
      mockAIService.isAvailable.mockResolvedValue(false);

      const response = await app.inject({
        method: "GET",
        url: "/api/threat-models/tm-1/ai/available",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.available).toBe(false);
      expect(body.reason).toBe("Provider not reachable");
    });
  });

  // Note: /api/ai/providers/health and /api/ai/vision-support routes
  // depend on complex provider manager wiring that's hard to mock at route level.
  // These are better tested via integration tests with a real server.
});
