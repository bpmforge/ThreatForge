/**
 * Docker Compose Parser — pure structural parsing, no AI required.
 */
import type {
  ExtractedArchitecture,
  ExtractedComponent,
  ExtractedDataFlow,
  ExtractedBoundary,
} from "../../types";
import {
  inferTypeFromImage,
  hasExternalPorts,
  parseComposeYaml,
} from "./docker-compose-helpers";

export function parseDockerCompose(content: string): ExtractedArchitecture {
  const { services, networks } = parseComposeYaml(content);
  const serviceNames = Object.keys(services);

  if (serviceNames.length === 0) {
    return {
      components: [],
      dataFlows: [],
      boundaries: [],
      technologies: [],
      dataTypes: [],
      confidence: 0.1,
      warnings: ["No services found in docker-compose file"],
    };
  }

  const components: ExtractedComponent[] = [];
  const technologies: string[] = [];

  for (const [, svc] of Object.entries(services)) {
    const type = svc.image ? inferTypeFromImage(svc.image) : "service";
    const tech = svc.image?.split(":")[0].split("/").pop();
    if (tech && !technologies.includes(tech)) technologies.push(tech);

    const isPublic = hasExternalPorts(svc.ports ?? []);
    components.push({
      id: `dc-${svc.name}`,
      name: svc.name
        .replace(/[-_]/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase()),
      type,
      description: svc.image ? `Image: ${svc.image}` : `Service: ${svc.name}`,
      technology: tech,
      trustLevel: isPublic ? "PUBLIC" : "INTERNAL",
      confidence: 0.85,
      selected: true,
    });
  }

  const dataFlows: ExtractedDataFlow[] = [];
  for (const [, svc] of Object.entries(services)) {
    for (const dep of svc.dependsOn ?? []) {
      if (services[dep]) {
        dataFlows.push({
          id: `flow-${svc.name}-${dep}`,
          sourceId: `dc-${svc.name}`,
          targetId: `dc-${dep}`,
          label: "depends on",
          confidence: 0.9,
          selected: true,
        });
      }
    }
  }

  const boundaries: ExtractedBoundary[] = [];
  const internalComponents = components
    .filter((c) => c.trustLevel !== "PUBLIC")
    .map((c) => c.id);
  const publicComponents = components
    .filter((c) => c.trustLevel === "PUBLIC")
    .map((c) => c.id);

  if (internalComponents.length > 0) {
    boundaries.push({
      id: "dc-internal",
      name: "Internal Network",
      type: "network",
      trustLevel: "INTERNAL",
      componentIds: internalComponents,
      description: "Services on internal Docker network",
      confidence: 0.85,
      selected: true,
    });
  }

  if (publicComponents.length > 0) {
    boundaries.push({
      id: "dc-public",
      name: "Public Zone",
      type: "network",
      trustLevel: "PUBLIC",
      componentIds: publicComponents,
      description: "Services with exposed ports",
      confidence: 0.85,
      selected: true,
    });
  }

  for (const netName of networks) {
    const networkedServices = Object.values(services)
      .filter((s) => s.networks?.includes(netName))
      .map((s) => `dc-${s.name}`);
    if (networkedServices.length > 1) {
      boundaries.push({
        id: `dc-net-${netName}`,
        name: `Network: ${netName}`,
        type: "network",
        trustLevel: "INTERNAL",
        componentIds: networkedServices,
        description: `Docker network: ${netName}`,
        confidence: 0.8,
        selected: false,
      });
    }
  }

  return {
    components,
    dataFlows,
    boundaries,
    technologies,
    dataTypes: [],
    confidence: 0.82,
    warnings: [],
  };
}
