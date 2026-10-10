/**
 * Component Type Detector Tests
 *
 * Vendor-specific rules must fire BEFORE the generic fallback so that
 * distinctive cloud names ("s3", "rds", "cosmos db") land on the vendor
 * enum value instead of the generic parent.
 */
import { describe, it, expect } from "vitest";
import {
  detectComponentType,
  shouldSuggestTypeChange,
} from "./component-type-detector";

describe("detectComponentType — vendor rules", () => {
  it("routes AWS product names to AWS_* types", () => {
    expect(detectComponentType("User S3 Bucket")?.type).toBe("AWS_S3");
    expect(detectComponentType("Billing RDS")?.type).toBe("AWS_RDS");
    expect(detectComponentType("DynamoDB Sessions")?.type).toBe("AWS_DYNAMODB");
    expect(detectComponentType("Orders Lambda")?.type).toBe("AWS_LAMBDA");
    expect(detectComponentType("User pool (Cognito)")?.type).toBe(
      "AWS_COGNITO",
    );
  });

  it("routes GCP product names to GCP_* types", () => {
    expect(detectComponentType("User GCS Bucket")?.type).toBe("GCP_STORAGE");
    expect(detectComponentType("Billing Cloud SQL")?.type).toBe("GCP_CLOUDSQL");
    expect(detectComponentType("Analytics BigQuery")?.type).toBe(
      "GCP_BIGQUERY",
    );
    expect(detectComponentType("Events Pub/Sub")?.type).toBe("GCP_PUBSUB");
  });

  it("routes Azure product names to AZURE_* types", () => {
    expect(detectComponentType("User Blob Storage")?.type).toBe("AZURE_BLOB");
    expect(detectComponentType("Orders Cosmos DB")?.type).toBe("AZURE_COSMOS");
    expect(detectComponentType("Identity Azure AD")?.type).toBe("AZURE_AD");
    expect(detectComponentType("Events Service Bus")?.type).toBe(
      "AZURE_SERVICE_BUS",
    );
  });

  it("generic keywords still fall through to generic types", () => {
    expect(detectComponentType("Orders Postgres")?.type).toBe("DATABASE");
    expect(detectComponentType("Session Redis")?.type).toBe("CACHE");
    expect(detectComponentType("Orders Kafka")?.type).toBe("QUEUE");
  });

  it("returns null for unknown names", () => {
    expect(detectComponentType("Mystery Widget 3000")).toBeNull();
    expect(detectComponentType("")).toBeNull();
  });

  it("vendor rule wins when both vendor and generic keywords match", () => {
    // "RDS" implies AWS_RDS, not generic DATABASE, even though "database" is in the fallback set.
    expect(detectComponentType("RDS database cluster")?.type).toBe("AWS_RDS");
    // "Cosmos DB" implies AZURE_COSMOS, not generic DATABASE
    expect(detectComponentType("Cosmos DB session store")?.type).toBe(
      "AZURE_COSMOS",
    );
  });
});

describe("shouldSuggestTypeChange", () => {
  it("suggests a vendor type when the current type is generic", () => {
    const result = shouldSuggestTypeChange("Orders RDS", "DATABASE");
    expect(result?.type).toBe("AWS_RDS");
  });

  it("returns null when detected type matches current type", () => {
    expect(shouldSuggestTypeChange("Orders RDS", "AWS_RDS")).toBeNull();
  });

  it("returns null when no detection fires", () => {
    expect(shouldSuggestTypeChange("Mystery Thing", "CUSTOM")).toBeNull();
  });
});
