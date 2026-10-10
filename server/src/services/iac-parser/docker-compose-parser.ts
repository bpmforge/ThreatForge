/**
 * Docker Compose Parser
 *
 * Parses docker-compose.yml files and extracts infrastructure components
 * for threat model generation. Maps service image names to component types,
 * networks to trust boundaries, and named volumes to data stores.
 *
 * Works offline — pure text/regex parsing, no YAML library needed.
 */
import logger from "../../utils/logger.js";

interface DockerComposeComponent {
  id: string;
  name: string;
  type: string; // FTM component type
  image: string;
  properties: Record<string, unknown>;
  position: { x: number; y: number };
}

interface DockerComposeConnection {
  id: string;
  source: string;
  target: string;
  label?: string;
  protocol?: string;
  encrypted?: boolean;
}

export interface DockerComposeParseResult {
  components: DockerComposeComponent[];
  connections: DockerComposeConnection[];
  warnings: string[];
  resourceCount: number;
}

// =============================================================================
// Image → Component Type Mapping
// =============================================================================

/**
 * Map image name fragments to FTM component types.
 * Checked in order — first match wins.
 */
const IMAGE_TYPE_MAP: Array<{
  pattern: RegExp;
  type: string;
  category: string;
}> = [
  // Databases
  { pattern: /postgres|postgresql/i, type: "DATABASE", category: "data" },
  { pattern: /mysql|mariadb/i, type: "DATABASE", category: "data" },
  { pattern: /mongo/i, type: "DATABASE", category: "data" },
  { pattern: /mssql|sqlserver/i, type: "DATABASE", category: "data" },
  { pattern: /oracle/i, type: "DATABASE", category: "data" },
  { pattern: /cassandra/i, type: "DATABASE", category: "data" },
  { pattern: /cockroach/i, type: "DATABASE", category: "data" },
  { pattern: /elasticsearch|opensearch/i, type: "DATABASE", category: "data" },
  // Caches
  { pattern: /redis/i, type: "CACHE", category: "data" },
  { pattern: /memcached/i, type: "CACHE", category: "data" },
  // Load balancers / proxies
  { pattern: /nginx/i, type: "LOAD_BALANCER", category: "networking" },
  { pattern: /haproxy/i, type: "LOAD_BALANCER", category: "networking" },
  { pattern: /traefik/i, type: "LOAD_BALANCER", category: "networking" },
  { pattern: /envoy/i, type: "LOAD_BALANCER", category: "networking" },
  { pattern: /caddy/i, type: "LOAD_BALANCER", category: "networking" },
  // Message brokers
  { pattern: /kafka/i, type: "QUEUE", category: "messaging" },
  { pattern: /rabbitmq/i, type: "QUEUE", category: "messaging" },
  { pattern: /nats/i, type: "QUEUE", category: "messaging" },
  { pattern: /activemq/i, type: "QUEUE", category: "messaging" },
  { pattern: /pulsar/i, type: "QUEUE", category: "messaging" },
  // Auth / identity
  { pattern: /keycloak/i, type: "AUTH_SERVICE", category: "security" },
  { pattern: /vault/i, type: "SECRETS_MANAGER", category: "security" },
  // Monitoring
  { pattern: /grafana/i, type: "MONITORING", category: "monitoring" },
  { pattern: /prometheus/i, type: "MONITORING", category: "monitoring" },
  {
    pattern: /jaeger|zipkin|tempo/i,
    type: "MONITORING",
    category: "monitoring",
  },
  { pattern: /loki/i, type: "MONITORING", category: "monitoring" },
  // Object storage
  { pattern: /minio/i, type: "OBJECT_STORAGE", category: "storage" },
  // Default: treat as a generic container/service
];

const CATEGORY_COL: Record<string, number> = {
  networking: 0,
  security: 1,
  compute: 2,
  data: 3,
  storage: 4,
  messaging: 5,
  monitoring: 6,
};

// =============================================================================
// Parser
// =============================================================================

