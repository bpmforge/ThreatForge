import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const prisma = { systemSettings: { findUnique: vi.fn() } };
vi.mock("../../db.js", () => ({ getPrisma: vi.fn(async () => prisma) }));
const { mockDecrypt } = vi.hoisted(() => ({ mockDecrypt: vi.fn() }));
vi.mock("../encryption/encryption-service.js", () => ({
  decryptValue: mockDecrypt,
}));

const { getNvdApiKey, getNvdApiKeySource, clearNvdApiKeyCache } = await import(
  "./nvd-api-key.js"
);

describe("NVD API key", () => {
  const savedEnv = process.env.NVD_API_KEY;
  beforeEach(() => {
    vi.clearAllMocks();
    clearNvdApiKeyCache();
    delete process.env.NVD_API_KEY;
  });
  afterEach(() => {
    if (savedEnv === undefined) delete process.env.NVD_API_KEY;
    else process.env.NVD_API_KEY = savedEnv;
  });

  it("uses the admin setting first", async () => {
    process.env.NVD_API_KEY = "env-key";
    prisma.systemSettings.findUnique.mockResolvedValue({ nvdApiKey: "cipher" });
    mockDecrypt.mockReturnValue("settings-key");
    expect(await getNvdApiKey()).toBe("settings-key");
    expect(await getNvdApiKeySource()).toBe("settings");
  });

  it("falls back to NVD_API_KEY", async () => {
    process.env.NVD_API_KEY = "env-key";
    prisma.systemSettings.findUnique.mockResolvedValue({ nvdApiKey: null });
    expect(await getNvdApiKey()).toBe("env-key");
    expect(await getNvdApiKeySource()).toBe("environment");
  });

  it("returns undefined when neither is set", async () => {
    prisma.systemSettings.findUnique.mockResolvedValue(null);
    expect(await getNvdApiKey()).toBeUndefined();
    expect(await getNvdApiKeySource()).toBe("none");
  });

  it("caches until cleared", async () => {
    prisma.systemSettings.findUnique.mockResolvedValue({ nvdApiKey: "cipher" });
    mockDecrypt.mockReturnValue("k1");
    await getNvdApiKey();
    mockDecrypt.mockReturnValue("k2");
    expect(await getNvdApiKey()).toBe("k1");
    clearNvdApiKeyCache();
    expect(await getNvdApiKey()).toBe("k2");
  });
});
