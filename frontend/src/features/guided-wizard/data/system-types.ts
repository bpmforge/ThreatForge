import type { SystemType } from "../types";
import type { ComponentType } from "@/types/canvas";

interface SystemTemplate {
  name: string;
  description: string;
  icon: string;
  defaultComponents: { type: ComponentType; name: string }[];
}

export const SYSTEM_TEMPLATES: Record<SystemType, SystemTemplate> = {
  "web-application": {
    name: "Web Application",
    description: "Frontend + backend web app",
    icon: "Globe",
    defaultComponents: [
      { type: "ACTOR", name: "User" },
      { type: "WEB_APP", name: "Web Frontend" },
      { type: "API", name: "Backend API" },
      { type: "DATABASE", name: "Database" },
    ],
  },
  "mobile-app": {
    name: "Mobile App",
    description: "iOS/Android application",
    icon: "Smartphone",
    defaultComponents: [
      { type: "ACTOR", name: "User" },
      { type: "MOBILE_APP", name: "Mobile App" },
      { type: "API", name: "Backend API" },
      { type: "DATABASE", name: "Database" },
    ],
  },
  "api-microservices": {
    name: "API / Microservices",
    description: "API-first architecture",
    icon: "Network",
    defaultComponents: [
      { type: "EXTERNAL_ENTITY", name: "API Client" },
      { type: "API_GATEWAY", name: "API Gateway" },
      { type: "MICROSERVICE", name: "Service A" },
      { type: "MICROSERVICE", name: "Service B" },
      { type: "DATABASE", name: "Database" },
    ],
  },
  "desktop-application": {
    name: "Desktop App",
    description: "Native desktop application",
    icon: "Monitor",
    defaultComponents: [
      { type: "ACTOR", name: "User" },
      { type: "DESKTOP_APP", name: "Desktop App" },
      { type: "API", name: "Backend API" },
    ],
  },
  "iot-system": {
    name: "IoT System",
    description: "Connected devices",
    icon: "Cpu",
    defaultComponents: [
      { type: "EXTERNAL_ENTITY", name: "IoT Device" },
      { type: "API_GATEWAY", name: "IoT Gateway" },
      { type: "MICROSERVICE", name: "Device Service" },
      { type: "DATABASE", name: "Time Series DB" },
    ],
  },
  "data-pipeline": {
    name: "Data Pipeline",
    description: "ETL/data processing",
    icon: "GitBranch",
    defaultComponents: [
      { type: "EXTERNAL_ENTITY", name: "Data Source" },
      { type: "QUEUE", name: "Message Queue" },
      { type: "MICROSERVICE", name: "Processor" },
      { type: "DATABASE", name: "Data Warehouse" },
    ],
  },
  "saas-platform": {
    name: "SaaS Platform",
    description: "Multi-tenant SaaS",
    icon: "Cloud",
    defaultComponents: [
      { type: "ACTOR", name: "Tenant User" },
      { type: "WEB_APP", name: "SaaS Frontend" },
      { type: "API_GATEWAY", name: "API Gateway" },
      { type: "AUTH_SERVICE", name: "Auth Service" },
      { type: "MICROSERVICE", name: "Core Service" },
      { type: "DATABASE", name: "Database" },
    ],
  },
};
