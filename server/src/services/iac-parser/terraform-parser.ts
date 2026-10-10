/**
 * Terraform Parser
 *
 * Parses .tf files and extracts infrastructure components
 * for threat model generation. Maps Terraform resources
 * to threat model component types.
 *
 * Supports: AWS, GCP, Azure resources.
 * Works offline — pure text parsing, no LLM needed.
 */
import logger from "../../utils/logger.js";

interface TerraformComponent {
  id: string;
  name: string;
  type: string; // FTM component type
  terraformType: string; // Original terraform resource type
  properties: Record<string, unknown>;
  position: { x: number; y: number };
}

interface TerraformConnection {
  id: string;
  source: string;
  target: string;
  label?: string;
  protocol?: string;
  encrypted?: boolean;
}

export interface TerraformParseResult {
  components: TerraformComponent[];
  connections: TerraformConnection[];
  warnings: string[];
  resourceCount: number;
}

// =============================================================================
// Resource Type Mapping
// =============================================================================

const RESOURCE_MAP: Record<string, { type: string; category: string }> = {
  // AWS Compute
  aws_instance: { type: "SERVER", category: "compute" },
  aws_ecs_service: { type: "CONTAINER", category: "compute" },
  aws_ecs_cluster: { type: "KUBERNETES", category: "compute" },
  aws_eks_cluster: { type: "KUBERNETES", category: "compute" },
  aws_lambda_function: { type: "SERVERLESS", category: "compute" },
  aws_lightsail_instance: { type: "SERVER", category: "compute" },
  aws_elastic_beanstalk_environment: { type: "SERVER", category: "compute" },

  // AWS Database
  aws_db_instance: { type: "DATABASE", category: "data" },
  aws_rds_cluster: { type: "DATABASE", category: "data" },
  aws_dynamodb_table: { type: "DATABASE", category: "data" },
  aws_elasticache_cluster: { type: "CACHE", category: "data" },
  aws_elasticache_replication_group: { type: "CACHE", category: "data" },
  aws_redshift_cluster: { type: "DATABASE", category: "data" },

  // AWS Storage
  aws_s3_bucket: { type: "OBJECT_STORAGE", category: "storage" },
  aws_efs_file_system: { type: "FILE_SYSTEM", category: "storage" },
  aws_ebs_volume: { type: "FILE_SYSTEM", category: "storage" },

  // AWS Networking
  aws_lb: { type: "LOAD_BALANCER", category: "networking" },
  aws_alb: { type: "LOAD_BALANCER", category: "networking" },
  aws_api_gateway_rest_api: { type: "API_GATEWAY", category: "networking" },
  aws_apigatewayv2_api: { type: "API_GATEWAY", category: "networking" },
  aws_cloudfront_distribution: { type: "CDN", category: "networking" },
  aws_vpc: { type: "NETWORK", category: "networking" },
  aws_wafv2_web_acl: { type: "WAF", category: "security" },
  aws_security_group: { type: "FIREWALL", category: "security" },
  aws_security_group_rule: { type: "FIREWALL", category: "security" },
  aws_network_acl: { type: "FIREWALL", category: "networking" },
  aws_nat_gateway: { type: "NETWORK", category: "networking" },
  aws_subnet: { type: "NETWORK", category: "networking" },
  aws_route_table: { type: "NETWORK", category: "networking" },

  // AWS Security
  aws_cognito_user_pool: { type: "AUTH_SERVICE", category: "security" },
  aws_iam_role: { type: "IAM", category: "security" },
  aws_kms_key: { type: "KEY_MANAGEMENT", category: "security" },
  aws_secretsmanager_secret: { type: "SECRETS_MANAGER", category: "security" },

  // AWS Messaging
  aws_sqs_queue: { type: "QUEUE", category: "messaging" },
  aws_sns_topic: { type: "QUEUE", category: "messaging" },
  aws_kinesis_stream: { type: "QUEUE", category: "messaging" },
  aws_msk_cluster: { type: "QUEUE", category: "messaging" },

  // AWS Monitoring
  aws_cloudwatch_log_group: { type: "MONITORING", category: "monitoring" },
  aws_cloudwatch_metric_alarm: { type: "MONITORING", category: "monitoring" },

  // GCP
  google_compute_instance: { type: "SERVER", category: "compute" },
  google_container_cluster: { type: "KUBERNETES", category: "compute" },
  google_cloud_run_service: { type: "SERVERLESS", category: "compute" },
  google_cloudfunctions_function: { type: "SERVERLESS", category: "compute" },
  google_sql_database_instance: { type: "DATABASE", category: "data" },
  google_storage_bucket: { type: "OBJECT_STORAGE", category: "storage" },
  google_redis_instance: { type: "CACHE", category: "data" },
  google_pubsub_topic: { type: "QUEUE", category: "messaging" },
  google_compute_global_address: {
    type: "LOAD_BALANCER",
    category: "networking",
  },

  // Azure
  azurerm_virtual_machine: { type: "SERVER", category: "compute" },
  azurerm_kubernetes_cluster: { type: "KUBERNETES", category: "compute" },
  azurerm_function_app: { type: "SERVERLESS", category: "compute" },
  azurerm_app_service: { type: "WEB_APP", category: "compute" },
  azurerm_sql_server: { type: "DATABASE", category: "data" },
  azurerm_cosmosdb_account: { type: "DATABASE", category: "data" },
  azurerm_storage_account: { type: "OBJECT_STORAGE", category: "storage" },
  azurerm_redis_cache: { type: "CACHE", category: "data" },
  azurerm_servicebus_namespace: { type: "QUEUE", category: "messaging" },
  azurerm_key_vault: { type: "SECRETS_MANAGER", category: "security" },
  azurerm_application_gateway: {
    type: "LOAD_BALANCER",
    category: "networking",
  },
  azurerm_cdn_profile: { type: "CDN", category: "networking" },

  // Docker/Container
  docker_container: { type: "CONTAINER", category: "compute" },
  docker_image: { type: "CONTAINER", category: "compute" },
};

