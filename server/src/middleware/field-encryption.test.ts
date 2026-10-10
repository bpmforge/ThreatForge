/**
 * Tests for field-level encryption middleware.
 *
 * ENABLED is a module-level constant, so we must force a fresh import
 * after setting env vars. We use vi.resetModules() + dynamic import.
 */
import { describe, it, expect, beforeAll, vi } from "vitest";

// Generate a valid 32-byte key for tests
const TEST_KEY = "3Q74kNaVKre99og6N3QtodFKJQ+rw0hBj0k/4MbvII4=";

async function loadModule() {
  vi.resetModules();
  vi.stubEnv("ENCRYPT_AT_REST", "true");
  vi.stubEnv("ENCRYPTION_KEY", TEST_KEY);
  return import("./field-encryption.js");
}

describe("encryptField / decryptField — with encryption enabled", () => {
  let encryptField: (v: string | null | undefined) => string | null | undefined;
  let decryptField: (v: string | null | undefined) => string | null | undefined;

  beforeAll(async () => {
    const mod = await loadModule();
    encryptField = mod.encryptField;
    decryptField = mod.decryptField;
  });

  it("round-trips a plain string", () => {
    const plain = "sensitive threat description";
    const encrypted = encryptField(plain);
    expect(encrypted).not.toBe(plain);
    expect(decryptField(encrypted)).toBe(plain);
  });

  it("does not double-encrypt an already-encrypted value", () => {
    const plain = "test value";
    const once = encryptField(plain) as string;
    const twice = encryptField(once) as string;
    expect(twice).toBe(once);
  });

  it("returns null/undefined unchanged", () => {
    expect(encryptField(null)).toBeNull();
    expect(encryptField(undefined)).toBeUndefined();
    expect(decryptField(null)).toBeNull();
    expect(decryptField(undefined)).toBeUndefined();
  });

  it("decryptField returns plaintext unchanged if not encrypted", () => {
    expect(decryptField("plaintext")).toBe("plaintext");
  });
});

describe("withFieldEncryption — threat fields", () => {
  it("encrypts description, evidence, attackVector on create and decrypts on result", async () => {
    const { withFieldEncryption } = await loadModule();

    const mockPrisma = {
      $extends(ext: any) {
        return {
          async testThreatCreate(data: Record<string, string>) {
            const args = { data: { ...data } };
            const query = async (a: any) => ({ ...a.data });
            return ext.query.threat.create({ args, query });
          },
        };
      },
    };

    const extended = (withFieldEncryption as any)(mockPrisma);
    const result = await extended.testThreatCreate({
      description: "SQL injection via login form",
      evidence: '{"cwe":"CWE-89"}',
      attackVector: "POST /api/login with payload",
    });

    expect(result.description).toBe("SQL injection via login form");
    expect(result.evidence).toBe('{"cwe":"CWE-89"}');
    expect(result.attackVector).toBe("POST /api/login with payload");
  });
});

describe("withFieldEncryption — document.content", () => {
  it("encrypts content on create and decrypts on result", async () => {
    const { withFieldEncryption } = await loadModule();

    const mockPrisma = {
      $extends(ext: any) {
        return {
          async testDocCreate(data: Record<string, string>) {
            const args = { data: { ...data } };
            const query = async (a: any) => ({ ...a.data });
            return ext.query.document.create({ args, query });
          },
        };
      },
    };

    const extended = (withFieldEncryption as any)(mockPrisma);
    const result = await extended.testDocCreate({
      content: "CONFIDENTIAL: Architecture specification document text",
    });

    expect(result.content).toBe(
      "CONFIDENTIAL: Architecture specification document text",
    );
  });
});

describe("withFieldEncryption — mitigation fields", () => {
  it("encrypts implementationNotes and testCriteria on create", async () => {
    const { withFieldEncryption } = await loadModule();

    const mockPrisma = {
      $extends(ext: any) {
        return {
          async testMitCreate(data: Record<string, string>) {
            const args = { data: { ...data } };
            const query = async (a: any) => ({ ...a.data });
            return ext.query.mitigation.create({ args, query });
          },
        };
      },
    };

    const extended = (withFieldEncryption as any)(mockPrisma);
    const result = await extended.testMitCreate({
      description: "Enable TLS 1.3 on all endpoints",
      implementationNotes: "Deployed via nginx SSL termination config",
      testCriteria: "Confirm that all endpoints reject TLS < 1.3",
    });

    expect(result.description).toBe("Enable TLS 1.3 on all endpoints");
    expect(result.implementationNotes).toBe(
      "Deployed via nginx SSL termination config",
    );
    expect(result.testCriteria).toBe(
      "Confirm that all endpoints reject TLS < 1.3",
    );
  });
});

