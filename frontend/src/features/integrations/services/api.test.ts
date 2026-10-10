/**
 * Integrations API service tests
 *
 * Tests for:
 * - fetchIntegrations: GET correct URL, returns array, returns [] for non-array
 * - fetchIntegration: GET correct URL with integrationId
 * - deleteIntegration: DELETE correct URL
 * - triggerSync: POST with {} to sync endpoint, returns { success, message }
 * - testJiraConnection: POST credentials to jira/test, returns { success }
 * - createJiraIntegration: POST to jira, returns IntegrationDetail
 * - testGitHubConnection: POST {} to github/test, returns { success, message }
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  fetchIntegrations,
  fetchIntegration,
  deleteIntegration,
  triggerSync,
  testJiraConnection,
  createJiraIntegration,
  testGitHubConnection,
} from "./api";

// ---------------------------------------------------------------------------
// Mock api-client
// ---------------------------------------------------------------------------

vi.mock("@/lib/api-client", () => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPut: vi.fn(),
  apiDelete: vi.fn(),
}));

import { apiGet, apiPost, apiDelete } from "@/lib/api-client";

const mockGet = vi.mocked(apiGet);
const mockPost = vi.mocked(apiPost);
const mockDelete = vi.mocked(apiDelete);

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const makeIntegration = (overrides = {}) => ({
  id: "int-1",
  name: "My Jira",
  type: "JIRA" as const,
  status: "ACTIVE" as const,
  organizationId: "org-1",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

const makeIntegrationDetail = (overrides = {}) => ({
  ...makeIntegration(),
  config: { baseUrl: "https://jira.example.com", projectKey: "SEC" },
  mappings: [],
  ...overrides,
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("fetchIntegrations", () => {
  beforeEach(() => vi.clearAllMocks());

  it("fetches integrations for the given org", async () => {
    const integrations = [makeIntegration()];
    mockGet.mockResolvedValue(integrations);

    const result = await fetchIntegrations("org-1");

    expect(result).toEqual(integrations);
    expect(apiGet).toHaveBeenCalledWith(
      "/api/v1/organizations/org-1/integrations",
    );
  });

  it("returns [] when apiGet returns a non-array", async () => {
    mockGet.mockResolvedValue(null as never);

    const result = await fetchIntegrations("org-1");

    expect(result).toEqual([]);
  });
});

describe("fetchIntegration", () => {
  beforeEach(() => vi.clearAllMocks());

  it("fetches a single integration by id", async () => {
    const detail = makeIntegrationDetail();
    mockGet.mockResolvedValue(detail);

    const result = await fetchIntegration("org-1", "int-1");

    expect(result).toEqual(detail);
    expect(apiGet).toHaveBeenCalledWith(
      "/api/v1/organizations/org-1/integrations/int-1",
    );
  });
});

describe("deleteIntegration", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls DELETE on the correct URL", async () => {
    mockDelete.mockResolvedValue(undefined);

    await deleteIntegration("org-1", "int-1");

    expect(apiDelete).toHaveBeenCalledWith(
      "/api/v1/organizations/org-1/integrations/int-1",
    );
  });
});

describe("triggerSync", () => {
  beforeEach(() => vi.clearAllMocks());

  it("posts to sync endpoint and returns success/message", async () => {
    const syncResult = { success: true, message: "Sync started" };
    mockPost.mockResolvedValue(syncResult);

    const result = await triggerSync("org-1", "int-1");

    expect(result).toEqual(syncResult);
    expect(apiPost).toHaveBeenCalledWith(
      "/api/v1/organizations/org-1/integrations/int-1/sync",
      {},
    );
  });
});

describe("testJiraConnection", () => {
  beforeEach(() => vi.clearAllMocks());

  it("posts credentials to jira/test and returns success", async () => {
    const connectionResult = {
      success: true,
      serverInfo: { version: "9.0", serverTitle: "Jira" },
    };
    mockPost.mockResolvedValue(connectionResult);

    const creds = {
      baseUrl: "https://jira.example.com",
      email: "admin@example.com",
      apiToken: "token-abc",
    };
    const result = await testJiraConnection("org-1", creds);

    expect(result).toEqual(connectionResult);
    expect(apiPost).toHaveBeenCalledWith(
      "/api/v1/organizations/org-1/integrations/jira/test",
      creds,
    );
  });
});

describe("createJiraIntegration", () => {
  beforeEach(() => vi.clearAllMocks());

  it("posts to jira endpoint and returns IntegrationDetail", async () => {
    const detail = makeIntegrationDetail();
    mockPost.mockResolvedValue(detail);

    const payload = {
      name: "Jira Prod",
      config: { baseUrl: "https://jira.example.com", projectKey: "SEC" },
      credentials: {
        email: "admin@example.com",
        apiToken: "token-abc",
      },
    };
    const result = await createJiraIntegration("org-1", payload as never);

    expect(result).toEqual(detail);
    expect(apiPost).toHaveBeenCalledWith(
      "/api/v1/organizations/org-1/integrations/jira",
      payload,
    );
  });
});

describe("testGitHubConnection", () => {
  beforeEach(() => vi.clearAllMocks());

  it("posts {} to github/test and returns success + message", async () => {
    const connectionResult = {
      success: true,
      repo: "org/repo",
      message: "Connected",
    };
    mockPost.mockResolvedValue(connectionResult);

    const result = await testGitHubConnection("org-1");

    expect(result).toEqual(connectionResult);
    expect(apiPost).toHaveBeenCalledWith(
      "/api/v1/organizations/org-1/integrations/github/test",
      {},
    );
  });
});
