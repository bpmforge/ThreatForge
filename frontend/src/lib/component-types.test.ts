/**
 * Frontend component-type coercion — mirrors server-side util. The server
 * version has its own parity test against the enum; this file focuses on the
 * legacy-vocab cases that used to land outside the enum via naive
 * camelCase→UPPER_SNAKE normalization (the bug that motivated this util).
 */
import { describe, it, expect } from "vitest";
import {
  coerceComponentType,
  coerceComponentTypeOrCustom,
} from "./component-types";

describe("coerceComponentType — legacy extractor vocab", () => {
  it("maps webServer to WEB_APP (not the invalid WEB_SERVER)", () => {
    expect(coerceComponentType("webServer")).toBe("WEB_APP");
  });

  it("maps externalService to EXTERNAL_ENTITY (not invalid EXTERNAL_SERVICE)", () => {
    expect(coerceComponentType("externalService")).toBe("EXTERNAL_ENTITY");
  });

  it("maps client to ACTOR (not the invalid CLIENT)", () => {
    expect(coerceComponentType("client")).toBe("ACTOR");
  });

  it("maps bare service to MICROSERVICE (not the invalid SERVICE)", () => {
    expect(coerceComponentType("service")).toBe("MICROSERVICE");
  });

  it("maps mlModel to AI_ML_MODEL (not the invalid ML_MODEL)", () => {
    expect(coerceComponentType("mlModel")).toBe("AI_ML_MODEL");
  });

  it("leaves already-canonical values untouched", () => {
    expect(coerceComponentType("AWS_S3")).toBe("AWS_S3");
    expect(coerceComponentType("DATABASE")).toBe("DATABASE");
  });

  it("resolves vendor nicknames", () => {
    expect(coerceComponentType("s3")).toBe("AWS_S3");
    expect(coerceComponentType("cosmosDB")).toBe("AZURE_COSMOS");
    expect(coerceComponentType("bigquery")).toBe("GCP_BIGQUERY");
  });

  it("handles kebab and whitespace variants", () => {
    expect(coerceComponentType("web-app")).toBe("WEB_APP");
    expect(coerceComponentType("api gateway")).toBe("API_GATEWAY");
  });

  it("returns null for junk input", () => {
    expect(coerceComponentType("totally made up")).toBeNull();
    expect(coerceComponentType("")).toBeNull();
    expect(coerceComponentType(null)).toBeNull();
    expect(coerceComponentType(undefined)).toBeNull();
    expect(coerceComponentType(42)).toBeNull();
  });

  it("coerceComponentTypeOrCustom falls back to CUSTOM", () => {
    expect(coerceComponentTypeOrCustom("totally made up")).toBe("CUSTOM");
    expect(coerceComponentTypeOrCustom(null)).toBe("CUSTOM");
    expect(coerceComponentTypeOrCustom("s3")).toBe("AWS_S3");
  });
});
