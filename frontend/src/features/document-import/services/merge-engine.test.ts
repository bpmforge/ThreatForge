import { describe, it, expect } from "vitest";
import {
  buildMergePlan,
  applyMergePlan,
  canvasHasComponents,
  summarizeExistingComponents,
} from "./merge-engine";
import type { ExtractedArchitecture } from "../types";
import type { GeneratedNode, GeneratedEdge } from "../types";

// Simulate: SRS was imported first, creating these canvas nodes
const existingNodes: GeneratedNode[] = [
  {
    id: "postgresql-db",
    type: "component",
    position: { x: 0, y: 0 },
    data: {
      label: "PostgreSQL Database",
      componentType: "database",
      technology: "PostgreSQL 17",
    },
  },
  {
    id: "kafka-broker",
    type: "component",
    position: { x: 200, y: 0 },
    data: {
      label: "Apache Kafka",
      componentType: "queue",
      technology: "Apache Kafka",
    },
  },
  {
    id: "redis-cache",
    type: "component",
    position: { x: 400, y: 0 },
    data: {
      label: "Redis Cache",
      componentType: "cache",
      technology: "Redis",
    },
  },
  {
    id: "api-gateway",
    type: "component",
    position: { x: 0, y: 200 },
    data: {
      label: "API Gateway",
      componentType: "apiGateway",
      technology: "AWS API Gateway",
    },
  },
  {
    id: "boundary-internal",
    type: "boundary",
    position: { x: 0, y: 0 },
    data: {
      label: "Internal Services",
      trustLevel: "INTERNAL",
    },
  },
];

const existingEdges: GeneratedEdge[] = [
  {
    id: "flow-gateway-to-kafka",
    source: "api-gateway",
    target: "kafka-broker",
    label: "Sensor payloads",
  },
];

// Simulate: SAD uploaded second — describes same system with overlapping components
const sadExtraction: ExtractedArchitecture = {
  components: [
    {
      id: "postgresql-database",
      name: "PostgreSQL",
      type: "database",
      description: "Relational data storage",
      technology: "PostgreSQL",
      confidence: 0.9,
      selected: true,
    },
    {
      id: "kafka-message-broker",
      name: "Apache Kafka",
      type: "queue",
      description: "Message broker for telemetry streaming",
      technology: "Apache Kafka (MSK)",
      confidence: 0.95,
      selected: true,
    },
    {
      id: "redis-caching",
      name: "Redis",
      type: "cache",
      description: "In-memory caching layer",
      technology: "Redis",
      confidence: 0.9,
      selected: true,
    },
    {
      id: "ingestion-service",
      name: "Telemetry Ingestion Service",
      type: "service",
      description: "Validates and ingests sensor data",
      technology: "Go",
      confidence: 0.85,
      selected: true,
    },
    {
      id: "tigr-calculator",
      name: "TIGR Calculator Service",
      type: "service",
      description: "Calculates time in optimal growth range",
      technology: "Python",
      confidence: 0.8,
      selected: true,
    },
    {
      id: "anomaly-detection",
      name: "Anomaly Detection Service",
      type: "service",
      description: "Random Forest anomaly detection",
      technology: "Python/TensorFlow",
      confidence: 0.8,
      selected: true,
    },
  ],
  dataFlows: [
    {
      id: "flow-ingestion-to-kafka",
      sourceId: "ingestion-service",
      targetId: "kafka-message-broker",
      label: "Raw telemetry",
      protocol: "Kafka",
      encrypted: false,
      confidence: 0.9,
      selected: true,
    },
    {
      id: "flow-kafka-to-tigr",
      sourceId: "kafka-message-broker",
      targetId: "tigr-calculator",
      label: "Sensor data points",
      protocol: "Kafka",
      encrypted: false,
      confidence: 0.85,
      selected: true,
    },
    {
      id: "flow-gateway-to-kafka",
      sourceId: "api-gateway",
      targetId: "kafka-message-broker",
      label: "Sensor payloads",
      protocol: "HTTPS",
      encrypted: true,
      confidence: 0.8,
      selected: true,
    },
  ],
  boundaries: [
    {
      id: "internal-services",
      name: "Internal Services",
      type: "trust",
      trustLevel: "INTERNAL",
      componentIds: [
        "ingestion-service",
        "tigr-calculator",
        "anomaly-detection",
        "kafka-message-broker",
      ],
      confidence: 0.85,
      selected: true,
    },
    {
      id: "data-tier",
      name: "Data Tier",
      type: "trust",
      trustLevel: "RESTRICTED",
      componentIds: ["postgresql-database", "redis-caching"],
      confidence: 0.8,
      selected: true,
    },
  ],
  technologies: ["PostgreSQL", "Apache Kafka", "Redis", "Go", "Python"],
  dataTypes: ["internal"],
  confidence: 0.85,
  warnings: [],
};

