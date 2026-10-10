/**
 * Interface Presets - Common interface configurations for component types.
 * These presets enable quick setup of realistic network configurations.
 */
import type { ComponentInterface, ComponentType } from "@/types/canvas";

/** Preset interface configurations for common component types */
export const INTERFACE_PRESETS: Partial<
  Record<ComponentType, Omit<ComponentInterface, "id">[]>
> = {
  // Web Applications
  WEB_APP: [
    {
      name: "Public HTTPS",
      direction: "ingress",
      position: "left",
      port: 443,
      protocol: "HTTPS",
      authentication: "OAuth2",
      encrypted: true,
      externallyAccessible: true,
    },
    {
      name: "Database",
      direction: "egress",
      position: "right",
      port: 5432,
      protocol: "PostgreSQL",
      authentication: "Basic",
      encrypted: true,
    },
  ],

  // API / Microservices
  API: [
    {
      name: "API Endpoint",
      direction: "ingress",
      position: "left",
      port: 443,
      protocol: "HTTPS",
      authentication: "JWT",
      encrypted: true,
      externallyAccessible: true,
    },
    {
      name: "Backend Services",
      direction: "egress",
      position: "right",
      protocol: "gRPC",
      authentication: "mTLS",
      encrypted: true,
    },
  ],

  MICROSERVICE: [
    {
      name: "gRPC API",
      direction: "ingress",
      position: "left",
      port: 50051,
      protocol: "gRPC",
      authentication: "mTLS",
      encrypted: true,
    },
    {
      name: "Health Check",
      direction: "ingress",
      position: "top",
      port: 8080,
      protocol: "HTTP",
      authentication: "None",
      encrypted: false,
    },
    {
      name: "Database",
      direction: "egress",
      position: "right",
      protocol: "PostgreSQL",
      authentication: "Basic",
      encrypted: true,
    },
  ],

  // API Gateway
  API_GATEWAY: [
    {
      name: "External API",
      direction: "ingress",
      position: "left",
      port: 443,
      protocol: "HTTPS",
      authentication: "API_KEY",
      encrypted: true,
      externallyAccessible: true,
    },
    {
      name: "Admin API",
      direction: "ingress",
      position: "left",
      port: 8443,
      protocol: "HTTPS",
      authentication: "mTLS",
      encrypted: true,
      externallyAccessible: false,
    },
    {
      name: "Backend Services",
      direction: "egress",
      position: "right",
      protocol: "gRPC",
      authentication: "mTLS",
      encrypted: true,
    },
  ],

  // Databases
  DATABASE: [
    {
      name: "Primary Connection",
      direction: "ingress",
      position: "left",
      port: 5432,
      protocol: "PostgreSQL",
      authentication: "Basic",
      encrypted: true,
      dataClassifications: ["PII", "Financial"],
    },
  ],

  // Load Balancer
  LOAD_BALANCER: [
    {
      name: "Public Traffic",
      direction: "ingress",
      position: "left",
      port: 443,
      protocol: "HTTPS",
      authentication: "None",
      encrypted: true,
      externallyAccessible: true,
    },
    {
      name: "Backend Pool",
      direction: "egress",
      position: "right",
      protocol: "HTTP",
      authentication: "None",
      encrypted: false,
    },
  ],

  // Cache
  CACHE: [
    {
      name: "Cache Connection",
      direction: "ingress",
      position: "left",
      port: 6379,
      protocol: "Redis",
      authentication: "Basic",
      encrypted: false,
    },
  ],

  // Queue
  QUEUE: [
    {
      name: "Producer",
      direction: "ingress",
      position: "left",
      protocol: "AMQP",
      authentication: "Basic",
      encrypted: true,
    },
    {
      name: "Consumer",
      direction: "egress",
      position: "right",
      protocol: "AMQP",
      authentication: "Basic",
      encrypted: true,
    },
  ],

  // Actor/External Entity (User-facing)
  ACTOR: [
    {
      name: "User Access",
      direction: "egress",
      position: "right",
      protocol: "HTTPS",
      authentication: "OAuth2",
      encrypted: true,
      externallyAccessible: true,
    },
  ],

  EXTERNAL_ENTITY: [
    {
      name: "External API",
      direction: "bidirectional",
      position: "right",
      protocol: "HTTPS",
      authentication: "API_KEY",
      encrypted: true,
      externallyAccessible: true,
    },
  ],

  // Serverless
  SERVERLESS: [
    {
      name: "HTTP Trigger",
      direction: "ingress",
      position: "left",
      protocol: "HTTPS",
      authentication: "JWT",
      encrypted: true,
    },
    {
      name: "Event Trigger",
      direction: "ingress",
      position: "top",
      protocol: "Custom",
      authentication: "None",
      encrypted: true,
    },
  ],

  // Auth Service
  AUTH_SERVICE: [
    {
      name: "Auth API",
      direction: "ingress",
      position: "left",
      port: 443,
      protocol: "HTTPS",
      authentication: "None",
      encrypted: true,
      dataClassifications: ["Credentials"],
    },
    {
      name: "User Database",
      direction: "egress",
      position: "right",
      protocol: "PostgreSQL",
      authentication: "Basic",
      encrypted: true,
      dataClassifications: ["Credentials", "PII"],
    },
  ],
};

/**
 * Generate interfaces with unique IDs from a preset
 */
export function generateInterfacesFromPreset(
  componentType: ComponentType,
): ComponentInterface[] {
  const preset = INTERFACE_PRESETS[componentType];
  if (!preset) return [];

  return preset.map((iface, index) => ({
    ...iface,
    id: `${componentType.toLowerCase()}-${iface.name.toLowerCase().replace(/\s+/g, "-")}-${index}`,
  }));
}