// =============================================================================
// Parser
// =============================================================================

/**
 * Parse Terraform HCL content and extract components + connections.
 */
export function parseTerraform(content: string): TerraformParseResult {
  const components: TerraformComponent[] = [];
  const connections: TerraformConnection[] = [];
  const warnings: string[] = [];
  let resourceCount = 0;

  // Extract resource blocks: resource "type" "name" { ... }
  const resourcePattern = /resource\s+"([^"]+)"\s+"([^"]+)"\s*\{/g;
  let match;
  const positions = new Map<string, { x: number; y: number }>();
  let col = 0;

  while ((match = resourcePattern.exec(content)) !== null) {
    resourceCount++;
    const tfType = match[1]!;
    const tfName = match[2]!;
    const resourceId = `${tfType}.${tfName}`;

    const mapping = RESOURCE_MAP[tfType];
    if (!mapping) {
      warnings.push(`Unknown resource type: ${tfType} (${tfName})`);
      continue;
    }

    // Auto-layout: grid based on category
    const categoryCol: Record<string, number> = {
      networking: 0,
      security: 1,
      compute: 2,
      data: 3,
      storage: 4,
      messaging: 5,
      monitoring: 6,
    };
    const x = (categoryCol[mapping.category] ?? col++) * 250 + 100;
    const existingInCol = [...positions.values()].filter(
      (p) => p.x === x,
    ).length;
    const y = existingInCol * 150 + 100;
    positions.set(resourceId, { x, y });

    // Extract properties from the block
    const blockStart = match.index! + match[0].length;
    const properties = extractBlockProperties(content, blockStart);

    components.push({
      id: resourceId,
      name: humanizeName(tfName),
      type: mapping.type,
      terraformType: tfType,
      properties,
      position: { x, y },
    });
  }

  // Infer connections from resource references
  for (const comp of components) {
    const refs = findReferences(comp.properties, components);
    for (const ref of refs) {
      // Skip self-referencing edges
      if (comp.id === ref.id) continue;
      connections.push({
        id: `${comp.id}-${ref.id}`,
        source: comp.id,
        target: ref.id,
        label: ref.label,
        protocol: inferProtocol(comp.type, ref.type),
        encrypted: inferEncryption(comp.type, ref.type),
      });
    }
  }

  logger.info(
    {
      resources: resourceCount,
      components: components.length,
      connections: connections.length,
      warnings: warnings.length,
    },
    "Terraform parsing complete",
  );

  return { components, connections, warnings, resourceCount };
}

// =============================================================================
// Helpers
// =============================================================================

function extractBlockProperties(
  content: string,
  startIndex: number,
): Record<string, unknown> {
  const props: Record<string, unknown> = {};
  let depth = 1;
  let i = startIndex;

  while (i < content.length && depth > 0) {
    if (content[i] === "{") depth++;
    if (content[i] === "}") depth--;
    i++;
  }

  const block = content.substring(startIndex, i - 1);

  // Extract simple key = value pairs
  const kvPattern = /(\w+)\s*=\s*"([^"]*)"/g;
  let kvMatch;
  while ((kvMatch = kvPattern.exec(block)) !== null) {
    props[kvMatch[1]!] = kvMatch[2];
  }

  // Extract boolean values
  const boolPattern = /(\w+)\s*=\s*(true|false)/g;
  let boolMatch;
  while ((boolMatch = boolPattern.exec(block)) !== null) {
    props[boolMatch[1]!] = boolMatch[2] === "true";
  }

  // Extract Terraform resource references (unquoted: key = resource_type.name.attr)
  const refPattern =
    /(\w+)\s*=\s*((?:aws|google|azurerm|docker)_\w+\.\w+(?:\.\w+)*)/g;
  let refMatch;
  while ((refMatch = refPattern.exec(block)) !== null) {
    props[refMatch[1]!] = refMatch[2];
  }

  return props;
}

function humanizeName(tfName: string): string {
  return tfName.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function findReferences(
  properties: Record<string, unknown>,
  allComponents: TerraformComponent[],
): Array<{ id: string; type: string; label: string }> {
  const refs: Array<{ id: string; type: string; label: string }> = [];
  const propStr = JSON.stringify(properties);

  for (const comp of allComponents) {
    // Check if properties reference another resource by name
    const tfParts = comp.id.split(".");
    if (tfParts[1] && propStr.includes(tfParts[1])) {
      refs.push({ id: comp.id, type: comp.type, label: "references" });
    }
  }

  return refs;
}

function inferProtocol(sourceType: string, targetType: string): string {
  if (targetType === "DATABASE") return "TCP";
  if (targetType === "CACHE") return "TCP";
  if (targetType === "QUEUE") return "AMQP";
  if (sourceType === "API_GATEWAY") return "HTTPS";
  if (sourceType === "LOAD_BALANCER") return "HTTPS";
  return "HTTPS";
}

function inferEncryption(sourceType: string, targetType: string): boolean {
  // Assume encrypted for cloud services
  if (sourceType === "API_GATEWAY" || sourceType === "LOAD_BALANCER")
    return true;
  if (targetType === "DATABASE" || targetType === "CACHE") return true;
  return false;
}
