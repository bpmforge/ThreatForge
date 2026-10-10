/**
 * Jira and GitHub base URLs are tenant-supplied and the server calls them
 * with stored credentials: they must be public hosts, redirects are not
 * followed, and the Jira connection test returns only identity fields.
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
  integration: { findFirst: vi.fn(), update: vi.fn(), upsert: vi.fn() },
};
const fetchMock = vi.fn();

vi.mock("../../../../db.js", () => ({
  getPrisma: vi.fn(() => Promise.resolve(mockPrisma)),
}));
vi.mock("../../helpers.js", () => ({
  getAuthUser: () => ({ id: "u1", email: "u1@x.test" }),
  checkOrganizationAccess: vi.fn(() => Promise.resolve({ role: "OWNER" })),
  logAudit: vi.fn(),
}));
vi.mock("../../../../services/encryption/encryption-service.js", () => ({
  // Stored config/credentials are plain JSON in these tests
  decryptValue: (v: string) => v,
  encryptValue: (v: string) => v,
}));

const { jiraRoutes } = await import("../jira/index.js");
const { githubRoutes } = await import("../github/index.js");

const PUBLIC_JIRA = "http://93.184.216.34";
const jiraCreds = { type: "api_token", email: "a@b.test", apiToken: "t" };

function storedIntegration(config: Record<string, unknown>, creds: unknown) {
  return {
    id: "int-1",
    config: JSON.stringify(config),
    credentials: JSON.stringify(creds),
  };
}

describe("Jira/GitHub outbound URLs", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    vi.stubGlobal("fetch", fetchMock);
    app = Fastify();
    await app.register(jiraRoutes, { prefix: "/:orgId/integrations/jira" });
    await app.register(githubRoutes, { prefix: "/:orgId/integrations/github" });
    await app.ready();
  });

  afterAll(async () => {
    vi.unstubAllGlobals();
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.integration.update.mockResolvedValue({});
    mockPrisma.integration.upsert.mockResolvedValue({
      id: "int-1",
      status: "ACTIVE",
      name: "x",
    });
  });

  it("Jira /configure rejects a private baseUrl without calling it", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/org-a/integrations/jira/configure",
      payload: {
        baseUrl: "http://127.0.0.1:8080",
        projectKey: "SEC",
        credentials: jiraCreds,
      },
    });

    expect(res.statusCode).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(mockPrisma.integration.upsert).not.toHaveBeenCalled();
  });

  it("Jira /test refuses a stored private baseUrl", async () => {
    mockPrisma.integration.findFirst.mockResolvedValue(
      storedIntegration(
        { baseUrl: "http://10.0.0.5", projectKey: "SEC" },
        jiraCreds,
      ),
    );

    const res = await app.inject({
      method: "POST",
      url: "/org-a/integrations/jira/test",
    });

    expect(res.statusCode).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("Jira /test returns only identity fields and does not follow redirects", async () => {
    mockPrisma.integration.findFirst.mockResolvedValue(
      storedIntegration({ baseUrl: PUBLIC_JIRA, projectKey: "SEC" }, jiraCreds),
    );
    fetchMock.mockResolvedValue(
      Response.json({
        accountId: "acc-1",
        displayName: "Jira Bot",
        emailAddress: "bot@corp.test",
        self: "https://corp.atlassian.net/rest/api/3/user?accountId=acc-1",
        groups: { items: [{ name: "jira-admins" }] },
      }),
    );

    const res = await app.inject({
      method: "POST",
      url: "/org-a/integrations/jira/test",
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().user).toEqual({
      accountId: "acc-1",
      displayName: "Jira Bot",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      `${PUBLIC_JIRA}/rest/api/3/myself`,
      expect.objectContaining({ redirect: "manual" }),
    );
  });

  it("GitHub /configure rejects a private baseUrl without calling it", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/org-a/integrations/github/configure",
      payload: {
        owner: "o",
        repo: "r",
        baseUrl: "http://192.168.1.10/api/v3",
        credentials: { type: "pat", token: "ghp_x" },
      },
    });

    expect(res.statusCode).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(mockPrisma.integration.upsert).not.toHaveBeenCalled();
  });

  it("GitHub requests to a public host do not follow redirects", async () => {
    mockPrisma.integration.findFirst.mockResolvedValue(
      storedIntegration(
        { owner: "o", repo: "r", baseUrl: "http://93.184.216.34" },
        { type: "pat", token: "ghp_x" },
      ),
    );
    fetchMock.mockResolvedValue(
      Response.json({ full_name: "o/r", private: true }),
    );

    const res = await app.inject({
      method: "POST",
      url: "/org-a/integrations/github/test",
    });

    expect(res.statusCode).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://93.184.216.34/repos/o/r",
      expect.objectContaining({ redirect: "manual" }),
    );
  });
});
