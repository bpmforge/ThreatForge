/**
 * Kubernetes Parser
 *
 * Parses Kubernetes YAML manifests and extracts infrastructure components
 * for threat model generation. Maps K8s resource kinds to threat model
 * component types.
 *
 * Supports: Deployments, StatefulSets, DaemonSets, Services, Ingress,
 *           PersistentVolumeClaims, NetworkPolicies, ServiceAccounts,
 *           ConfigMaps, Secrets.
 *
 * Works offline — pure text/regex parsing, no YAML library needed.
 */
import logger from "../../utils/logger.js";

interface KubernetesComponent {
  id: string;
  name: string;
  type: string; // FTM component type
  k8sKind: string; // Original Kubernetes kind
  namespace: string;
  properties: Record<string, unknown>;
  position: { x: number; y: number };
}

interface KubernetesConnection {
  id: string;
  source: string;
  target: string;
  label?: string;
  protocol?: string;
  encrypted?: boolean;
}

export interface KubernetesParseResult {
  components: KubernetesComponent[];
  connections: KubernetesConnection[];
  warnings: string[];
  resourceCount: number;
}

// =============================================================================
// Kind → Component Type Mapping
// =============================================================================

const KIND_MAP: Record<string, { type: string; category: string }> = {
  Deployment: { type: "CONTAINER", category: "compute" },
  StatefulSet: { type: "CONTAINER", category: "compute" },
  DaemonSet: { type: "CONTAINER", category: "compute" },
  ReplicaSet: { type: "CONTAINER", category: "compute" },
  Pod: { type: "CONTAINER", category: "compute" },
  Job: { type: "CONTAINER", category: "compute" },
  CronJob: { type: "CONTAINER", category: "compute" },
  Service: { type: "LOAD_BALANCER", category: "networking" }, // refined below
  Ingress: { type: "API_GATEWAY", category: "networking" },
  IngressClass: { type: "API_GATEWAY", category: "networking" },
  PersistentVolumeClaim: { type: "DATA_STORE", category: "storage" },
  PersistentVolume: { type: "DATA_STORE", category: "storage" },
  NetworkPolicy: { type: "FIREWALL", category: "security" },
  ServiceAccount: { type: "IAM", category: "security" },
  ClusterRole: { type: "IAM", category: "security" },
  ClusterRoleBinding: { type: "IAM", category: "security" },
  Role: { type: "IAM", category: "security" },
  RoleBinding: { type: "IAM", category: "security" },
};

// Kinds we track but skip creating components for
const REFERENCE_ONLY_KINDS = new Set(["ConfigMap", "Secret"]);

// Category → column index for auto-layout
const CATEGORY_COL: Record<string, number> = {
  networking: 0,
  security: 1,
  compute: 2,
  storage: 3,
  messaging: 4,
};

// =============================================================================
// Parser
// =============================================================================

/**
 * Parse Kubernetes YAML content (single or multi-document with --- separators).
 */