export function parseDockerCompose(content: string): DockerComposeParseResult {
  const components: DockerComposeComponent[] = [];
  const connections: DockerComposeConnection[] = [];
  const warnings: string[] = [];
  let resourceCount = 0;

  // ---- Parse top-level services block ----
  const servicesBlock = extractTopLevelBlock(content, "services");
  if (!servicesBlock) {
    warnings.push("No 'services' section found in docker-compose file");
    return { components, connections, warnings, resourceCount };
  }

  const serviceNames = extractServiceNames(servicesBlock);
  const positions = new Map<string, { x: number; y: number }>();
  let fallbackCol = 8;

  // depends_on relationships: source → [targets]
  const dependsOnMap = new Map<string, string[]>();

  for (const svcName of serviceNames) {
    resourceCount++;
    const svcBlock = extractServiceBlock(servicesBlock, svcName, serviceNames);

    // Extract image
    const image = extractScalar(svcBlock, "image") || svcName;

    // Map image to component type
    const mapping = inferTypeFromImage(image);
    const componentType = mapping?.type ?? "CONTAINER";
    const category = mapping?.category ?? "compute";

    // Auto-layout
    const colIndex = CATEGORY_COL[category] ?? fallbackCol++;
    const x = colIndex * 250 + 100;
    const existingInCol = [...positions.values()].filter(
      (p) => p.x === x,
    ).length;
    const y = existingInCol * 160 + 100;

    const compId = `service-${svcName}`;
    positions.set(compId, { x, y });

    // Extract ports
    const ports = extractPortsList(svcBlock);

    // Extract environment variable keys (names only, not values for security)
    const envKeys = extractEnvKeys(svcBlock);

    // Extract depends_on
    const deps = extractDependsOn(svcBlock);
    if (deps.length > 0) {
      dependsOnMap.set(svcName, deps);
    }

    const properties: Record<string, unknown> = { image };
    if (ports.length > 0) properties.ports = ports;
    if (envKeys.length > 0) properties.envVars = envKeys;

    components.push({
      id: compId,
      name: humanizeName(svcName),
      type: componentType,
      image,
      properties,
      position: { x, y },
    });
  }

  // ---- Parse named volumes as DATA_STORE components ----
  const volumesBlock = extractTopLevelBlock(content, "volumes");
  if (volumesBlock) {
    const volumeNames = extractVolumeNames(volumesBlock);
    for (const volName of volumeNames) {
      if (!volName.trim()) continue;
      resourceCount++;

      const colIndex = CATEGORY_COL["storage"] ?? fallbackCol++;
      const x = colIndex * 250 + 100;
      const existingInCol = [...positions.values()].filter(
        (p) => p.x === x,
      ).length;
      const y = existingInCol * 160 + 100;

      const compId = `volume-${volName}`;
      positions.set(compId, { x, y });

      components.push({
        id: compId,
        name: humanizeName(volName) + " Volume",
        type: "DATA_STORE",
        image: "",
        properties: { volumeName: volName },
        position: { x, y },
      });
    }
  }

  // ---- Infer connections from depends_on ----
  for (const [source, targets] of dependsOnMap) {
    const sourceComp = components.find((c) => c.id === `service-${source}`);
    if (!sourceComp) continue;

    for (const target of targets) {
      const targetComp = components.find((c) => c.id === `service-${target}`);
      if (!targetComp) continue;

      connections.push({
        id: `${sourceComp.id}-${targetComp.id}`,
        source: sourceComp.id,
        target: targetComp.id,
        label: "depends on",
        protocol: inferProtocol(sourceComp.type, targetComp.type),
        encrypted: inferEncryption(sourceComp.type, targetComp.type),
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
    "Docker Compose parsing complete",
  );

  return { components, connections, warnings, resourceCount };
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Extract the indented block following a top-level key.
 */
function extractTopLevelBlock(content: string, key: string): string | null {
  const pattern = new RegExp(`^${key}:[ \t\r]*$`, "m");
  const match = content.match(pattern);
  if (!match || match.index === undefined) return null;

  const afterKey = content.slice(match.index + match[0].length);
  const lines = afterKey.split("\n");
  const blockLines: string[] = [];

  for (const line of lines) {
    // Stop when we reach another top-level key (no leading whitespace, not empty)
    if (line && !/^[ \t\r]/.test(line) && !/^#/.test(line)) break;
    blockLines.push(line);
  }

  return blockLines.join("\n");
}

/**
 * Extract service names from the services block.
 * Service names appear as keys at the first indentation level (2 spaces).
 */
function extractServiceNames(servicesBlock: string): string[] {
  const names: string[] = [];
  // Match lines that are indented exactly 2 spaces followed by a name and colon
  const pattern = /^ {2}([a-zA-Z0-9_-]+):[ \t\r]*$/gm;
  let match;
  while ((match = pattern.exec(servicesBlock)) !== null) {
    names.push(match[1]!);
  }
  return names;
}

/**
 * Extract the YAML block for a specific service name.
 * Extracts content between the service name and the next service at the same indent.
 */
function extractServiceBlock(
  servicesBlock: string,
  svcName: string,
  allNames: string[],
): string {
  const startPattern = new RegExp(`^  ${svcName}:[ \t\r]*$`, "m");
  const startMatch = servicesBlock.match(startPattern);
  if (!startMatch || startMatch.index === undefined) return "";

  const afterStart = servicesBlock.slice(
    startMatch.index + startMatch[0].length,
  );
  const lines = afterStart.split("\n");
  const blockLines: string[] = [];

  for (const line of lines) {
    // Stop at the next service name (same 2-space indent)
    const isNextService = allNames.some(
      (n) => n !== svcName && new RegExp(`^  ${n}:[ \t\r]*$`).test(line),
    );
    if (isNextService) break;
    blockLines.push(line);
  }

  return blockLines.join("\n");
}

function extractScalar(block: string, key: string): string | null {
  const pattern = new RegExp(`^[ \t\r]*${key}:[ \t\r]*(.+)$`, "m");
  const match = block.match(pattern);
  return match ? match[1]!.trim().replace(/^["']|["']$/g, "") : null;
}

/**
 * Extract ports list from a service block.
 * Handles short ("8080:80") and long form (target: 80).
 */
function extractPortsList(svcBlock: string): string[] {
  const ports: string[] = [];
  // Short form: - "8080:80" or - 8080:80
  const shortPattern = /^[ \t\r]+-[ \t\r]+["']?(\d+(?::\d+)?)["']?[ \t\r]*$/gm;
  let match;
  while ((match = shortPattern.exec(svcBlock)) !== null) {
    ports.push(match[1]!);
  }
  // Long form: target: 80
  const longPattern = /target:[ \t\r]*(\d+)/g;
  while ((match = longPattern.exec(svcBlock)) !== null) {
    ports.push(match[1]!);
  }
  return [...new Set(ports)];
}

/**
 * Extract environment variable keys (not values) from a service block.
 */
function extractEnvKeys(svcBlock: string): string[] {
  const keys: string[] = [];
  // - KEY=value or KEY: value
  const pattern = /^[ \t]+-?[ \t]*([A-Z_][A-Z0-9_]*)[=:]/gm;
  let match;
  while ((match = pattern.exec(svcBlock)) !== null) {
    keys.push(match[1]!);
  }
  return [...new Set(keys)];
}

/**
 * Extract depends_on service names from a service block.
 */
function extractDependsOn(svcBlock: string): string[] {
  const deps: string[] = [];

  // Find the depends_on section
  const sectionMatch = svcBlock.match(/^[ \t\r]*depends_on:[ \t\r]*$/m);
  if (!sectionMatch || sectionMatch.index === undefined) return deps;

  const afterSection = svcBlock.slice(
    sectionMatch.index + sectionMatch[0].length,
  );
  const lines = afterSection.split("\n");

  for (const line of lines) {
    if (!line.trim()) continue;
    // Stop at next key at same or lesser indent
    if (/^[ \t\r]{0,4}[a-zA-Z]/.test(line) && !/^[ \t\r]{6,}/.test(line)) {
      // Check if it's a list item or a sub-key of depends_on
      const listItem = line.match(/^[ \t\r]+-[ \t\r]+([a-zA-Z0-9_-]+)/);
      const conditionKey = line.match(/^[ \t\r]+([a-zA-Z0-9_-]+):[ \t\r]*$/);

      if (listItem) {
        deps.push(listItem[1]!);
      } else if (conditionKey) {
        // Long form: service_name: condition: service_healthy
        deps.push(conditionKey[1]!);
      } else {
        break;
      }
    }
  }

  return deps;
}

/**
 * Extract named volume names from the volumes block.
 * Top-level volume names appear as first-level keys.
 */
function extractVolumeNames(volumesBlock: string): string[] {
  const names: string[] = [];
  const pattern = /^ {2}([a-zA-Z0-9_-]+):/gm;
  let match;
  while ((match = pattern.exec(volumesBlock)) !== null) {
    names.push(match[1]!);
  }
  return names;
}

function inferTypeFromImage(
  image: string,
): { type: string; category: string } | null {
  // Strip registry prefix and tag: registry.example.com/library/postgres:14 → postgres
  const imageName = image.split("/").pop()?.split(":")[0] ?? image;

  for (const entry of IMAGE_TYPE_MAP) {
    if (entry.pattern.test(imageName) || entry.pattern.test(image)) {
      return { type: entry.type, category: entry.category };
    }
  }
  return null;
}

function inferProtocol(sourceType: string, targetType: string): string {
  if (targetType === "DATABASE") return "TCP";
  if (targetType === "CACHE") return "TCP";
  if (targetType === "QUEUE") return "AMQP";
  if (sourceType === "LOAD_BALANCER") return "HTTPS";
  return "HTTP";
}

function inferEncryption(sourceType: string, targetType: string): boolean {
  if (sourceType === "LOAD_BALANCER") return true;
  if (targetType === "SECRETS_MANAGER") return true;
  return false;
}

function humanizeName(name: string): string {
  return name
    .replace(/-/g, " ")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