describe("withFieldEncryption — bulk and upsert writes", () => {
  // Canvas auto-save writes canvasState with updateMany; without a hook the
  // value reached the database in plaintext even with ENCRYPT_AT_REST=true.
  type WriteArgs = Record<string, Record<string, unknown>>;
  type Hook = (p: {
    args: WriteArgs;
    query: (a: WriteArgs) => Promise<unknown>;
  }) => Promise<unknown>;

  async function captureWrite(
    model: string,
    op: string,
    args: WriteArgs,
  ): Promise<WriteArgs> {
    const { withFieldEncryption } = await loadModule();
    let written: WriteArgs = {};
    const ext = (
      withFieldEncryption as unknown as (p: unknown) => {
        query: Record<string, Record<string, Hook>>;
      }
    )({ $extends: (e: unknown) => e });
    await ext.query[model][op]({
      args,
      query: async (a) => {
        written = structuredClone(a);
        return op === "updateMany" ? { count: 1 } : { ...a.update };
      },
    });
    return written;
  }

  it("encrypts threatModel.canvasState on updateMany", async () => {
    const written = await captureWrite("threatModel", "updateMany", {
      where: { id: "m1" },
      data: { canvasState: '{"nodes":[]}' },
    });
    expect(written.data.canvasState).not.toBe('{"nodes":[]}');
    expect(written.data.canvasState).toContain("ciphertext");
  });

  it.each([
    ["threat", "description"],
    ["mitigation", "implementationNotes"],
    ["document", "content"],
  ])("encrypts %s.%s on updateMany and upsert", async (model, field) => {
    const many = await captureWrite(model, "updateMany", {
      where: {},
      data: { [field]: "secret text" },
    });
    expect(many.data[field]).not.toBe("secret text");

    const up = await captureWrite(model, "upsert", {
      where: { id: "x" },
      create: { [field]: "secret text" },
      update: { [field]: "secret text" },
    });
    expect(up.create[field]).not.toBe("secret text");
    expect(up.update[field]).not.toBe("secret text");
  });
});

describe("withFieldEncryption — disabled", () => {
  it("is a no-op when ENCRYPT_AT_REST is not set", async () => {
    vi.resetModules();
    vi.stubEnv("ENCRYPT_AT_REST", "false");
    vi.stubEnv("ENCRYPTION_KEY", TEST_KEY);
    const { withFieldEncryption } = await import("./field-encryption.js");

    const sentinel = { marker: "unchanged" };
    const result = withFieldEncryption(sentinel);
    expect(result).toBe(sentinel);
  });
});

describe("assertEncryptionConfigured", () => {
  it("is a no-op when ENCRYPT_AT_REST is not true", async () => {
    const { assertEncryptionConfigured } = await loadModule();
    expect(() => assertEncryptionConfigured({})).not.toThrow();
    expect(() =>
      assertEncryptionConfigured({ ENCRYPT_AT_REST: "false" }),
    ).not.toThrow();
  });

  it("throws when enabled without ENCRYPTION_KEY", async () => {
    const { assertEncryptionConfigured } = await loadModule();
    expect(() =>
      assertEncryptionConfigured({ ENCRYPT_AT_REST: "true" }),
    ).toThrow(/requires ENCRYPTION_KEY/);
  });

  it("throws when the key is not 32 bytes of base64", async () => {
    const { assertEncryptionConfigured } = await loadModule();
    expect(() =>
      assertEncryptionConfigured({
        ENCRYPT_AT_REST: "true",
        ENCRYPTION_KEY: "short",
      }),
    ).toThrow(/32 byte/);
  });

  it("accepts a valid base64 256-bit key", async () => {
    const { assertEncryptionConfigured } = await loadModule();
    expect(() =>
      assertEncryptionConfigured({
        ENCRYPT_AT_REST: "true",
        ENCRYPTION_KEY: TEST_KEY,
      }),
    ).not.toThrow();
  });
});

describe("encryptField — encryption failure", () => {
  it("refuses to store plaintext when encryption fails", async () => {
    vi.resetModules();
    vi.stubEnv("ENCRYPT_AT_REST", "true");
    vi.stubEnv("ENCRYPTION_KEY", TEST_KEY);
    vi.doMock("../services/encryption/encryption-service.js", async (orig) => ({
      ...(await orig<Record<string, unknown>>()),
      encryptValue: () => null,
    }));
    const { encryptField } = await import("./field-encryption.js");
    expect(() => encryptField("secret")).toThrow(/refusing to store plaintext/);
    vi.doUnmock("../services/encryption/encryption-service.js");
  });
});