export function parseKubernetes(content: string): KubernetesParseResult {
  const components: KubernetesComponent[] = [];
  const connections: KubernetesConnection[] = [];
  const warnings: string[] = [];
  let resourceCount = 0;

  // Track reference-only resources (ConfigMaps, Secrets)
  const referenceResources = new Map<string, string>(); // name → kind

  // Track service type annotations for connection inference
  const serviceTypes = new Map<string, string>(); // name → type (ClusterIP, NodePort, LoadBalancer)
  const serviceSelectors = new Map<string, Record<string, string>>(); // service name → selector labels
  const workloadLabels = new Map<string, Record<string, string>>(); // workload name → labels

  // Track ingress rules for connections
  const ingressRules = new Map<string, string[]>(); // ingress name → service names

  // Split on YAML document separators
  const documents = content.split(/^---\s*$/m).filter((doc) => doc.trim());

  const positions = new Map<string, { x: number; y: number }>();
  let fallbackCol = 5;

  for (const doc of documents) {
    if (!doc.trim()) continue;

    const kind = extractScalar(doc, "kind");
    const name = extractNestedScalar(doc, "metadata", "name");
    const namespace =
      extractNestedScalar(doc, "metadata", "namespace") || "default";

    if (!kind || !name) continue;

    resourceCount++;

    // Reference-only: track but skip creating a component
    if (REFERENCE_ONLY_KINDS.has(kind)) {
      referenceResources.set(name, kind);
      continue;
    }

    const mapping = KIND_MAP[kind];
    if (!mapping) {
      warnings.push(`Unknown Kubernetes kind: ${kind} (${name})`);
      continue;
    }

    // Refine Service type: LoadBalancer type → LOAD_BALANCER, ClusterIP/NodePort → API_GATEWAY
    let componentType = mapping.type;
    if (kind === "Service") {
      const serviceType =
        extractNestedScalar(doc, "spec", "type") || "ClusterIP";
      serviceTypes.set(name, serviceType);
      componentType =
        serviceType === "LoadBalancer" ? "LOAD_BALANCER" : "API_GATEWAY";

      // Extract selector labels for connection inference
      const selectors = extractLabels(doc, "spec.selector");
      if (Object.keys(selectors).length > 0) {
        serviceSelectors.set(name, selectors);
      }
    }

    // Extract workload labels for matching with services
    if (
      ["Deployment", "StatefulSet", "DaemonSet", "ReplicaSet", "Pod"].includes(
        kind,
      )
    ) {
      const labels = extractLabels(doc, "spec.template.metadata.labels");
      if (Object.keys(labels).length > 0) {
        workloadLabels.set(name, labels);
      }
    }

    // Extract ingress rules: backend service names
    if (kind === "Ingress") {
      const backendServices = extractIngressBackends(doc);
      if (backendServices.length > 0) {
        ingressRules.set(name, backendServices);
      }
    }

    // Auto-layout: grid by category
    const x = (CATEGORY_COL[mapping.category] ?? fallbackCol++) * 250 + 100;
    const existingInCol = [...positions.values()].filter(
      (p) => p.x === x,
    ).length;
    const y = existingInCol * 160 + 100;

    const compId = `${kind.toLowerCase()}-${namespace}-${name}`;
    positions.set(compId, { x, y });

    // Extract container images from workloads
    const images = extractContainerImages(doc);
    const properties: Record<string, unknown> = { kind, namespace };
    if (images.length > 0) properties.images = images;

    // Extract ports
    const ports = extractPorts(doc);
    if (ports.length > 0) properties.ports = ports;

    components.push({
      id: compId,
      name: humanizeName(name),
      type: componentType,
      k8sKind: kind,
      namespace,
      properties,
      position: { x, y },
    });
  }

  // =============================================================================
  // Infer connections
  // =============================================================================

  // 1. Service selectors → matching Deployment/StatefulSet/DaemonSet labels
  for (const [svcName, selectors] of serviceSelectors) {
    const svcComp = components.find(
      (c) => c.k8sKind === "Service" && c.name === humanizeName(svcName),
    );
    if (!svcComp) continue;

    for (const [workloadName, labels] of workloadLabels) {
      if (labelsMatch(selectors, labels)) {
        const workloadComp = components.find(
          (c) => c.name === humanizeName(workloadName),
        );
        if (workloadComp && workloadComp.id !== svcComp.id) {
          connections.push({
            id: `${svcComp.id}-${workloadComp.id}`,
            source: svcComp.id,
            target: workloadComp.id,
            label: "routes to",
            protocol: "TCP",
            encrypted: false,
          });
        }
      }
    }
  }

  // 2. Ingress rules → Services
  for (const [ingressName, serviceNames] of ingressRules) {
    const ingressComp = components.find(
      (c) => c.k8sKind === "Ingress" && c.name === humanizeName(ingressName),
    );
    if (!ingressComp) continue;

    for (const svcName of serviceNames) {
      const svcComp = components.find(
        (c) => c.k8sKind === "Service" && c.name === humanizeName(svcName),
      );
      if (svcComp) {
        connections.push({
          id: `${ingressComp.id}-${svcComp.id}`,
          source: ingressComp.id,
          target: svcComp.id,
          label: "routes to",
          protocol: "HTTPS",
          encrypted: true,
        });
      }
    }
  }

  logger.info(
    {
      resources: resourceCount,
      components: components.length,
      connections: connections.length,
      warnings: warnings.length,
      referenceResources: referenceResources.size,
    },
    "Kubernetes parsing complete",
  );

  return { components, connections, warnings, resourceCount };
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Extract a top-level scalar field from a YAML document.
 * e.g. extractScalar(doc, "kind") → "Deployment"
 */
function extractScalar(doc: string, key: string): string | null {
  const pattern = new RegExp(`^${key}:\\s*(.+)$`, "m");
  const match = doc.match(pattern);
  return match ? match[1]!.trim().replace(/^["']|["']$/g, "") : null;
}

/**
 * Extract a scalar nested one level deep: parentKey:\n  childKey: value
 */
function extractNestedScalar(
  doc: string,
  parentKey: string,
  childKey: string,
): string | null {
  // Match parent key, then look for child within the next indented block
  const parentPattern = new RegExp(`^${parentKey}:`, "m");
  const parentMatch = doc.match(parentPattern);
  if (!parentMatch || parentMatch.index === undefined) return null;

  const afterParent = doc.slice(parentMatch.index);
  const childPattern = new RegExp(`^\\s+${childKey}:\\s*(.+)$`, "m");
  const childMatch = afterParent.match(childPattern);
  return childMatch ? childMatch[1]!.trim().replace(/^["']|["']$/g, "") : null;
}

/**
 * Extract label key/value pairs from a dotted path like "spec.selector".
 * Returns the key:value map of labels defined under that path.
 */
function extractLabels(doc: string, path: string): Record<string, string> {
  const labels: Record<string, string> = {};
  const parts = path.split(".");
  const lastKey = parts[parts.length - 1]!;

  // Find the label section by looking for the last key and reading indented lines
  const pattern = new RegExp(`^(\\s*)${lastKey}:\\s*$`, "m");
  const match = doc.match(pattern);
  if (!match || match.index === undefined) return labels;

  const baseIndent = match[1]!.length;
  const afterKey = doc.slice(match.index + match[0].length);
  const lines = afterKey.split("\n");

  for (const line of lines) {
    if (!line.trim()) continue;
    const lineIndent = line.match(/^(\s*)/)?.[1]?.length ?? 0;
    if (lineIndent <= baseIndent) break; // out of the block

    const kvMatch = line.match(/^\s+([^:]+):\s*(.+)$/);
    if (kvMatch) {
      labels[kvMatch[1]!.trim()] = kvMatch[2]!
        .trim()
        .replace(/^["']|["']$/g, "");
    }
  }

  return labels;
}

/**
 * Extract container image names from a workload spec.
 */
function extractContainerImages(doc: string): string[] {
  const images: string[] = [];
  const pattern = /^\s+image:\s*(.+)$/gm;
  let match;
  while ((match = pattern.exec(doc)) !== null) {
    const image = match[1]!.trim().replace(/^["']|["']$/g, "");
    if (!images.includes(image)) images.push(image);
  }
  return images;
}

/**
 * Extract container port numbers from a spec.
 */
function extractPorts(doc: string): number[] {
  const ports: number[] = [];
  const pattern = /(?:containerPort|port|targetPort):\s*(\d+)/g;
  let match;
  while ((match = pattern.exec(doc)) !== null) {
    const port = parseInt(match[1]!, 10);
    if (!isNaN(port) && !ports.includes(port)) ports.push(port);
  }
  return ports;
}

/**
 * Extract backend service names referenced in an Ingress spec.
 */
function extractIngressBackends(doc: string): string[] {
  const services: string[] = [];
  // v1 Ingress: spec.rules[].http.paths[].backend.service.name
  const v1Pattern = /service:\s*\n\s+name:\s*(.+)/g;
  let match;
  while ((match = v1Pattern.exec(doc)) !== null) {
    const svc = match[1]!.trim().replace(/^["']|["']$/g, "");
    if (!services.includes(svc)) services.push(svc);
  }

  // extensions/v1beta1: serviceName: foo
  const betaPattern = /serviceName:\s*(.+)/g;
  while ((match = betaPattern.exec(doc)) !== null) {
    const svc = match[1]!.trim().replace(/^["']|["']$/g, "");
    if (!services.includes(svc)) services.push(svc);
  }

  return services;
}

/**
 * Returns true if all selector key/values exist in the labels map.
 */
function labelsMatch(
  selector: Record<string, string>,
  labels: Record<string, string>,
): boolean {
  return Object.entries(selector).every(([k, v]) => labels[k] === v);
}

function humanizeName(k8sName: string): string {
  return k8sName
    .replace(/-/g, " ")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
