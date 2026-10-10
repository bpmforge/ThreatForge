/**
 * Default labels for component types.
 * Extracted from canvas-store for modularity.
 */
import type { ComponentType } from "@/types/canvas";

/** Default trust level for new components */
export const DEFAULT_TRUST_LEVEL = "INTERNAL" as const;

/** Default labels for each component type */
const DEFAULT_COMPONENT_LABELS: Partial<Record<ComponentType, string>> = {
  // DFD Elements
  ACTOR: "User",
  EXTERNAL_ENTITY: "External Service",
  PROCESS: "Process",
  DATA_STORE: "Database",
  DATA_FLOW: "Data Flow",
  TRUST_BOUNDARY: "Boundary",
  // Application Layer
  WEB_APP: "Web Application",
  MOBILE_APP: "Mobile App",
  DESKTOP_APP: "Desktop App",
  API: "API",
  MICROSERVICE: "Microservice",
  SERVERLESS: "Lambda Function",
  // Data Layer
  DATABASE: "Database",
  FILE_SYSTEM: "File Storage",
  OBJECT_STORAGE: "Object Storage",
  DATA_LAKE: "Data Lake",
  CACHE: "Cache",
  QUEUE: "Message Queue",
  // Networking
  LOAD_BALANCER: "Load Balancer",
  API_GATEWAY: "API Gateway",
  CDN: "CDN",
  DNS: "DNS",
  FIREWALL: "Firewall",
  VPN: "VPN",
  // Security
  IAM: "IAM",
  SECRETS_MANAGER: "Secrets Manager",
  WAF: "WAF",
  ENCRYPTION: "Encryption",
  AUTH_SERVICE: "Auth Service",
  // Infrastructure
  CONTAINER: "Container",
  KUBERNETES: "Kubernetes",
  VM: "Virtual Machine",
  SERVER: "Server",
  // Custom
  CUSTOM: "Component",
};

/** AWS service labels */
const AWS_COMPONENT_LABELS: Partial<Record<ComponentType, string>> = {
  // AWS - Compute
  AWS_EC2: "EC2 Instance",
  AWS_LAMBDA: "Lambda",
  AWS_ECS: "ECS Service",
  AWS_EKS: "EKS Cluster",
  AWS_FARGATE: "Fargate Task",
  AWS_BATCH: "Batch Job",
  AWS_LIGHTSAIL: "Lightsail",
  AWS_ELASTIC_BEANSTALK: "Elastic Beanstalk",
  // AWS - Storage
  AWS_S3: "S3 Bucket",
  AWS_EBS: "EBS Volume",
  AWS_EFS: "EFS File System",
  AWS_FSX: "FSx",
  AWS_GLACIER: "Glacier",
  AWS_STORAGE_GATEWAY: "Storage Gateway",
  // AWS - Database
  AWS_RDS: "RDS",
  AWS_DYNAMODB: "DynamoDB",
  AWS_AURORA: "Aurora",
  AWS_DOCUMENTDB: "DocumentDB",
  AWS_ELASTICACHE: "ElastiCache",
  AWS_NEPTUNE: "Neptune",
  AWS_REDSHIFT: "Redshift",
  AWS_TIMESTREAM: "Timestream",
  AWS_KEYSPACES: "Keyspaces",
  AWS_MEMORYDB: "MemoryDB",
  // AWS - Networking
  AWS_VPC: "VPC",
  AWS_CLOUDFRONT: "CloudFront",
  AWS_ROUTE53: "Route 53",
  AWS_API_GATEWAY: "API Gateway",
  AWS_ELB: "ELB",
  AWS_ALB: "ALB",
  AWS_NLB: "NLB",
  AWS_GLOBAL_ACCELERATOR: "Global Accelerator",
  AWS_TRANSIT_GATEWAY: "Transit Gateway",
  AWS_DIRECT_CONNECT: "Direct Connect",
  AWS_PRIVATELINK: "PrivateLink",
  // AWS - Security
  AWS_IAM: "IAM",
  AWS_COGNITO: "Cognito",
  AWS_KMS: "KMS",
  AWS_SECRETS_MANAGER: "Secrets Manager",
  AWS_WAF: "WAF",
  AWS_SHIELD: "Shield",
  AWS_GUARDDUTY: "GuardDuty",
  AWS_INSPECTOR: "Inspector",
  AWS_MACIE: "Macie",
  AWS_SECURITY_HUB: "Security Hub",
  // AWS - Messaging
  AWS_SQS: "SQS Queue",
  AWS_SNS: "SNS Topic",
  AWS_EVENTBRIDGE: "EventBridge",
  AWS_KINESIS: "Kinesis",
  AWS_MSK: "MSK",
  AWS_MQ: "Amazon MQ",
  AWS_SES: "SES",
  // AWS - AI/ML
  AWS_SAGEMAKER: "SageMaker",
  AWS_BEDROCK: "Bedrock",
  AWS_COMPREHEND: "Comprehend",
  AWS_REKOGNITION: "Rekognition",
  AWS_TEXTRACT: "Textract",
  AWS_POLLY: "Polly",
  AWS_LEX: "Lex",
  AWS_TRANSLATE: "Translate",
  // AWS - Analytics
  AWS_ATHENA: "Athena",
  AWS_EMR: "EMR",
  AWS_GLUE: "Glue",
  AWS_QUICKSIGHT: "QuickSight",
  AWS_OPENSEARCH: "OpenSearch",
  AWS_DATA_PIPELINE: "Data Pipeline",
  AWS_LAKE_FORMATION: "Lake Formation",
  // AWS - DevOps
  AWS_CODEPIPELINE: "CodePipeline",
  AWS_CODEBUILD: "CodeBuild",
  AWS_CODECOMMIT: "CodeCommit",
  AWS_CODEDEPLOY: "CodeDeploy",
  AWS_CLOUDFORMATION: "CloudFormation",
  AWS_CDK: "CDK",
  // AWS - Management
  AWS_CLOUDWATCH: "CloudWatch",
  AWS_CLOUDTRAIL: "CloudTrail",
  AWS_CONFIG: "Config",
  AWS_SYSTEMS_MANAGER: "Systems Manager",
  AWS_XRAY: "X-Ray",
  AWS_STEP_FUNCTIONS: "Step Functions",
};

