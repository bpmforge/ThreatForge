import type { ExtractedComponentType } from "../../types";

export interface DockerService {
  name: string;
  image?: string;
  ports?: string[];
  dependsOn?: string[];
  networks?: string[];
}

export function inferTypeFromImage(image: string): ExtractedComponentType {
  const lower = image.toLowerCase();
  if (
    lower.includes("postgres") ||
    lower.includes("mysql") ||
    lower.includes("mariadb") ||
    lower.includes("mongo") ||
    lower.includes("cassandra") ||
    lower.includes("cockroach")
  )
    return "database";
  if (lower.includes("redis") || lower.includes("memcached")) return "cache";
  if (
    lower.includes("rabbitmq") ||
    lower.includes("kafka") ||
    lower.includes("nats") ||
    lower.includes("activemq")
  )
    return "queue";
  if (
    lower.includes("nginx") ||
    lower.includes("traefik") ||
    lower.includes("haproxy") ||
    lower.includes("caddy")
  )
    return "loadBalancer";
  if (
    lower.includes("keycloak") ||
    lower.includes("vault") ||
    lower.includes("auth0") ||
    lower.includes("dex")
  )
    return "authService";
  if (lower.includes("minio") || lower.includes("s3")) return "storage";
  if (
    lower.includes("elasticsearch") ||
    lower.includes("opensearch") ||
    lower.includes("solr")
  )
    return "database";
  if (
    lower.includes("grafana") ||
    lower.includes("prometheus") ||
    lower.includes("jaeger") ||
    lower.includes("zipkin")
  )
    return "externalService";
  return "service";
}

export function hasExternalPorts(ports: string[]): boolean {
  return ports.some((p) => p.split(":").length === 2);
}

export function parseComposeYaml(content: string): {
  services: Record<string, DockerService>;
  networks: string[];
} {
  const services: Record<string, DockerService> = {};
  const networkNames: string[] = [];
  const lines = content.split("\n");
  let inServices = false;
  let inNetworks = false;
  let currentService: string | null = null;
  let inDependsOn = false;
  let inPorts = false;
  let inNetworkSection = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const indent = line.match(/^(\s*)/)?.[1].length ?? 0;

    if (indent === 0) {
      inServices = trimmed.startsWith("services:");
      inNetworks = trimmed.startsWith("networks:");
      inDependsOn = false;
      inPorts = false;
      inNetworkSection = false;
      continue;
    }

    if (inNetworks && indent === 2 && !trimmed.startsWith("-")) {
      const netName = trimmed.replace(":", "").trim();
      if (netName) networkNames.push(netName);
      continue;
    }

    if (!inServices) continue;

    if (indent === 2 && !trimmed.startsWith("-")) {
      currentService = trimmed.replace(":", "").trim();
      services[currentService] = {
        name: currentService,
        ports: [],
        dependsOn: [],
        networks: [],
      };
      inDependsOn = false;
      inPorts = false;
      inNetworkSection = false;
      continue;
    }

    if (!currentService) continue;
    const svc = services[currentService];

    if (indent === 4) {
      inDependsOn = trimmed.startsWith("depends_on:");
      inPorts = trimmed.startsWith("ports:");
      inNetworkSection = trimmed.startsWith("networks:");
      if (trimmed.startsWith("image:")) {
        svc.image = trimmed.replace("image:", "").trim().replace(/['"]/g, "");
      }
      continue;
    }

    if (indent >= 6 && trimmed.startsWith("-")) {
      const value = trimmed.slice(1).trim().replace(/['"]/g, "");
      if (inDependsOn) svc.dependsOn?.push(value.split(":")[0]);
      if (inPorts) svc.ports?.push(value);
      if (inNetworkSection) svc.networks?.push(value);
      continue;
    }

    if (inDependsOn && indent === 6 && !trimmed.startsWith("-")) {
      const depName = trimmed.split(":")[0].trim();
      if (depName) svc.dependsOn?.push(depName);
    }
  }

  return { services, networks: networkNames };
}