describe("merge-engine", () => {
  describe("canvasHasComponents", () => {
    it("returns true when canvas has non-boundary nodes", () => {
      expect(
        canvasHasComponents({ nodes: existingNodes, edges: existingEdges }),
      ).toBe(true);
    });

    it("returns false for empty canvas", () => {
      expect(canvasHasComponents({ nodes: [], edges: [] })).toBe(false);
    });

    it("returns false when canvas only has boundaries", () => {
      const boundaryOnly = existingNodes.filter((n) => n.type === "boundary");
      expect(canvasHasComponents({ nodes: boundaryOnly, edges: [] })).toBe(
        false,
      );
    });
  });

  describe("buildMergePlan", () => {
    it("matches PostgreSQL by name and technology", () => {
      const plan = buildMergePlan(sadExtraction, {
        nodes: existingNodes,
        edges: existingEdges,
      });
      const pgCandidate = plan.components.find(
        (c) => c.extracted.id === "postgresql-database",
      );
      expect(pgCandidate).toBeDefined();
      expect(pgCandidate!.action).toBe("update");
      expect(pgCandidate!.matchedNodeId).toBe("postgresql-db");
      expect(pgCandidate!.matchScore).toBeGreaterThan(0.6);
    });

    it("matches Kafka by name", () => {
      const plan = buildMergePlan(sadExtraction, {
        nodes: existingNodes,
        edges: existingEdges,
      });
      const kafkaCandidate = plan.components.find(
        (c) => c.extracted.id === "kafka-message-broker",
      );
      expect(kafkaCandidate).toBeDefined();
      expect(kafkaCandidate!.action).toBe("update");
      expect(kafkaCandidate!.matchedNodeId).toBe("kafka-broker");
    });

    it("matches Redis by name and type", () => {
      const plan = buildMergePlan(sadExtraction, {
        nodes: existingNodes,
        edges: existingEdges,
      });
      const redisCandidate = plan.components.find(
        (c) => c.extracted.id === "redis-caching",
      );
      expect(redisCandidate).toBeDefined();
      expect(redisCandidate!.action).toBe("update");
      expect(redisCandidate!.matchedNodeId).toBe("redis-cache");
    });

    it("marks truly new components as add", () => {
      const plan = buildMergePlan(sadExtraction, {
        nodes: existingNodes,
        edges: existingEdges,
      });
      const newOnes = plan.components.filter((c) => c.action === "add");
      const newNames = newOnes.map((c) => c.extracted.name);
      expect(newNames).toContain("Telemetry Ingestion Service");
      expect(newNames).toContain("TIGR Calculator Service");
      expect(newNames).toContain("Anomaly Detection Service");
    });

    it("detects duplicate data flows", () => {
      const plan = buildMergePlan(sadExtraction, {
        nodes: existingNodes,
        edges: existingEdges,
      });
      // The gateway→kafka flow already exists
      const gatewayFlow = plan.dataFlows.find(
        (f) => f.extracted.id === "flow-gateway-to-kafka",
      );
      expect(gatewayFlow).toBeDefined();
      expect(gatewayFlow!.action).toBe("skip");
    });

    it("marks new data flows as add", () => {
      const plan = buildMergePlan(sadExtraction, {
        nodes: existingNodes,
        edges: existingEdges,
      });
      const newFlows = plan.dataFlows.filter((f) => f.action === "add");
      expect(newFlows.length).toBe(2); // ingestion→kafka, kafka→tigr
    });

    it("matches existing boundary by trust level", () => {
      const plan = buildMergePlan(sadExtraction, {
        nodes: existingNodes,
        edges: existingEdges,
      });
      const internalBoundary = plan.boundaries.find(
        (b) => b.extracted.id === "internal-services",
      );
      expect(internalBoundary).toBeDefined();
      expect(internalBoundary!.action).toBe("update");
    });

    it("reports correct stats", () => {
      const plan = buildMergePlan(sadExtraction, {
        nodes: existingNodes,
        edges: existingEdges,
      });
      expect(plan.stats.updatedComponents).toBe(3); // PG, Kafka, Redis
      expect(plan.stats.newComponents).toBe(3); // Ingestion, TIGR, Anomaly
      expect(plan.stats.skippedFlows).toBe(1); // gateway→kafka
      expect(plan.stats.newFlows).toBe(2);
    });
  });

  describe("applyMergePlan", () => {
    it("only returns new components, not matched ones", () => {
      const plan = buildMergePlan(sadExtraction, {
        nodes: existingNodes,
        edges: existingEdges,
      });
      const merged = applyMergePlan(sadExtraction, plan);
      expect(merged.components.length).toBe(3);
      const names = merged.components.map((c) => c.name);
      expect(names).not.toContain("PostgreSQL");
      expect(names).not.toContain("Apache Kafka");
      expect(names).not.toContain("Redis");
      expect(names).toContain("Telemetry Ingestion Service");
    });

    it("remaps data flow IDs to existing node IDs", () => {
      const plan = buildMergePlan(sadExtraction, {
        nodes: existingNodes,
        edges: existingEdges,
      });
      const merged = applyMergePlan(sadExtraction, plan);
      // ingestion→kafka flow should remap kafka-message-broker → kafka-broker
      const ingestionFlow = merged.dataFlows.find(
        (f) => f.sourceId === "ingestion-service",
      );
      expect(ingestionFlow).toBeDefined();
      expect(ingestionFlow!.targetId).toBe("kafka-broker");
    });

    it("excludes duplicate data flows", () => {
      const plan = buildMergePlan(sadExtraction, {
        nodes: existingNodes,
        edges: existingEdges,
      });
      const merged = applyMergePlan(sadExtraction, plan);
      expect(merged.dataFlows.length).toBe(2);
      const flowIds = merged.dataFlows.map((f) => f.id);
      expect(flowIds).not.toContain("flow-gateway-to-kafka");
    });
  });

  describe("summarizeExistingComponents", () => {
    it("lists non-boundary nodes with tech and type", () => {
      const summary = summarizeExistingComponents(existingNodes);
      expect(summary).toContain("PostgreSQL Database");
      expect(summary).toContain("PostgreSQL 17");
      expect(summary).toContain("database");
      expect(summary).toContain("EXISTING COMPONENTS");
      // Should NOT include the boundary
      expect(summary).not.toContain("Internal Services");
    });

    it("returns empty string for empty canvas", () => {
      expect(summarizeExistingComponents([])).toBe("");
    });
  });
});
