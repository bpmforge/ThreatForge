/**
 * Component Type Registry Tests
 *
 * - `coerceComponentType` normalizes LLM / legacy strings to canonical enums
 * - Server list must stay in sync with the frontend ComponentType union
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  COMPONENT_TYPES,
  coerceComponentType,
  coerceComponentTypeOrCustom,
} from "../component-types.js";

describe("coerceComponentType", () => {
  it("returns canonical types unchanged", () => {
    expect(coerceComponentType("AWS_S3")).toBe("AWS_S3");
    expect(coerceComponentType("DATABASE")).toBe("DATABASE");
  });

  it("normalizes camelCase to upper-snake", () => {
    expect(coerceComponentType("webServer")).toBe("WEB_APP"); // alias wins
    expect(coerceComponentType("apiGateway")).toBe("API_GATEWAY");
    expect(coerceComponentType("loadBalancer")).toBe("LOAD_BALANCER");
  });

  it("resolves legacy extractor vocabulary via alias table", () => {
    expect(coerceComponentType("webServer")).toBe("WEB_APP");
    expect(coerceComponentType("authService")).toBe("AUTH_SERVICE");
    expect(coerceComponentType("externalService")).toBe("EXTERNAL_ENTITY");
    expect(coerceComponentType("mlModel")).toBe("AI_ML_MODEL");
  });

  it("resolves vendor nicknames to canonical vendor types", () => {
    expect(coerceComponentType("s3")).toBe("AWS_S3");
    expect(coerceComponentType("RDS")).toBe("AWS_RDS");
    expect(coerceComponentType("dynamodb")).toBe("AWS_DYNAMODB");
    expect(coerceComponentType("cosmosDB")).toBe("AZURE_COSMOS");
    expect(coerceComponentType("bigquery")).toBe("GCP_BIGQUERY");
    expect(coerceComponentType("gcs")).toBe("GCP_STORAGE");
  });

  it("handles kebab-case and whitespace", () => {
    expect(coerceComponentType("web-app")).toBe("WEB_APP");
    expect(coerceComponentType("api gateway")).toBe("API_GATEWAY");
  });

  it("returns null on unknown input", () => {
    expect(coerceComponentType("totally made up type")).toBeNull();
    expect(coerceComponentType("")).toBeNull();
    expect(coerceComponentType(null)).toBeNull();
    expect(coerceComponentType(undefined)).toBeNull();
    expect(coerceComponentType(42)).toBeNull();
  });

  it("coerceComponentTypeOrCustom falls back to CUSTOM on unknown", () => {
    expect(coerceComponentTypeOrCustom("totally made up")).toBe("CUSTOM");
    expect(coerceComponentTypeOrCustom(null)).toBe("CUSTOM");
    expect(coerceComponentTypeOrCustom("AWS_S3")).toBe("AWS_S3");
  });
});

describe("COMPONENT_TYPES parity with frontend enum", () => {
  it("server list matches frontend types/canvas.ts ComponentType union", () => {
    const canvasPath = join(
      process.cwd(),
      "..",
      "frontend",
      "src",
      "types",
      "canvas",
      "component-type.ts",
    );
    const source = readFileSync(canvasPath, "utf8");
    const union = source.match(/export type ComponentType\s*=([\s\S]*?);/);
    expect(union, "ComponentType union not found").toBeTruthy();
    const frontendTypes = [...union![1].matchAll(/"([A-Z][A-Z0-9_]+)"/g)].map(
      (m) => m[1],
    );
    const frontendSet = new Set(frontendTypes);
    const serverSet = new Set<string>(COMPONENT_TYPES);

    const missingFromServer = [...frontendSet].filter((t) => !serverSet.has(t));
    const extraOnServer = [...serverSet].filter((t) => !frontendSet.has(t));

    expect(
      missingFromServer,
      "types present in frontend but not server",
    ).toEqual([]);
    expect(extraOnServer, "types on server but not frontend").toEqual([]);
  });
});