/** GCP service labels */
const GCP_COMPONENT_LABELS: Partial<Record<ComponentType, string>> = {
  // GCP - Compute
  GCP_COMPUTE: "Compute Engine",
  GCP_FUNCTIONS: "Cloud Function",
  GCP_GKE: "GKE Cluster",
  GCP_CLOUD_RUN: "Cloud Run",
  GCP_APP_ENGINE: "App Engine",
  GCP_ANTHOS: "Anthos",
  GCP_BATCH: "Batch",
  // GCP - Storage
  GCP_STORAGE: "Cloud Storage",
  GCP_PERSISTENT_DISK: "Persistent Disk",
  GCP_FILESTORE: "Filestore",
  GCP_ARCHIVE_STORAGE: "Archive Storage",
  // GCP - Database
  GCP_CLOUDSQL: "Cloud SQL",
  GCP_FIRESTORE: "Firestore",
  GCP_BIGTABLE: "Bigtable",
  GCP_SPANNER: "Spanner",
  GCP_MEMORYSTORE: "Memorystore",
  GCP_DATASTORE: "Datastore",
  GCP_ALLOYDB: "AlloyDB",
  // GCP - Networking
  GCP_VPC: "VPC",
  GCP_CLOUD_CDN: "Cloud CDN",
  GCP_CLOUD_DNS: "Cloud DNS",
  GCP_LOAD_BALANCING: "Load Balancing",
  GCP_CLOUD_NAT: "Cloud NAT",
  GCP_CLOUD_ARMOR: "Cloud Armor",
  GCP_CLOUD_INTERCONNECT: "Interconnect",
  GCP_TRAFFIC_DIRECTOR: "Traffic Director",
  // GCP - Security
  GCP_IAM: "IAM",
  GCP_KMS: "KMS",
  GCP_SECRET_MANAGER: "Secret Manager",
  GCP_IDENTITY_PLATFORM: "Identity Platform",
  GCP_SECURITY_COMMAND_CENTER: "Security CC",
  GCP_CERTIFICATE_MANAGER: "Certificate Manager",
  // GCP - Messaging
  GCP_PUBSUB: "Pub/Sub",
  GCP_CLOUD_TASKS: "Cloud Tasks",
  GCP_EVENTARC: "Eventarc",
  GCP_WORKFLOWS: "Workflows",
  // GCP - AI/ML
  GCP_VERTEX_AI: "Vertex AI",
  GCP_AUTOML: "AutoML",
  GCP_VISION_AI: "Vision AI",
  GCP_NATURAL_LANGUAGE: "Natural Language",
  GCP_SPEECH_TO_TEXT: "Speech-to-Text",
  GCP_TRANSLATION: "Translation",
  GCP_DIALOGFLOW: "Dialogflow",
  GCP_DOCUMENT_AI: "Document AI",
  // GCP - Analytics
  GCP_BIGQUERY: "BigQuery",
  GCP_DATAFLOW: "Dataflow",
  GCP_DATAPROC: "Dataproc",
  GCP_COMPOSER: "Composer",
  GCP_DATA_FUSION: "Data Fusion",
  GCP_LOOKER: "Looker",
  GCP_DATAPLEX: "Dataplex",
  // GCP - DevOps
  GCP_CLOUD_BUILD: "Cloud Build",
  GCP_ARTIFACT_REGISTRY: "Artifact Registry",
  GCP_CLOUD_DEPLOY: "Cloud Deploy",
  GCP_SOURCE_REPOS: "Source Repos",
  // GCP - Management
  GCP_CLOUD_LOGGING: "Cloud Logging",
  GCP_CLOUD_MONITORING: "Cloud Monitoring",
  GCP_CLOUD_TRACE: "Cloud Trace",
  GCP_ERROR_REPORTING: "Error Reporting",
};

