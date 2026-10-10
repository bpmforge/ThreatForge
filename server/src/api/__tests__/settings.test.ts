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
import { settingsRoutes } from "../settings.js";
import { clearPrivateHostPolicyCache } from "../../services/ai/private-host-policy.js";

// Mock user for testing
const mockUser = {
  id: "user-123",
  email: "test@example.com",
  name: "Test User",
};

// Mock the database module
const mockPrisma = {
  membership: {
    findFirst: vi.fn(),
    // requireOrgRole (AI settings writes need OWNER/ADMIN)
    findUnique: vi.fn(),
  },
  organization: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  threatModel: {
    findUnique: vi.fn(),
  },
  user: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  // AI private-host allowlist (super-admin); empty unless a test sets it.
  systemSettings: {
    findFirst: vi.fn(),
  },
};

// Hostnames resolve through this table, IP literals to themselves; no network.
vi.mock("node:dns/promises", async () => {
  const { isIP } = await import("node:net");
  const table: Record<string, string[]> = {
    "api.anthropic.com": ["160.79.104.10"],
    "other-host.example": ["93.184.216.34"],
    "attacker.example": ["93.184.216.34"],
    localhost: ["127.0.0.1"],
  };
  return {
    lookup: vi.fn(async (host: string) => {
      if (isIP(host)) return [{ address: host, family: isIP(host) }];
      const hit = table[host];
      if (!hit)
        throw Object.assign(new Error("ENOTFOUND"), { code: "ENOTFOUND" });
      return hit.map((address) => ({ address, family: isIP(address) }));
    }),
  };
});

vi.mock("../../db.js", () => ({
  getPrisma: vi.fn(() => Promise.resolve(mockPrisma)),
}));

// Mock encryption service
vi.mock("../../services/encryption/index.js", () => ({
  encryptValue: vi.fn((val: string) => `encrypted:${val}`),
  decryptValue: vi.fn((val: string) => val.replace("encrypted:", "")),
  getKeyConfig: vi.fn(() => Promise.resolve(null)),
  getBYOKConfig: vi.fn(() =>
    Promise.resolve({ enabled: false, activeKeyVersion: null }),
  ),
}));

const orgId = "org-123";
const modelId = "model-456";

const defaultAiSettings = {
  enabled: false,
  provider: "none",
  features: {
    autoSuggestThreats: false,
    autoSuggestMitigations: false,
    enableChat: false,
    agentChainV2: true,
  },
  guardrails: {
    monthlyBudget: 0,
    anonymizeData: false,
    logInteractions: true,
  },
};

const defaultUserPreferences = {
  theme: "system",
  ai: {
    suggestionStyle: "detailed",
    showRationale: true,
    autoDismiss: false,
  },
  canvas: {
    showGrid: true,
    snapToGrid: true,
    showMinimap: true,
  },
  tutorials: {
    strideTutorialCompleted: false,
  },
};

/**
 * Model-scoped routes hit threatModel.findUnique twice: once for the access
 * check, once for the org payload. Queue both with the given stored settings.
 */
function mockModelAccessThen(aiSettings: object) {
  mockPrisma.threatModel.findUnique
    .mockResolvedValueOnce({
      id: modelId,
      project: { organization: { memberships: [{ userId: mockUser.id }] } },
    })
    .mockResolvedValueOnce({
      id: modelId,
      project: {
        organization: { id: orgId, aiSettings: JSON.stringify(aiSettings) },
      },
    });
}

/** The aiSettings blob actually handed to prisma — what lands on disk. */
function storedSettings() {
  const calls = mockPrisma.organization.update.mock.calls;
  expect(calls.length).toBeGreaterThan(0);
  return JSON.parse(calls[calls.length - 1][0].data.aiSettings);
}

