/**
 * Component Type Coercion (frontend)
 *
 * Normalizes loose type strings — legacy extractor vocabulary ("webServer",
 * "authService"), vendor nicknames ("s3", "cosmosDB"), or raw LLM output —
 * to a valid canvas `ComponentType`.
 *
 * Mirrors `server/src/services/ai/component-types.ts`; alias table kept in
 * sync by hand, drift caught by `component-types.test.ts`.
 *
 * Source of truth for the enum: `@/types/canvas` ComponentType.
 * Source of truth for the valid set: the palette catalog in
 * `@/components/panels/palette/data` (pulled via componentTypeGroups so the
 * dropdown, coercion, and palette can never drift apart).
 */
import type { ComponentType } from "@/types/canvas";
import { componentTypeGroups } from "@/components/panels/properties/constants";

const VALID_SET: ReadonlySet<string> = new Set(
  componentTypeGroups.flatMap((g) => g.options.map((o) => o.value)),
);

/**
 * Explicit aliases — common camelCase / vendor-nickname strings that legacy
 * extractors or LLMs emit, mapped to canonical types. Every right-hand side
 * must be a member of `ComponentType` (enforced by the test file).
 */
const ALIASES: Record<string, ComponentType> = {
  // Legacy extraction vocabulary
  webserver: "WEB_APP",
  webapp: "WEB_APP",
  frontend: "WEB_APP",
  api: "API",
  apigateway: "API_GATEWAY",
  database: "DATABASE",
  db: "DATABASE",
  cache: "CACHE",
  queue: "QUEUE",
  storage: "OBJECT_STORAGE",
  objectstorage: "OBJECT_STORAGE",
  filesystem: "FILE_SYSTEM",
  authservice: "AUTH_SERVICE",
  externalservice: "EXTERNAL_ENTITY",
  external: "EXTERNAL_ENTITY",
  client: "ACTOR",
  actor: "ACTOR",
  user: "ACTOR",
  service: "MICROSERVICE",
  microservice: "MICROSERVICE",
  loadbalancer: "LOAD_BALANCER",
  cdn: "CDN",
  firewall: "FIREWALL",
  vpn: "VPN",
  iam: "IAM",
  waf: "WAF",
  mlmodel: "AI_ML_MODEL",
  trainingpipeline: "TRAINING_PIPELINE",
  featurestore: "FEATURE_STORE",
  vectordb: "VECTOR_DB",
  llmapi: "LLM_API",
  embeddingservice: "EMBEDDING_SERVICE",
  // Vendor nicknames
  s3: "AWS_S3",
  rds: "AWS_RDS",
  dynamodb: "AWS_DYNAMODB",
  lambda: "AWS_LAMBDA",
  cloudfront: "AWS_CLOUDFRONT",
  cognito: "AWS_COGNITO",
  sqs: "AWS_SQS",
  sns: "AWS_SNS",
  kinesis: "AWS_KINESIS",
  sagemaker: "AWS_SAGEMAKER",
  bedrock: "AWS_BEDROCK",
  gcs: "GCP_STORAGE",
  cloudsql: "GCP_CLOUDSQL",
  spanner: "GCP_SPANNER",
  bigquery: "GCP_BIGQUERY",
  pubsub: "GCP_PUBSUB",
  firestore: "GCP_FIRESTORE",
  bigtable: "GCP_BIGTABLE",
  vertexai: "GCP_VERTEX_AI",
  cosmosdb: "AZURE_COSMOS",
  cosmos: "AZURE_COSMOS",
  azureblob: "AZURE_BLOB",
  azuresql: "AZURE_SQL",
  azureopenai: "AZURE_OPENAI",
  keyvault: "AZURE_KEY_VAULT",
};

function toUpperSnake(s: string): string {
  return s
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[\s-]+/g, "_")
    .toUpperCase();
}

/**
 * Coerce any string to a valid canvas ComponentType, or null when no safe
 * mapping exists. Callers that cannot drop the input should use
 * `coerceComponentTypeOrCustom` instead.
 */
export function coerceComponentType(raw: unknown): ComponentType | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // 1. Already canonical
  if (VALID_SET.has(trimmed)) return trimmed as ComponentType;

  // 2. Upper-snake normalization
  const normalized = toUpperSnake(trimmed);
  if (VALID_SET.has(normalized)) return normalized as ComponentType;

  // 3. Alias lookup (lowercased, punctuation stripped)
  const aliasKey = trimmed.toLowerCase().replace(/[\s_\-]+/g, "");
  if (ALIASES[aliasKey]) return ALIASES[aliasKey];

  return null;
}

/** Same as `coerceComponentType` but falls back to CUSTOM instead of null. */
export function coerceComponentTypeOrCustom(raw: unknown): ComponentType {
  return coerceComponentType(raw) ?? "CUSTOM";
}
