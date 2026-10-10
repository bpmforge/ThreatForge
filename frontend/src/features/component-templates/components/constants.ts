/**
 * Component Template Manager constants.
 */
import type { ComponentType } from "../types";

export const COMPONENT_TYPE_OPTIONS: { value: ComponentType; label: string }[] =
  [
    { value: "EXTERNAL_USER", label: "External User" },
    { value: "INTERNAL_USER", label: "Internal User" },
    { value: "EXTERNAL_SYSTEM", label: "External System" },
    { value: "SERVICE", label: "Service" },
    { value: "API", label: "API" },
    { value: "FUNCTION", label: "Function" },
    { value: "PROCESS", label: "Process" },
    { value: "DATABASE", label: "Database" },
    { value: "FILE_STORAGE", label: "File Storage" },
    { value: "CACHE", label: "Cache" },
    { value: "QUEUE", label: "Queue" },
    { value: "LOAD_BALANCER", label: "Load Balancer" },
    { value: "FIREWALL", label: "Firewall" },
    { value: "API_GATEWAY", label: "API Gateway" },
  ];
