/**
 * useIntegrations Hook Tests
 *
 * Tests for:
 * - useIntegrations: fetches list, disabled when orgId is null
 * - useIntegration: fetches single, disabled when ids are null
 * - useDeleteIntegration: mutation, invalidates list cache
 * - useTriggerSync: mutation, invalidates sync-logs and integration cache
 * - useCreateJiraIntegration: mutation, invalidates list cache
 * - useTestJiraConnection: mutation, no cache invalidation
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import {
  useIntegrations,
  useIntegration,
  useDeleteIntegration,
  useTriggerSync,
  useCreateJiraIntegration,
  useTestJiraConnection,
} from "./useIntegrations";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("../services/api", () => ({
  fetchIntegrations: vi.fn(),
  fetchIntegration: vi.fn(),
  fetchIntegrationTypes: vi.fn(),
  fetchMappings: vi.fn(),
  fetchSyncLogs: vi.fn(),
  deleteIntegration: vi.fn(),
  triggerSync: vi.fn(),
  testJiraConnection: vi.fn(),
  fetchJiraProjects: vi.fn(),
  fetchJiraIssueTypes: vi.fn(),
  createJiraIntegration: vi.fn(),
  updateJiraIntegration: vi.fn(),
  createJiraIssue: vi.fn(),
  triggerJiraBidirectionalSync: vi.fn(),
  getJiraIssueStatus: vi.fn(),
  testGitHubConnection: vi.fn(),
  createGitHubIntegration: vi.fn(),
  createGitHubIssue: vi.fn(),
  triggerGitHubBidirectionalSync: vi.fn(),
}));

import * as api from "../services/api";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

function wrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client }, children);
  };
}

const makeIntegration = (overrides = {}) => ({
  id: "int-1",
  name: "JIRA Integration",
  type: "JIRA",
  status: "ACTIVE",
  orgId: "org-1",
  ...overrides,
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useIntegrations", () => {
  let client: QueryClient;
  beforeEach(() => {
    client = makeClient();
    vi.clearAllMocks();
  });

  it("fetches integrations for the org", async () => {
    const integrations = [makeIntegration()];
    vi.mocked(api.fetchIntegrations).mockResolvedValue(integrations as never);

    const { result } = renderHook(() => useIntegrations("org-1"), {
      wrapper: wrapper(client),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(integrations);
    expect(api.fetchIntegrations).toHaveBeenCalledWith("org-1");
  });

  it("does not fetch when orgId is null", () => {
    renderHook(() => useIntegrations(null), { wrapper: wrapper(client) });
    expect(api.fetchIntegrations).not.toHaveBeenCalled();
  });

  it("exposes error state on failure", async () => {
    vi.mocked(api.fetchIntegrations).mockRejectedValue(
      new Error("Network error"),
    );

    const { result } = renderHook(() => useIntegrations("org-1"), {
      wrapper: wrapper(client),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe("useIntegration", () => {
  let client: QueryClient;
  beforeEach(() => {
    client = makeClient();
    vi.clearAllMocks();
  });

  it("fetches single integration by id", async () => {
    const integration = makeIntegration({ config: {} });
    vi.mocked(api.fetchIntegration).mockResolvedValue(integration as never);

    const { result } = renderHook(() => useIntegration("org-1", "int-1"), {
      wrapper: wrapper(client),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.fetchIntegration).toHaveBeenCalledWith("org-1", "int-1");
  });

  it("does not fetch when integrationId is null", () => {
    renderHook(() => useIntegration("org-1", null), {
      wrapper: wrapper(client),
    });
    expect(api.fetchIntegration).not.toHaveBeenCalled();
  });
});

describe("useDeleteIntegration", () => {
  let client: QueryClient;
  beforeEach(() => {
    client = makeClient();
    vi.clearAllMocks();
  });

  it("calls deleteIntegration and invalidates list", async () => {
    vi.mocked(api.deleteIntegration).mockResolvedValue(undefined);
    const invalidate = vi.spyOn(client, "invalidateQueries");

    const { result } = renderHook(() => useDeleteIntegration("org-1"), {
      wrapper: wrapper(client),
    });

    result.current.mutate("int-1");
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.deleteIntegration).toHaveBeenCalledWith("org-1", "int-1");
    expect(invalidate).toHaveBeenCalled();
  });
});

describe("useTriggerSync", () => {
  let client: QueryClient;
  beforeEach(() => {
    client = makeClient();
    vi.clearAllMocks();
  });

  it("calls triggerSync and invalidates sync-logs", async () => {
    vi.mocked(api.triggerSync).mockResolvedValue({
      success: true,
      message: "Synced",
    });
    const invalidate = vi.spyOn(client, "invalidateQueries");

    const { result } = renderHook(() => useTriggerSync("org-1", "int-1"), {
      wrapper: wrapper(client),
    });

    result.current.mutate();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.triggerSync).toHaveBeenCalledWith("org-1", "int-1");
    expect(invalidate).toHaveBeenCalled();
  });
});

describe("useTestJiraConnection", () => {
  let client: QueryClient;
  beforeEach(() => {
    client = makeClient();
    vi.clearAllMocks();
  });

  it("calls testJiraConnection with credentials", async () => {
    vi.mocked(api.testJiraConnection).mockResolvedValue({ success: true });
    const creds = {
      baseUrl: "https://acme.atlassian.net",
      email: "a@b.com",
      apiToken: "tok",
    };

    const { result } = renderHook(() => useTestJiraConnection("org-1"), {
      wrapper: wrapper(client),
    });

    result.current.mutate(creds);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.testJiraConnection).toHaveBeenCalledWith("org-1", creds);
  });
});

describe("useCreateJiraIntegration", () => {
  let client: QueryClient;
  beforeEach(() => {
    client = makeClient();
    vi.clearAllMocks();
  });

  it("calls createJiraIntegration and invalidates list", async () => {
    const integration = makeIntegration({ config: {} });
    vi.mocked(api.createJiraIntegration).mockResolvedValue(
      integration as never,
    );
    const invalidate = vi.spyOn(client, "invalidateQueries");

    const { result } = renderHook(() => useCreateJiraIntegration("org-1"), {
      wrapper: wrapper(client),
    });

    result.current.mutate({
      name: "JIRA",
      config: {
        baseUrl: "https://x.atlassian.net",
        projectKey: "PROJ",
        syncDirection: "PUSH_ONLY",
        autoCreateIssues: false,
      },
      credentials: { type: "api_token", email: "a@b.com", apiToken: "tok" },
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.createJiraIntegration).toHaveBeenCalled();
    expect(invalidate).toHaveBeenCalled();
  });
});
