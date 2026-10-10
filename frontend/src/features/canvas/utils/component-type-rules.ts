import type { ComponentType } from "@/types/canvas";

export interface DetectionRule {
  pattern: RegExp;
  type: ComponentType;
  confidence: "high" | "medium" | "low";
}

export const VENDOR_RULES: DetectionRule[] = [
  // --- AWS compute ---
  { pattern: /\b(aws\s+)?ec2\b/i, type: "AWS_EC2", confidence: "high" },
  { pattern: /\b(aws\s+)?lambda\b/i, type: "AWS_LAMBDA", confidence: "high" },
  {
    pattern: /\baws\s+ecs\b|\becs\s+(cluster|task|service)\b/i,
    type: "AWS_ECS",
    confidence: "high",
  },
  { pattern: /\b(aws\s+)?eks\b/i, type: "AWS_EKS", confidence: "high" },
  { pattern: /\b(aws\s+)?fargate\b/i, type: "AWS_FARGATE", confidence: "high" },
  // --- AWS storage ---
  {
    pattern: /\b(aws\s+)?s3\b|\bs3\s+bucket\b/i,
    type: "AWS_S3",
    confidence: "high",
  },
  { pattern: /\b(aws\s+)?ebs\b/i, type: "AWS_EBS", confidence: "high" },
  { pattern: /\b(aws\s+)?efs\b/i, type: "AWS_EFS", confidence: "high" },
  { pattern: /\b(aws\s+)?glacier\b/i, type: "AWS_GLACIER", confidence: "high" },
  // --- AWS database ---
  { pattern: /\b(aws\s+)?rds\b/i, type: "AWS_RDS", confidence: "high" },
  {
    pattern: /\b(aws\s+)?dynamodb\b/i,
    type: "AWS_DYNAMODB",
    confidence: "high",
  },
  { pattern: /\b(aws\s+)?aurora\b/i, type: "AWS_AURORA", confidence: "high" },
  {
    pattern: /\b(aws\s+)?documentdb\b/i,
    type: "AWS_DOCUMENTDB",
    confidence: "high",
  },
  {
    pattern: /\b(aws\s+)?elasticache\b/i,
    type: "AWS_ELASTICACHE",
    confidence: "high",
  },
  {
    pattern: /\b(aws\s+)?redshift\b/i,
    type: "AWS_REDSHIFT",
    confidence: "high",
  },
  { pattern: /\b(aws\s+)?neptune\b/i, type: "AWS_NEPTUNE", confidence: "high" },
  // --- AWS networking ---
  { pattern: /\b(aws\s+)?vpc\b/i, type: "AWS_VPC", confidence: "high" },
  {
    pattern: /\b(aws\s+)?cloudfront\b/i,
    type: "AWS_CLOUDFRONT",
    confidence: "high",
  },
  {
    pattern: /\b(aws\s+)?route\s*53\b/i,
    type: "AWS_ROUTE53",
    confidence: "high",
  },
  {
    pattern: /\b(aws\s+)?api\s+gateway\b/i,
    type: "AWS_API_GATEWAY",
    confidence: "high",
  },
  {
    pattern: /\b(aws\s+)?(elb|alb|nlb)\b/i,
    type: "AWS_ALB",
    confidence: "high",
  },
  // --- AWS security ---
  { pattern: /\b(aws\s+)?cognito\b/i, type: "AWS_COGNITO", confidence: "high" },
  { pattern: /\b(aws\s+)?kms\b/i, type: "AWS_KMS", confidence: "high" },
  {
    pattern: /\b(aws\s+)?secrets\s+manager\b/i,
    type: "AWS_SECRETS_MANAGER",
    confidence: "high",
  },
  { pattern: /\b(aws\s+)?waf\b/i, type: "AWS_WAF", confidence: "high" },
  { pattern: /\b(aws\s+)?iam\b/i, type: "AWS_IAM", confidence: "high" },
  // --- AWS messaging/analytics ---
  { pattern: /\b(aws\s+)?sqs\b/i, type: "AWS_SQS", confidence: "high" },
  { pattern: /\b(aws\s+)?sns\b/i, type: "AWS_SNS", confidence: "high" },
  {
    pattern: /\b(aws\s+)?eventbridge\b/i,
    type: "AWS_EVENTBRIDGE",
    confidence: "high",
  },
  { pattern: /\b(aws\s+)?kinesis\b/i, type: "AWS_KINESIS", confidence: "high" },
  { pattern: /\b(aws\s+)?athena\b/i, type: "AWS_ATHENA", confidence: "high" },

  // --- GCP compute ---
  {
    pattern:
      /\bgce\b|\bgcp\s+compute\s+engine\b|\bgoogle\s+compute\s+engine\b/i,
    type: "GCP_COMPUTE",
    confidence: "high",
  },
  { pattern: /\bcloud\s+run\b/i, type: "GCP_CLOUD_RUN", confidence: "high" },
  {
    pattern: /\bcloud\s+functions?\b/i,
    type: "GCP_FUNCTIONS",
    confidence: "high",
  },
  {
    pattern: /\bgke\b|\bgoogle\s+kubernetes\s+engine\b/i,
    type: "GCP_GKE",
    confidence: "high",
  },
  { pattern: /\bapp\s+engine\b/i, type: "GCP_APP_ENGINE", confidence: "high" },
  // --- GCP storage ---
  {
    pattern: /\b(gcs|gcp\s+storage|google\s+cloud\s+storage)\b|\bgs:\/\//i,
    type: "GCP_STORAGE",
    confidence: "high",
  },
  { pattern: /\bfilestore\b/i, type: "GCP_FILESTORE", confidence: "high" },
  // --- GCP database ---
  { pattern: /\bcloud\s+sql\b/i, type: "GCP_CLOUDSQL", confidence: "high" },
  { pattern: /\bcloud\s+spanner\b/i, type: "GCP_SPANNER", confidence: "high" },
  { pattern: /\bbigtable\b/i, type: "GCP_BIGTABLE", confidence: "high" },
  { pattern: /\bfirestore\b/i, type: "GCP_FIRESTORE", confidence: "high" },
  { pattern: /\bbigquery\b/i, type: "GCP_BIGQUERY", confidence: "high" },
  { pattern: /\bmemorystore\b/i, type: "GCP_MEMORYSTORE", confidence: "high" },
  // --- GCP networking/security ---
  { pattern: /\bcloud\s+cdn\b/i, type: "GCP_CLOUD_CDN", confidence: "high" },
  { pattern: /\bcloud\s+dns\b/i, type: "GCP_CLOUD_DNS", confidence: "high" },
  {
    pattern: /\bcloud\s+armor\b/i,
    type: "GCP_CLOUD_ARMOR",
    confidence: "high",
  },
  {
    pattern: /\bidentity\s+platform\b/i,
    type: "GCP_IDENTITY_PLATFORM",
    confidence: "high",
  },
  {
    pattern: /\bsecret\s+manager\b(?!.*aws)/i,
    type: "GCP_SECRET_MANAGER",
    confidence: "medium",
  },
  // --- GCP messaging ---
  {
    pattern: /\bpub\/?sub\b|\bpubsub\b/i,
    type: "GCP_PUBSUB",
    confidence: "high",
  },
  { pattern: /\bdataflow\b/i, type: "GCP_DATAFLOW", confidence: "high" },

  // --- Azure compute ---
  {
    pattern: /\bazure\s+vm\b|\bazure\s+virtual\s+machines?\b/i,
    type: "AZURE_VM",
    confidence: "high",
  },
  {
    pattern: /\bazure\s+functions?\b/i,
    type: "AZURE_FUNCTIONS",
    confidence: "high",
  },
  {
    pattern: /\baks\b|\bazure\s+kubernetes\b/i,
    type: "AZURE_AKS",
    confidence: "high",
  },
  {
    pattern: /\b(azure\s+)?container\s+instances?\b/i,
    type: "AZURE_CONTAINER_INSTANCES",
    confidence: "high",
  },
  {
    pattern: /\bapp\s+service\b/i,
    type: "AZURE_APP_SERVICE",
    confidence: "high",
  },
  // --- Azure storage ---
  {
    pattern: /\bazure\s+blob\b|\bblob\s+storage\b/i,
    type: "AZURE_BLOB",
    confidence: "high",
  },
  { pattern: /\bazure\s+files?\b/i, type: "AZURE_FILES", confidence: "high" },
  // --- Azure database ---
  {
    pattern: /\bazure\s+sql\b|\bsql\s+database\b/i,
    type: "AZURE_SQL",
    confidence: "high",
  },
  { pattern: /\bcosmos\s*db\b/i, type: "AZURE_COSMOS", confidence: "high" },
  {
    pattern: /\bazure\s+(postgres|postgresql)\b/i,
    type: "AZURE_POSTGRESQL",
    confidence: "high",
  },
  { pattern: /\bazure\s+mysql\b/i, type: "AZURE_MYSQL", confidence: "high" },
  // --- Azure networking/security ---
  {
    pattern: /\bazure\s+front\s+door\b/i,
    type: "AZURE_FRONT_DOOR",
    confidence: "high",
  },
  {
    pattern: /\bazure\s+(ad|active\s+directory|entra\s+id)\b/i,
    type: "AZURE_AD",
    confidence: "high",
  },
  { pattern: /\bkey\s+vault\b/i, type: "AZURE_KEY_VAULT", confidence: "high" },
  // --- Azure messaging ---
  {
    pattern: /\bservice\s+bus\b/i,
    type: "AZURE_SERVICE_BUS",
    confidence: "high",
  },
  { pattern: /\bevent\s+hub\b/i, type: "AZURE_EVENT_HUB", confidence: "high" },
  {
    pattern: /\bevent\s+grid\b/i,
    type: "AZURE_EVENT_GRID",
    confidence: "high",
  },
];

