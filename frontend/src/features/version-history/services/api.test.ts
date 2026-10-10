/**
 * Version History API Service Tests
 *
 * Tests for:
 * - getVersionHistory: GET correct URL, returns array
 * - getVersion: GET with versionId, returns version detail
 * - createVersion: POST with empty body when no data provided
 * - createVersion: POST with provided data
 * - restoreVersion: POST to restore endpoint
 * - updateVersion: PATCH with data
 * - getVersionHistory: throws on non-ok response
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getVersionHistory,
  getVersion,
  createVersion,
  restoreVersion,
  updateVersion,
} from "./api";

// ---------------------------------------------------------------------------
// fetch mock helpers
// ---------------------------------------------------------------------------

function mockFetch(body: unknown, ok = true, status = 200) {
  return vi.fn().mockResolvedValue({
    ok,
    status,
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Response);
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const makeVersion = (overrides = {}) => ({
  id: "ver-1",
  version: 1,
  name: "v1",
  changesSummary: "",
  createdAt: "2026-01-01T00:00:00Z",
  ...overrides,
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("getVersionHistory", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it("fetches the correct URL and returns the versions array", async () => {
    const versions = [makeVersion()];
    global.fetch = mockFetch(versions);

    const result = await getVersionHistory("model-1");

    expect(result).toEqual(versions);
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/threat-models/model-1/versions",
      expect.objectContaining({ credentials: "include" }),
    );
  });

  it("throws when the response is not ok", async () => {
    global.fetch = mockFetch({ message: "Not found" }, false, 404);

    await expect(getVersionHistory("model-bad")).rejects.toThrow("Not found");
  });
});

describe("getVersion", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it("fetches the correct URL with versionId and returns version detail", async () => {
    const version = { ...makeVersion(), canvasState: "{}" };
    global.fetch = mockFetch(version);

    const result = await getVersion("model-1", "ver-1");

    expect(result).toEqual(version);
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/threat-models/model-1/versions/ver-1",
      expect.objectContaining({ credentials: "include" }),
    );
  });
});

describe("createVersion", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it("POSTs with empty body {} when no data provided", async () => {
    const version = makeVersion();
    global.fetch = mockFetch(version);

    const result = await createVersion("model-1");

    expect(result).toEqual(version);
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/threat-models/model-1/versions",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({}),
        credentials: "include",
      }),
    );
  });

  it("POSTs with the provided data", async () => {
    const version = makeVersion({
      name: "Release 1.0",
      changesSummary: "Initial release",
    });
    global.fetch = mockFetch(version);

    const result = await createVersion("model-1", {
      name: "Release 1.0",
      changesSummary: "Initial release",
    });

    expect(result).toEqual(version);
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/threat-models/model-1/versions",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          name: "Release 1.0",
          changesSummary: "Initial release",
        }),
      }),
    );
  });
});

describe("restoreVersion", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it("POSTs to the restore endpoint and returns the new version", async () => {
    const version = makeVersion({ version: 2 });
    global.fetch = mockFetch(version);

    const result = await restoreVersion("model-1", "ver-1");

    expect(result).toEqual(version);
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/threat-models/model-1/versions/ver-1/restore",
      expect.objectContaining({ method: "POST", credentials: "include" }),
    );
  });
});

describe("updateVersion", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it("PATCHes with the provided data and returns the updated version", async () => {
    const version = makeVersion({ name: "Renamed Version" });
    global.fetch = mockFetch(version);

    const result = await updateVersion("model-1", "ver-1", {
      name: "Renamed Version",
    });

    expect(result).toEqual(version);
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/threat-models/model-1/versions/ver-1",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ name: "Renamed Version" }),
        credentials: "include",
      }),
    );
  });
});