describe("Settings API", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify();

    // Inject authUser for all requests
    app.addHook("preHandler", async (request) => {
      request.authUser = mockUser;
    });

    await settingsRoutes(app, {});
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    clearPrivateHostPolicyCache();
    mockPrisma.systemSettings.findFirst.mockResolvedValue(null);
    mockPrisma.membership.findUnique.mockResolvedValue({
      role: "OWNER",
      status: "ACTIVE",
    });
  });

  // ==========================================================================
  // GET /api/organizations/:orgId/ai-settings
  // ==========================================================================
  describe("GET /api/organizations/:orgId/ai-settings", () => {
    it("returns default AI settings when none configured", async () => {
      mockPrisma.membership.findFirst.mockResolvedValue({
        id: "mem-1",
        userId: mockUser.id,
        organizationId: orgId,
      });
      mockPrisma.organization.findUnique.mockResolvedValue({
        id: orgId,
        aiSettings: null,
      });

      const res = await app.inject({
        method: "GET",
        url: `/api/organizations/${orgId}/ai-settings`,
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data.enabled).toBe(false);
      expect(body.data.provider).toBe("none");
      expect(body.data.features).toBeDefined();
    });

    it("returns stored AI settings with masked API key", async () => {
      const stored = {
        ...defaultAiSettings,
        enabled: true,
        provider: "openai",
        apiKey: "sk-1234567890abcdef",
      };
      mockPrisma.membership.findFirst.mockResolvedValue({ id: "mem-1" });
      mockPrisma.organization.findUnique.mockResolvedValue({
        id: orgId,
        aiSettings: JSON.stringify(stored),
      });

      const res = await app.inject({
        method: "GET",
        url: `/api/organizations/${orgId}/ai-settings`,
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data.apiKey).toContain("••••");
      expect(body.data.apiKey).not.toContain("abcdef");
    });

    it("returns default AI settings for an untouched org whose aiSettings column is the schema default '{}'", async () => {
      mockPrisma.membership.findFirst.mockResolvedValue({ id: "mem-1" });
      mockPrisma.organization.findUnique.mockResolvedValue({
        id: orgId,
        aiSettings: "{}",
      });

      const res = await app.inject({
        method: "GET",
        url: `/api/organizations/${orgId}/ai-settings`,
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data.enabled).toBe(false);
      expect(body.data.provider).toBe("none");
      expect(body.data.features).toEqual(defaultAiSettings.features);
      expect(body.data.guardrails).toEqual(defaultAiSettings.guardrails);
    });

    it("returns 404 when user is not a member of the organization", async () => {
      mockPrisma.membership.findFirst.mockResolvedValue(null);

      const res = await app.inject({
        method: "GET",
        url: `/api/organizations/${orgId}/ai-settings`,
      });

      expect(res.statusCode).toBe(404);
    });

    it("returns 404 when organization does not exist", async () => {
      mockPrisma.membership.findFirst.mockResolvedValue({ id: "mem-1" });
      mockPrisma.organization.findUnique.mockResolvedValue(null);

      const res = await app.inject({
        method: "GET",
        url: `/api/organizations/${orgId}/ai-settings`,
      });

      expect(res.statusCode).toBe(404);
    });
  });

  // ==========================================================================
  // PATCH /api/organizations/:orgId/ai-settings
  // ==========================================================================
  describe("PATCH /api/organizations/:orgId/ai-settings", () => {
    it("updates AI settings successfully", async () => {
      mockPrisma.membership.findFirst.mockResolvedValue({ id: "mem-1" });
      mockPrisma.organization.findUnique.mockResolvedValue({
        id: orgId,
        aiSettings: JSON.stringify(defaultAiSettings),
      });
      mockPrisma.organization.update.mockResolvedValue({ id: orgId });

      const res = await app.inject({
        method: "PATCH",
        url: `/api/organizations/${orgId}/ai-settings`,
        payload: { enabled: true, provider: "claude" },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data.enabled).toBe(true);
      expect(body.data.provider).toBe("claude");
      expect(mockPrisma.organization.update).toHaveBeenCalledTimes(1);
    });

    it("refuses a VIEWER changing AI settings", async () => {
      mockPrisma.membership.findFirst.mockResolvedValue({ id: "mem-1" });
      mockPrisma.membership.findUnique.mockResolvedValue({
        role: "VIEWER",
        status: "ACTIVE",
      });

      const res = await app.inject({
        method: "PATCH",
        url: `/api/organizations/${orgId}/ai-settings`,
        payload: { baseUrl: "https://attacker.example" },
      });

      expect(res.statusCode).toBe(403);
      expect(mockPrisma.organization.update).not.toHaveBeenCalled();
    });

    it("rejects a cloud metadata base URL", async () => {
      mockPrisma.membership.findFirst.mockResolvedValue({ id: "mem-1" });
      mockPrisma.organization.findUnique.mockResolvedValue({
        id: orgId,
        aiSettings: JSON.stringify(defaultAiSettings),
      });

      const res = await app.inject({
        method: "PATCH",
        url: `/api/organizations/${orgId}/ai-settings`,
        payload: { baseUrl: "http://169.254.169.254/latest" },
      });

      expect(res.statusCode).toBe(400);
      expect(mockPrisma.organization.update).not.toHaveBeenCalled();
    });

    it("rejects a private-network base URL that is not allowlisted", async () => {
      mockPrisma.membership.findFirst.mockResolvedValue({ id: "mem-1" });
      mockPrisma.organization.findUnique.mockResolvedValue({
        id: orgId,
        aiSettings: JSON.stringify(defaultAiSettings),
      });

      for (const baseUrl of [
        "http://127.0.0.1:6379",
        "http://localhost:8000/v1",
        "http://10.0.0.5:9200",
      ]) {
        const res = await app.inject({
          method: "PATCH",
          url: `/api/organizations/${orgId}/ai-settings`,
          payload: { provider: "openai", baseUrl },
        });
        expect(res.statusCode, baseUrl).toBe(400);
        expect(res.json().message ?? res.json().error).toMatch(/allowlist/);
      }
      expect(mockPrisma.organization.update).not.toHaveBeenCalled();
    });

    it("accepts a private-network base URL a super-admin allowlisted", async () => {
      mockPrisma.systemSettings.findFirst.mockResolvedValue({
        aiPrivateHostAllowlist: JSON.stringify(["192.168.50.0/24"]),
        aiAllowAllPrivateHosts: false,
      });
      mockPrisma.membership.findFirst.mockResolvedValue({ id: "mem-1" });
      mockPrisma.organization.findUnique.mockResolvedValue({
        id: orgId,
        aiSettings: JSON.stringify(defaultAiSettings),
      });
      mockPrisma.organization.update.mockResolvedValue({ id: orgId });

      const res = await app.inject({
        method: "PATCH",
        url: `/api/organizations/${orgId}/ai-settings`,
        payload: {
          provider: "lmstudio",
          baseUrl: "http://192.168.50.20:1234/v1",
        },
      });

      expect(res.statusCode).toBe(200);
      expect(storedSettings().baseUrl).toBe("http://192.168.50.20:1234/v1");
    });

    it("drops the stored key when the base URL changes without a new key", async () => {
      mockPrisma.membership.findFirst.mockResolvedValue({ id: "mem-1" });
      mockPrisma.organization.findUnique.mockResolvedValue({
        id: orgId,
        aiSettings: JSON.stringify({
          ...defaultAiSettings,
          provider: "claude",
          baseUrl: "https://api.anthropic.com",
          encryptedApiKey: "enc:secret",
        }),
      });
      mockPrisma.organization.update.mockResolvedValue({ id: orgId });

      const res = await app.inject({
        method: "PATCH",
        url: `/api/organizations/${orgId}/ai-settings`,
        payload: { baseUrl: "https://other-host.example" },
      });

      expect(res.statusCode).toBe(200);
      const stored = storedSettings();
      expect(stored.baseUrl).toBe("https://other-host.example");
      expect(stored.encryptedApiKey).toBeUndefined();
      expect(stored.apiKey).toBeUndefined();
    });

    it("keeps the stored key when the form saves back what GET returned", async () => {
      const stored = {
        ...defaultAiSettings,
        provider: "claude",
        baseUrl: "https://api.anthropic.com",
        encryptedApiKey: "enc:secret",
      };
      mockPrisma.membership.findFirst.mockResolvedValue({ id: "mem-1" });
      mockPrisma.organization.findUnique.mockResolvedValue({
        id: orgId,
        aiSettings: JSON.stringify(stored),
      });
      mockPrisma.organization.update.mockResolvedValue({ id: orgId });

      // The settings panel PATCHes its whole draft: same provider and URL,
      // masked key.
      const res = await app.inject({
        method: "PATCH",
        url: `/api/organizations/${orgId}/ai-settings`,
        payload: {
          ...defaultAiSettings,
          provider: "claude",
          baseUrl: "https://api.anthropic.com",
          apiKey: "sk-ant-a••••••••",
          enabled: true,
        },
      });

      expect(res.statusCode).toBe(200);
      expect(storedSettings().encryptedApiKey).toBe("enc:secret");
    });

    it("returns 404 for non-member (acts as 403)", async () => {
      mockPrisma.membership.findFirst.mockResolvedValue(null);

      const res = await app.inject({
        method: "PATCH",
        url: `/api/organizations/${orgId}/ai-settings`,
        payload: { enabled: true },
      });

      expect(res.statusCode).toBe(404);
    });

    it("round-trips the agent-chain-v2 flag (features.agentChainV2)", async () => {
      // Default ON (1.0.0); an org opts out explicitly
      mockPrisma.membership.findFirst.mockResolvedValue({ id: "mem-1" });
      mockPrisma.organization.findUnique.mockResolvedValue({
        id: orgId,
        aiSettings: JSON.stringify(defaultAiSettings),
      });
      mockPrisma.organization.update.mockResolvedValue({ id: orgId });

      // Disable via PATCH (merges into features, preserving other toggles)
      const patchRes = await app.inject({
        method: "PATCH",
        url: `/api/organizations/${orgId}/ai-settings`,
        payload: { features: { agentChainV2: false } },
      });
      expect(patchRes.statusCode).toBe(200);
      expect(patchRes.json().data.features.agentChainV2).toBe(false);
      expect(patchRes.json().data.features.enableChat).toBe(false);

      // Persisted blob carries the flag
      const updateCall = mockPrisma.organization.update.mock.calls[0][0];
      const saved = JSON.parse(updateCall.data.aiSettings);
      expect(saved.features.agentChainV2).toBe(false);

      // GET returns it back
      mockPrisma.organization.findUnique.mockResolvedValue({
        id: orgId,
        aiSettings: updateCall.data.aiSettings,
      });
      const getRes = await app.inject({
        method: "GET",
        url: `/api/organizations/${orgId}/ai-settings`,
      });
      expect(getRes.statusCode).toBe(200);
      expect(getRes.json().data.features.agentChainV2).toBe(false);
    });

    it("does not overwrite API key when masked value is sent back", async () => {
      const stored = { ...defaultAiSettings, apiKey: "sk-real-key-12345" };
      mockPrisma.membership.findFirst.mockResolvedValue({ id: "mem-1" });
      mockPrisma.organization.findUnique.mockResolvedValue({
        id: orgId,
        aiSettings: JSON.stringify(stored),
      });
      mockPrisma.organization.update.mockResolvedValue({ id: orgId });

      const res = await app.inject({
        method: "PATCH",
        url: `/api/organizations/${orgId}/ai-settings`,
        payload: { apiKey: "sk-real-••••••••", enabled: true },
      });

      expect(res.statusCode).toBe(200);
      // The original key should be preserved - the update call should not contain the masked value
      const updateCall = mockPrisma.organization.update.mock.calls[0][0];
      const savedSettings = JSON.parse(updateCall.data.aiSettings);
      expect(savedSettings.apiKey).toBe("sk-real-key-12345");
    });
  });

  // ==========================================================================
  // GET /api/threat-models/:modelId/ai-settings
  // ==========================================================================
  describe("GET /api/threat-models/:modelId/ai-settings", () => {
    it("returns AI settings for a threat model via its organization", async () => {
      mockPrisma.threatModel.findUnique
        .mockResolvedValueOnce({
          id: modelId,
          project: {
            organization: {
              memberships: [{ userId: mockUser.id }],
            },
          },
        })
        .mockResolvedValueOnce({
          id: modelId,
          project: {
            organization: {
              id: orgId,
              aiSettings: JSON.stringify(defaultAiSettings),
            },
          },
        });

      const res = await app.inject({
        method: "GET",
        url: `/api/threat-models/${modelId}/ai-settings`,
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().data.provider).toBe("none");
    });

    it("returns default AI settings for an untouched org whose aiSettings column is the schema default '{}'", async () => {
      mockModelAccessThen({});

      const res = await app.inject({
        method: "GET",
        url: `/api/threat-models/${modelId}/ai-settings`,
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data.enabled).toBe(false);
      expect(body.data.provider).toBe("none");
      expect(body.data.features).toEqual(defaultAiSettings.features);
      expect(body.data.guardrails).toEqual(defaultAiSettings.guardrails);
    });

    it("masks the key from its ciphertext and never returns encryptedApiKey", async () => {
      mockModelAccessThen({
        ...defaultAiSettings,
        provider: "openai",
        encryptedApiKey: "encrypted:sk-real-secret-key",
      });

      const res = await app.inject({
        method: "GET",
        url: `/api/threat-models/${modelId}/ai-settings`,
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().data.encryptedApiKey).toBeUndefined();
      expect(res.json().data.apiKey).toBe("sk-real-••••••••");
    });

    it("returns 404 when model not found or user has no access", async () => {
      mockPrisma.threatModel.findUnique.mockResolvedValue(null);

      const res = await app.inject({
        method: "GET",
        url: `/api/threat-models/nonexistent/ai-settings`,
      });

      expect(res.statusCode).toBe(404);
    });
  });

  // ==========================================================================
  // PATCH /api/threat-models/:modelId/ai-settings
  // ==========================================================================
  describe("PATCH /api/threat-models/:modelId/ai-settings", () => {
    it("updates AI settings via threat model", async () => {
      mockPrisma.threatModel.findUnique
        .mockResolvedValueOnce({
          id: modelId,
          project: {
            organization: {
              memberships: [{ userId: mockUser.id }],
            },
          },
        })
        .mockResolvedValueOnce({
          id: modelId,
          project: {
            organization: {
              id: orgId,
              aiSettings: JSON.stringify(defaultAiSettings),
            },
          },
        });
      mockPrisma.organization.update.mockResolvedValue({ id: orgId });

      const res = await app.inject({
        method: "PATCH",
        url: `/api/threat-models/${modelId}/ai-settings`,
        payload: { enabled: true, provider: "openai" },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data.enabled).toBe(true);
      expect(body.data.provider).toBe("openai");
    });

    it("rejects a loopback base URL that is not allowlisted", async () => {
      mockModelAccessThen(defaultAiSettings);

      const res = await app.inject({
        method: "PATCH",
        url: `/api/threat-models/${modelId}/ai-settings`,
        payload: { provider: "ollama", baseUrl: "http://127.0.0.1:11434" },
      });

      expect(res.statusCode).toBe(400);
      expect(mockPrisma.organization.update).not.toHaveBeenCalled();
    });

    it("encrypts a supplied key and stores no plaintext", async () => {
      mockModelAccessThen(defaultAiSettings);
      mockPrisma.organization.update.mockResolvedValue({ id: orgId });

      const res = await app.inject({
        method: "PATCH",
        url: `/api/threat-models/${modelId}/ai-settings`,
        payload: { provider: "openai", apiKey: "sk-real-secret-key" },
      });

      expect(res.statusCode).toBe(200);
      const stored = storedSettings();
      expect(stored.apiKey).toBeUndefined();
      expect(stored.encryptedApiKey).toBe("encrypted:sk-real-secret-key");
      expect(res.json().data.encryptedApiKey).toBeUndefined();
      expect(res.json().data.apiKey).toBe("sk-real-••••••••");
    });

    it("migrates a legacy plaintext key even when the patch supplies none", async () => {
      mockModelAccessThen({
        ...defaultAiSettings,
        provider: "openai",
        apiKey: "sk-legacy-plaintext",
      });
      mockPrisma.organization.update.mockResolvedValue({ id: orgId });

      const res = await app.inject({
        method: "PATCH",
        url: `/api/threat-models/${modelId}/ai-settings`,
        payload: { enabled: true },
      });

      expect(res.statusCode).toBe(200);
      const stored = storedSettings();
      expect(stored.apiKey).toBeUndefined();
      expect(stored.encryptedApiKey).toBe("encrypted:sk-legacy-plaintext");
    });

    it("does not overwrite the stored key when the mask is sent back", async () => {
      mockModelAccessThen({
        ...defaultAiSettings,
        provider: "openai",
        encryptedApiKey: "encrypted:sk-real-secret-key",
      });
      mockPrisma.organization.update.mockResolvedValue({ id: orgId });

      const res = await app.inject({
        method: "PATCH",
        url: `/api/threat-models/${modelId}/ai-settings`,
        payload: { enabled: true, apiKey: "sk-real-••••••••" },
      });

      expect(res.statusCode).toBe(200);
      const stored = storedSettings();
      expect(stored.apiKey).toBeUndefined();
      expect(stored.encryptedApiKey).toBe("encrypted:sk-real-secret-key");
    });

    it("returns 404 when model not found", async () => {
      mockPrisma.threatModel.findUnique.mockResolvedValue(null);

      const res = await app.inject({
        method: "PATCH",
        url: `/api/threat-models/nonexistent/ai-settings`,
        payload: { enabled: true },
      });

      expect(res.statusCode).toBe(404);
    });
  });

  // ==========================================================================
  // GET /api/threat-models/:modelId/ai-status
  // ==========================================================================
  describe("GET /api/threat-models/:modelId/ai-status", () => {
    it("reports configured for an org holding only an encrypted key", async () => {
      mockModelAccessThen({
        ...defaultAiSettings,
        enabled: true,
        provider: "openai",
        encryptedApiKey: "encrypted:sk-real-secret-key",
      });

      const res = await app.inject({
        method: "GET",
        url: `/api/threat-models/${modelId}/ai-status`,
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().data.configured).toBe(true);
    });
  });

  // ==========================================================================
  // GET /api/users/:userId/preferences
  // ==========================================================================
  describe("GET /api/users/:userId/preferences", () => {
    it("returns default preferences when none stored", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: mockUser.id,
        preferences: null,
      });

      const res = await app.inject({
        method: "GET",
        url: `/api/users/${mockUser.id}/preferences`,
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data.theme).toBe("system");
      expect(body.data.ai.suggestionStyle).toBe("detailed");
      expect(body.data.canvas.showGrid).toBe(true);
    });

    it("returns stored preferences", async () => {
      const prefs = { ...defaultUserPreferences, theme: "dark" };
      mockPrisma.user.findUnique.mockResolvedValue({
        id: mockUser.id,
        preferences: JSON.stringify(prefs),
      });

      const res = await app.inject({
        method: "GET",
        url: `/api/users/${mockUser.id}/preferences`,
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().data.theme).toBe("dark");
    });

    it("returns 404 when requesting another users preferences", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/users/other-user-999/preferences",
      });

      expect(res.statusCode).toBe(404);
    });

    it("returns 404 when user does not exist", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const res = await app.inject({
        method: "GET",
        url: `/api/users/${mockUser.id}/preferences`,
      });

      expect(res.statusCode).toBe(404);
    });
  });

  // ==========================================================================
  // PATCH /api/users/:userId/preferences
  // ==========================================================================
  describe("PATCH /api/users/:userId/preferences", () => {
    it("updates user preferences successfully", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: mockUser.id,
        preferences: JSON.stringify(defaultUserPreferences),
      });
      mockPrisma.user.update.mockResolvedValue({ id: mockUser.id });

      const res = await app.inject({
        method: "PATCH",
        url: `/api/users/${mockUser.id}/preferences`,
        payload: { theme: "dark" },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data.theme).toBe("dark");
      // Other fields should be preserved
      expect(body.data.canvas.showGrid).toBe(true);
      expect(mockPrisma.user.update).toHaveBeenCalledTimes(1);
    });

    it("merges nested ai preferences", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: mockUser.id,
        preferences: JSON.stringify(defaultUserPreferences),
      });
      mockPrisma.user.update.mockResolvedValue({ id: mockUser.id });

      const res = await app.inject({
        method: "PATCH",
        url: `/api/users/${mockUser.id}/preferences`,
        payload: { ai: { suggestionStyle: "brief" } },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data.ai.suggestionStyle).toBe("brief");
      // Other ai fields should be preserved
      expect(body.data.ai.showRationale).toBe(true);
    });

    it("merges nested canvas preferences", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: mockUser.id,
        preferences: JSON.stringify(defaultUserPreferences),
      });
      mockPrisma.user.update.mockResolvedValue({ id: mockUser.id });

      const res = await app.inject({
        method: "PATCH",
        url: `/api/users/${mockUser.id}/preferences`,
        payload: { canvas: { showMinimap: false } },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data.canvas.showMinimap).toBe(false);
      expect(body.data.canvas.showGrid).toBe(true);
    });

    it("returns 404 when updating another users preferences", async () => {
      const res = await app.inject({
        method: "PATCH",
        url: "/api/users/other-user-999/preferences",
        payload: { theme: "dark" },
      });

      expect(res.statusCode).toBe(404);
    });
  });
});
