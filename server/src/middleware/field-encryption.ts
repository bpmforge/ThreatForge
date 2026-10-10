/* eslint-disable @typescript-eslint/no-explicit-any -- Prisma $extends API requires any for callback signatures */
/**
 * Field-Level Encryption Middleware
 *
 * Transparently encrypts/decrypts sensitive fields in threat model data
 * before writing to / after reading from the database.
 *
 * Encrypted fields:
 * - ThreatModel.canvasState — full architecture diagram
 * - Threat.description — vulnerability details
 * - Threat.evidence — OWASP/CWE/compliance evidence JSON
 * - Threat.attackVector — step-by-step attack scenario
 * - Mitigation.description — security control details
 * - Mitigation.implementationNotes — human implementation notes
 * - Mitigation.testCriteria — "Confirm that …" acceptance criteria
 * - Document.content — full extracted document text
 *
 * Uses AES-256-GCM via the existing encryption service.
 * Encrypted values are stored as JSON strings with { algorithm, iv, ciphertext, authTag }.
 * The middleware detects already-encrypted data by checking for the JSON structure.
 *
 * Enable with ENCRYPT_AT_REST=true in environment.
 */
import {
  encryptValue,
  decryptValue,
  isEncrypted,
} from "../services/encryption/encryption-service.js";
import logger from "../utils/logger.js";

const ENABLED = process.env.ENCRYPT_AT_REST === "true";

/**
 * Startup guard: refuse to boot with ENCRYPT_AT_REST=true and no usable
 * ENCRYPTION_KEY. Without this, encryptField() swallows the key error and
 * silently stores plaintext, so the operator believes data is encrypted when
 * it is not. No-op when encryption is disabled.
 */
export function assertEncryptionConfigured(
  env: NodeJS.ProcessEnv = process.env,
): void {
  if (env.ENCRYPT_AT_REST !== "true") return;
  const key = env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error(
      "ENCRYPT_AT_REST=true requires ENCRYPTION_KEY (generate: openssl rand -base64 32)",
    );
  }
  if (Buffer.from(key, "base64").length !== 32) {
    throw new Error(
      "ENCRYPTION_KEY must be a 256-bit (32 byte) key encoded in base64 (generate: openssl rand -base64 32)",
    );
  }
}

/**
 * Encrypt a string value if not already encrypted. Fails closed: if
 * encryption is on and fails, the write is refused rather than storing
 * plaintext.
 */
export function encryptField(
  value: string | null | undefined,
): string | null | undefined {
  if (!ENABLED || !value || isEncrypted(value)) return value;
  const encrypted = encryptValue(value);
  if (!encrypted) {
    throw new Error("Field encryption failed; refusing to store plaintext");
  }
  return encrypted;
}

/** Decrypt a string value if encrypted */
export function decryptField(
  value: string | null | undefined,
): string | null | undefined {
  if (!value || !isEncrypted(value)) return value;
  try {
    return decryptValue(value) ?? value;
  } catch (err) {
    logger.error({ err }, "Field decryption failed, returning raw value");
    return value;
  }
}

/** Encrypt a set of named fields on an object in-place */
function encryptFields(obj: Record<string, unknown>, fields: string[]): void {
  for (const field of fields) {
    const val = obj[field];
    if (typeof val === "string") {
      obj[field] = encryptField(val);
    } else if (val && typeof val === "object" && "set" in (val as object)) {
      const wrapped = val as { set?: string };
      if (typeof wrapped.set === "string") {
        wrapped.set = encryptField(wrapped.set) as string;
      }
    }
  }
}

/** Decrypt a set of named fields on an object in-place */
function decryptFields(obj: Record<string, unknown>, fields: string[]): void {
  for (const field of fields) {
    const val = obj[field];
    if (typeof val === "string") {
      obj[field] = decryptField(val);
    }
  }
}

const THREAT_FIELDS = ["description", "evidence", "attackVector"] as const;
const MITIGATION_FIELDS = [
  "description",
  "implementationNotes",
  "testCriteria",
] as const;
const DOCUMENT_FIELDS = ["content"] as const;
const THREAT_MODEL_FIELDS = ["canvasState"];

