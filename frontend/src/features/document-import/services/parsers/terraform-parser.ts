/**
 * Terraform Parser
 *
 * Parses Terraform (.tf) files and produces ExtractedArchitecture.
 * No AI required — pure structural parsing.
 */
import type {
  ExtractedArchitecture,
  ExtractedComponent,
  ExtractedDataFlow,
  ExtractedBoundary,
  ExtractedComponentType,
} from "../../types";

/** Map Terraform resource types to ThreatForge component types */
const TF_RESOURCE_MAP: Record<string, ExtractedComponentType> = {
  // Compute
  aws_lambda_function: "service",
  aws_instance: "service",
  aws_ecs_service: "service",
  aws_ecs_task_definition: "service",
  aws_eks_cluster: "service",
  aws_elastic_beanstalk_environment: "service",
  google_cloud_run_service: "service",
  google_compute_instance: "service",
  google_cloudfunctions_function: "service",
  azurerm_function_app: "service",
  azurerm_app_service: "service",
  azurerm_virtual_machine: "service",

  // API / Gateways
  aws_api_gateway_rest_api: "apiGateway",
  aws_api_gateway_v2_api: "apiGateway",
  aws_alb: "loadBalancer",
  aws_lb: "loadBalancer",
  google_compute_backend_service: "loadBalancer",
  azurerm_application_gateway: "apiGateway",
  azurerm_lb: "loadBalancer",

  // Databases
  aws_rds_instance: "database",
  aws_rds_cluster: "database",
  aws_dynamodb_table: "database",
  aws_elasticache_cluster: "cache",
  aws_elasticache_replication_group: "cache",
  google_sql_database_instance: "database",
  google_bigtable_instance: "database",
  google_firestore_document: "database",
  azurerm_sql_server: "database",
  azurerm_cosmosdb_account: "database",
  azurerm_redis_cache: "cache",

  // Storage
  aws_s3_bucket: "storage",
  aws_efs_file_system: "storage",
  google_storage_bucket: "storage",
  azurerm_storage_account: "storage",

  // Messaging / Queues
  aws_sqs_queue: "queue",
  aws_sns_topic: "queue",
  aws_kinesis_stream: "queue",
  aws_msk_cluster: "queue",
  google_pubsub_topic: "queue",
  google_pubsub_subscription: "queue",
  azurerm_servicebus_namespace: "queue",
  azurerm_eventhub_namespace: "queue",

  // CDN
  aws_cloudfront_distribution: "cdn",
  google_compute_url_map: "cdn",
  azurerm_cdn_profile: "cdn",

  // Auth / Security
  aws_cognito_user_pool: "authService",
  aws_iam_role: "authService",
  google_identity_platform_config: "authService",
  azurerm_active_directory_domain_service: "authService",

  // External integrations
  aws_api_gateway_integration: "externalService",
};

interface TerraformResource {
  resourceType: string;
  resourceName: string;
  attributes: Record<string, string>;
}

/** Extract resource blocks from Terraform HCL */
function parseTerraformResources(content: string): TerraformResource[] {
  const resources: TerraformResource[] = [];

  // Match: resource "type" "name" { ... }
  const resourcePattern =
    /resource\s+"([^"]+)"\s+"([^"]+)"\s*\{([^}]*(?:\{[^}]*\}[^}]*)*)\}/g;
  let match;

  while ((match = resourcePattern.exec(content)) !== null) {
    const resourceType = match[1];
    const resourceName = match[2];
    const body = match[3];

    // Extract simple key = "value" attributes
    const attributes: Record<string, string> = {};
    const attrPattern = /(\w+)\s*=\s*"([^"]*)"/g;
    let attrMatch;
    while ((attrMatch = attrPattern.exec(body)) !== null) {
      attributes[attrMatch[1]] = attrMatch[2];
    }

    resources.push({ resourceType, resourceName, attributes });
  }

  return resources;
}

/** Infer connections from attribute references like "${aws_instance.name.id}" */
function inferConnections(
  resources: TerraformResource[],
  components: ExtractedComponent[],
): ExtractedDataFlow[] {
  const flows: ExtractedDataFlow[] = [];
  const componentById = new Map(components.map((c) => [c.id, c]));

  for (const resource of resources) {
    const sourceId = `tf-${resource.resourceType}-${resource.resourceName}`;
    if (!componentById.has(sourceId)) continue;

    for (const value of Object.values(resource.attributes)) {
      // Match references like ${resource_type.resource_name.attribute}
      const refPattern = /\$\{([^.]+)\.([^.]+)\./g;
      let refMatch;
      while ((refMatch = refPattern.exec(value)) !== null) {
        const targetId = `tf-${refMatch[1]}-${refMatch[2]}`;
        if (componentById.has(targetId) && targetId !== sourceId) {
          flows.push({
            id: `flow-${sourceId}-${targetId}`,
            sourceId,
            targetId,
            label: "references",
            confidence: 0.7,
            selected: true,
          });
        }
      }
    }
  }

  return flows;
}

/** Parse a Terraform file and return ExtractedArchitecture */
export function parseTerraform(content: string): ExtractedArchitecture {
  const resources = parseTerraformResources(content);
  const components: ExtractedComponent[] = [];
  const technologies: string[] = [];
  const warnings: string[] = [];

  for (const resource of resources) {
    const componentType = TF_RESOURCE_MAP[resource.resourceType];

    if (!componentType) {
      // Still add unknown resource types as generic services
      if (
        resource.resourceType.startsWith("aws_") ||
        resource.resourceType.startsWith("google_") ||
        resource.resourceType.startsWith("azurerm_")
      ) {
        components.push({
          id: `tf-${resource.resourceType}-${resource.resourceName}`,
          name:
            resource.attributes.name ||
            resource.resourceName.replace(/_/g, " "),
          type: "service",
          description: `${resource.resourceType}: ${resource.resourceName}`,
          confidence: 0.6,
          selected: true,
        });
      }
      continue;
    }

    const name =
      resource.attributes.name ||
      resource.attributes.function_name ||
      resource.attributes.table_name ||
      resource.attributes.bucket ||
      resource.resourceName.replace(/_/g, " ");

    const tech =
      resource.attributes.runtime || resource.attributes.engine || undefined;
    if (tech && !technologies.includes(tech)) technologies.push(tech);

    components.push({
      id: `tf-${resource.resourceType}-${resource.resourceName}`,
      name,
      type: componentType,
      description: `${resource.resourceType}: ${resource.resourceName}`,
      technology: tech,
      confidence: 0.85,
      selected: true,
    });
  }

  if (components.length === 0) {
    warnings.push("No recognized Terraform resources found in file");
  }

  const dataFlows = inferConnections(resources, components);

  // Group cloud resources into a boundary
  const boundaries: ExtractedBoundary[] = [];
  if (components.length > 0) {
    const provider = resources[0]?.resourceType.startsWith("google_")
      ? "GCP"
      : resources[0]?.resourceType.startsWith("azurerm_")
        ? "Azure"
        : "AWS";
    boundaries.push({
      id: "tf-cloud-boundary",
      name: `${provider} Cloud`,
      type: "vpc",
      trustLevel: "INTERNAL",
      componentIds: components.map((c) => c.id),
      description: `Infrastructure defined in Terraform`,
      confidence: 0.9,
      selected: true,
    });
  }

  return {
    components,
    dataFlows,
    boundaries,
    technologies,
    dataTypes: [],
    confidence: components.length > 0 ? 0.8 : 0.2,
    warnings,
  };
}