export const GENERIC_RULES: DetectionRule[] = [
  // Databases
  {
    pattern: /postgres|postgresql|mysql|mariadb|oracle|sqlserver|mssql/i,
    type: "DATABASE",
    confidence: "high",
  },
  {
    pattern: /mongodb|mongo|couchdb|cassandra/i,
    type: "DATABASE",
    confidence: "high",
  },
  { pattern: /redis|memcached/i, type: "CACHE", confidence: "high" },
  { pattern: /\bdb\b|database/i, type: "DATABASE", confidence: "medium" },
  // API/Gateway
  {
    pattern: /api gateway|kong|apigee/i,
    type: "API_GATEWAY",
    confidence: "high",
  },
  { pattern: /load balancer/i, type: "LOAD_BALANCER", confidence: "high" },
  { pattern: /\bapi\b|rest api|graphql/i, type: "API", confidence: "medium" },
  // Queues/Messaging
  { pattern: /kafka|rabbitmq|activemq/i, type: "QUEUE", confidence: "high" },
  { pattern: /queue|message|event bus/i, type: "QUEUE", confidence: "medium" },
  // Storage
  {
    pattern: /minio|object storage/i,
    type: "OBJECT_STORAGE",
    confidence: "high",
  },
  { pattern: /file system|nfs/i, type: "FILE_SYSTEM", confidence: "high" },
  // Auth/Identity
  {
    pattern: /oauth|oidc|saml|okta|auth0|keycloak/i,
    type: "AUTH_SERVICE",
    confidence: "high",
  },
  { pattern: /iam|identity|idp|sso/i, type: "IAM", confidence: "medium" },
  // External services
  {
    pattern: /stripe|paypal|twilio|sendgrid|mailchimp|third.?party/i,
    type: "EXTERNAL_ENTITY",
    confidence: "high",
  },
  {
    pattern: /external|vendor|partner api/i,
    type: "EXTERNAL_ENTITY",
    confidence: "medium",
  },
  // Actors/Users
  {
    pattern: /\buser\b|customer|admin|operator|\bactor\b/i,
    type: "ACTOR",
    confidence: "medium",
  },
  {
    pattern: /browser|mobile app|ios|android/i,
    type: "MOBILE_APP",
    confidence: "high",
  },
  {
    pattern: /web app|frontend|spa|react app/i,
    type: "WEB_APP",
    confidence: "high",
  },
  // Infrastructure
  { pattern: /kubernetes|k8s/i, type: "KUBERNETES", confidence: "high" },
  { pattern: /docker|container/i, type: "CONTAINER", confidence: "high" },
  {
    pattern: /\bvm\b|virtual machine|compute/i,
    type: "VM",
    confidence: "high",
  },
  {
    pattern: /\bfunction\b|serverless/i,
    type: "SERVERLESS",
    confidence: "high",
  },
  // Networking
  { pattern: /cdn|cloudflare|akamai/i, type: "CDN", confidence: "high" },
  {
    pattern: /firewall|waf|security group/i,
    type: "FIREWALL",
    confidence: "high",
  },
  { pattern: /vpn|tunnel/i, type: "VPN", confidence: "high" },
  // Services - low confidence fallback
  {
    pattern: /microservice|service|backend|server/i,
    type: "MICROSERVICE",
    confidence: "low",
  },
];