/**
 * Apply field encryption to a Prisma client using $extends.
 *
 * Wraps ThreatModel, Threat, Mitigation, and Document operations to
 * encrypt on write and decrypt on read.
 */
export function withFieldEncryption<T>(prisma: T): T {
  if (!ENABLED) return prisma;

  return (prisma as any).$extends({
    name: "field-encryption",
    query: {
      threatModel: {
        async create({ args, query }: any) {
          if (args.data.canvasState) {
            args.data.canvasState = encryptField(
              args.data.canvasState,
            ) as string;
          }
          const result = await query(args);
          if (result.canvasState) {
            result.canvasState = decryptField(result.canvasState) as string;
          }
          return result;
        },
        async update({ args, query }: any) {
          if (args.data.canvasState) {
            const val =
              typeof args.data.canvasState === "string"
                ? args.data.canvasState
                : args.data.canvasState.set;
            if (val) {
              if (typeof args.data.canvasState === "string") {
                args.data.canvasState = encryptField(val) as string;
              } else {
                args.data.canvasState.set = encryptField(val) as string;
              }
            }
          }
          const result = await query(args);
          if (result?.canvasState) {
            result.canvasState = decryptField(result.canvasState) as string;
          }
          return result;
        },
        // Bulk and upsert writes must encrypt too, or a caller that uses
        // them (canvas auto-save uses updateMany) stores plaintext.
        async updateMany({ args, query }: any) {
          encryptFields(args.data, THREAT_MODEL_FIELDS);
          return query(args);
        },
        async upsert({ args, query }: any) {
          encryptFields(args.create, THREAT_MODEL_FIELDS);
          encryptFields(args.update, THREAT_MODEL_FIELDS);
          const result = await query(args);
          if (result) decryptFields(result, THREAT_MODEL_FIELDS);
          return result;
        },
        async findUnique({ args, query }: any) {
          const result = await query(args);
          if (result?.canvasState) {
            result.canvasState = decryptField(result.canvasState) as string;
          }
          return result;
        },
        async findFirst({ args, query }: any) {
          const result = await query(args);
          if (result?.canvasState) {
            result.canvasState = decryptField(result.canvasState) as string;
          }
          return result;
        },
        async findMany({ args, query }: any) {
          const results = await query(args);
          for (const r of results) {
            if (r.canvasState) {
              r.canvasState = decryptField(r.canvasState) as string;
            }
          }
          return results;
        },
      },

      threat: {
        async create({ args, query }: any) {
          encryptFields(args.data, THREAT_FIELDS as unknown as string[]);
          const result = await query(args);
          if (result)
            decryptFields(result, THREAT_FIELDS as unknown as string[]);
          return result;
        },
        async createMany({ args, query }: any) {
          if (Array.isArray(args.data)) {
            for (const item of args.data) {
              encryptFields(item, THREAT_FIELDS as unknown as string[]);
            }
          }
          return query(args);
        },
        async update({ args, query }: any) {
          encryptFields(args.data, THREAT_FIELDS as unknown as string[]);
          const result = await query(args);
          if (result)
            decryptFields(result, THREAT_FIELDS as unknown as string[]);
          return result;
        },
        // Bulk and upsert writes must encrypt too, or a caller that uses
        // them (canvas auto-save uses updateMany) stores plaintext.
        async updateMany({ args, query }: any) {
          encryptFields(args.data, THREAT_FIELDS as unknown as string[]);
          return query(args);
        },
        async upsert({ args, query }: any) {
          encryptFields(args.create, THREAT_FIELDS as unknown as string[]);
          encryptFields(args.update, THREAT_FIELDS as unknown as string[]);
          const result = await query(args);
          if (result)
            decryptFields(result, THREAT_FIELDS as unknown as string[]);
          return result;
        },
        async findUnique({ args, query }: any) {
          const result = await query(args);
          if (result)
            decryptFields(result, THREAT_FIELDS as unknown as string[]);
          return result;
        },
        async findFirst({ args, query }: any) {
          const result = await query(args);
          if (result)
            decryptFields(result, THREAT_FIELDS as unknown as string[]);
          return result;
        },
        async findMany({ args, query }: any) {
          const results = await query(args);
          for (const r of results) {
            decryptFields(r, THREAT_FIELDS as unknown as string[]);
          }
          return results;
        },
      },

      mitigation: {
        async create({ args, query }: any) {
          encryptFields(args.data, MITIGATION_FIELDS as unknown as string[]);
          const result = await query(args);
          if (result)
            decryptFields(result, MITIGATION_FIELDS as unknown as string[]);
          return result;
        },
        async update({ args, query }: any) {
          encryptFields(args.data, MITIGATION_FIELDS as unknown as string[]);
          const result = await query(args);
          if (result)
            decryptFields(result, MITIGATION_FIELDS as unknown as string[]);
          return result;
        },
        // Bulk and upsert writes must encrypt too, or a caller that uses
        // them (canvas auto-save uses updateMany) stores plaintext.
        async updateMany({ args, query }: any) {
          encryptFields(args.data, MITIGATION_FIELDS as unknown as string[]);
          return query(args);
        },
        async upsert({ args, query }: any) {
          encryptFields(args.create, MITIGATION_FIELDS as unknown as string[]);
          encryptFields(args.update, MITIGATION_FIELDS as unknown as string[]);
          const result = await query(args);
          if (result)
            decryptFields(result, MITIGATION_FIELDS as unknown as string[]);
          return result;
        },
        async findUnique({ args, query }: any) {
          const result = await query(args);
          if (result)
            decryptFields(result, MITIGATION_FIELDS as unknown as string[]);
          return result;
        },
        async findFirst({ args, query }: any) {
          const result = await query(args);
          if (result)
            decryptFields(result, MITIGATION_FIELDS as unknown as string[]);
          return result;
        },
        async findMany({ args, query }: any) {
          const results = await query(args);
          for (const r of results) {
            decryptFields(r, MITIGATION_FIELDS as unknown as string[]);
          }
          return results;
        },
      },

      document: {
        async create({ args, query }: any) {
          encryptFields(args.data, DOCUMENT_FIELDS as unknown as string[]);
          const result = await query(args);
          if (result)
            decryptFields(result, DOCUMENT_FIELDS as unknown as string[]);
          return result;
        },
        async update({ args, query }: any) {
          encryptFields(args.data, DOCUMENT_FIELDS as unknown as string[]);
          const result = await query(args);
          if (result)
            decryptFields(result, DOCUMENT_FIELDS as unknown as string[]);
          return result;
        },
        // Bulk and upsert writes must encrypt too, or a caller that uses
        // them (canvas auto-save uses updateMany) stores plaintext.
        async updateMany({ args, query }: any) {
          encryptFields(args.data, DOCUMENT_FIELDS as unknown as string[]);
          return query(args);
        },
        async upsert({ args, query }: any) {
          encryptFields(args.create, DOCUMENT_FIELDS as unknown as string[]);
          encryptFields(args.update, DOCUMENT_FIELDS as unknown as string[]);
          const result = await query(args);
          if (result)
            decryptFields(result, DOCUMENT_FIELDS as unknown as string[]);
          return result;
        },
        async findUnique({ args, query }: any) {
          const result = await query(args);
          if (result)
            decryptFields(result, DOCUMENT_FIELDS as unknown as string[]);
          return result;
        },
        async findFirst({ args, query }: any) {
          const result = await query(args);
          if (result)
            decryptFields(result, DOCUMENT_FIELDS as unknown as string[]);
          return result;
        },
        async findMany({ args, query }: any) {
          const results = await query(args);
          for (const r of results) {
            decryptFields(r, DOCUMENT_FIELDS as unknown as string[]);
          }
          return results;
        },
      },
    },
  }) as T;
}