/** Azure service labels */
const AZURE_COMPONENT_LABELS: Partial<Record<ComponentType, string>> = {
  // Azure - Compute
  AZURE_VM: "Azure VM",
  AZURE_FUNCTIONS: "Azure Function",
  AZURE_AKS: "AKS Cluster",
  AZURE_CONTAINER_INSTANCES: "Container Instances",
  AZURE_CONTAINER_APPS: "Container Apps",
  AZURE_APP_SERVICE: "App Service",
  AZURE_BATCH: "Batch",
  AZURE_VMSS: "VM Scale Sets",
  // Azure - Storage
  AZURE_BLOB: "Blob Storage",
  AZURE_FILES: "Azure Files",
  AZURE_DISK: "Managed Disk",
  AZURE_DATA_LAKE: "Data Lake",
  AZURE_ARCHIVE: "Archive Storage",
  AZURE_NETAPP: "NetApp Files",
  // Azure - Database
  AZURE_SQL: "Azure SQL",
  AZURE_COSMOS: "Cosmos DB",
  AZURE_POSTGRESQL: "PostgreSQL",
  AZURE_MYSQL: "MySQL",
  AZURE_MARIADB: "MariaDB",
  AZURE_CACHE_REDIS: "Cache for Redis",
  AZURE_SYNAPSE: "Synapse",
  AZURE_DATA_EXPLORER: "Data Explorer",
  // Azure - Networking
  AZURE_VNET: "Virtual Network",
  AZURE_CDN: "CDN",
  AZURE_DNS: "DNS",
  AZURE_LOAD_BALANCER: "Load Balancer",
  AZURE_APP_GATEWAY: "App Gateway",
  AZURE_FRONT_DOOR: "Front Door",
  AZURE_TRAFFIC_MANAGER: "Traffic Manager",
  AZURE_FIREWALL: "Firewall",
  AZURE_EXPRESSROUTE: "ExpressRoute",
  AZURE_VPN_GATEWAY: "VPN Gateway",
  AZURE_BASTION: "Bastion",
  AZURE_PRIVATE_LINK: "Private Link",
  // Azure - Security
  AZURE_AD: "Entra ID",
  AZURE_AD_B2C: "Entra ID B2C",
  AZURE_KEY_VAULT: "Key Vault",
  AZURE_DEFENDER: "Defender",
  AZURE_SENTINEL: "Sentinel",
  AZURE_WAF: "WAF",
  AZURE_DDOS_PROTECTION: "DDoS Protection",
  // Azure - Messaging
  AZURE_SERVICE_BUS: "Service Bus",
  AZURE_EVENT_HUB: "Event Hubs",
  AZURE_EVENT_GRID: "Event Grid",
  AZURE_NOTIFICATION_HUB: "Notification Hubs",
  AZURE_QUEUE_STORAGE: "Queue Storage",
  // Azure - AI/ML
  AZURE_ML: "Machine Learning",
  AZURE_OPENAI: "OpenAI Service",
  AZURE_COGNITIVE_SERVICES: "Cognitive Services",
  AZURE_BOT_SERVICE: "Bot Service",
  AZURE_FORM_RECOGNIZER: "Form Recognizer",
  AZURE_TRANSLATOR: "Translator",
  AZURE_SPEECH: "Speech Services",
  // Azure - Analytics
  AZURE_DATABRICKS: "Databricks",
  AZURE_DATA_FACTORY: "Data Factory",
  AZURE_STREAM_ANALYTICS: "Stream Analytics",
  AZURE_PURVIEW: "Purview",
  AZURE_POWER_BI: "Power BI",
  AZURE_ANALYSIS_SERVICES: "Analysis Services",
  // Azure - DevOps
  AZURE_DEVOPS: "Azure DevOps",
  AZURE_REPOS: "Repos",
  AZURE_PIPELINES: "Pipelines",
  AZURE_ARTIFACTS: "Artifacts",
  AZURE_CONTAINER_REGISTRY: "Container Registry",
  // Azure - Management
  AZURE_MONITOR: "Monitor",
  AZURE_LOG_ANALYTICS: "Log Analytics",
  AZURE_APPLICATION_INSIGHTS: "App Insights",
  AZURE_AUTOMATION: "Automation",
  AZURE_LOGIC_APPS: "Logic Apps",
};

/** Blockchain/Web3 component labels */
const WEB3_COMPONENT_LABELS: Partial<Record<ComponentType, string>> = {
  SMART_CONTRACT: "Smart Contract",
  WALLET: "Wallet",
  BLOCKCHAIN_NODE: "Blockchain Node",
  ORACLE: "Oracle",
  IPFS: "IPFS",
};

/** Get default label for a component type */
export function getDefaultLabel(type: ComponentType): string {
  return (
    DEFAULT_COMPONENT_LABELS[type] ??
    AWS_COMPONENT_LABELS[type] ??
    GCP_COMPONENT_LABELS[type] ??
    AZURE_COMPONENT_LABELS[type] ??
    WEB3_COMPONENT_LABELS[type] ??
    "Component"
  );
}
