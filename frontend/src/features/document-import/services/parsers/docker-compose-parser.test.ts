/**
 * Unit tests for Docker Compose parser
 */
import { describe, it, expect } from "vitest";
import { parseDockerCompose } from "./docker-compose-parser";

const BASIC_COMPOSE = `
version: '3.8'
services:
  web:
    image: node:18-alpine
    ports:
      - "3000:3000"
  db:
    image: postgres:15
  redis:
    image: redis:7-alpine
`;

const DEPENDS_ON_COMPOSE = `
version: '3.8'
services:
  api:
    image: node:18
    depends_on:
      - db
      - cache
  db:
    image: postgres:15
  cache:
    image: redis:7
`;

const DEPENDS_ON_MAP_STYLE = `
version: '3.8'
services:
  server:
    image: node:18
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_started
  db:
    image: postgres:15
  redis:
    image: redis:7
`;

const WITH_NETWORKS_COMPOSE = `
version: '3.8'
networks:
  backend:
    driver: bridge
  frontend:
    driver: bridge
services:
  web:
    image: nginx:alpine
    networks:
      - frontend
  api:
    image: node:18
    networks:
      - frontend
      - backend
  db:
    image: postgres:15
    networks:
      - backend
`;

const WELL_KNOWN_IMAGES = `
version: '3.8'
services:
  db:
    image: mysql:8
  cache:
    image: memcached:1.6
  mq:
    image: rabbitmq:3-management
  proxy:
    image: traefik:v2.9
  auth:
    image: keycloak:21
  storage:
    image: minio:latest
  search:
    image: elasticsearch:8
`;

const EMPTY_COMPOSE = `
version: '3.8'
`;

describe("parseDockerCompose", () => {
  describe("basic service extraction", () => {
    it("extracts all services as components", () => {
      const result = parseDockerCompose(BASIC_COMPOSE);
      expect(result.components).toHaveLength(3);
    });

    it("uses dc-{serviceName} as component ID", () => {
      const result = parseDockerCompose(BASIC_COMPOSE);
      const ids = result.components.map((c) => c.id);
      expect(ids).toContain("dc-web");
      expect(ids).toContain("dc-db");
      expect(ids).toContain("dc-redis");
    });

    it("capitalizes service name for display", () => {
      const result = parseDockerCompose(BASIC_COMPOSE);
      const web = result.components.find((c) => c.id === "dc-web");
      expect(web?.name).toBe("Web");
    });

    it("converts hyphens and underscores to spaces in name", () => {
      const compose = `
version: '3.8'
services:
  my-api-service:
    image: node:18
`;
      const result = parseDockerCompose(compose);
      expect(result.components[0].name).toBe("My Api Service");
    });

    it("sets confidence 0.85 for all components", () => {
      const result = parseDockerCompose(BASIC_COMPOSE);
      for (const c of result.components) {
        expect(c.confidence).toBe(0.85);
      }
    });

    it("marks all components as selected", () => {
      const result = parseDockerCompose(BASIC_COMPOSE);
      for (const c of result.components) {
        expect(c.selected).toBe(true);
      }
    });

    it("stores image name in description", () => {
      const result = parseDockerCompose(BASIC_COMPOSE);
      const db = result.components.find((c) => c.id === "dc-db");
      expect(db?.description).toContain("postgres:15");
    });
  });

  describe("image type inference", () => {
    it("maps postgres to database", () => {
      const result = parseDockerCompose(BASIC_COMPOSE);
      const db = result.components.find((c) => c.id === "dc-db");
      expect(db?.type).toBe("database");
    });

    it("maps redis to cache", () => {
      const result = parseDockerCompose(BASIC_COMPOSE);
      const cache = result.components.find((c) => c.id === "dc-redis");
      expect(cache?.type).toBe("cache");
    });

    it("maps node image to service", () => {
      const result = parseDockerCompose(BASIC_COMPOSE);
      const web = result.components.find((c) => c.id === "dc-web");
      expect(web?.type).toBe("service");
    });

    it("maps mysql to database", () => {
      const result = parseDockerCompose(WELL_KNOWN_IMAGES);
      const db = result.components.find((c) => c.id === "dc-db");
      expect(db?.type).toBe("database");
    });

    it("maps memcached to cache", () => {
      const result = parseDockerCompose(WELL_KNOWN_IMAGES);
      const cache = result.components.find((c) => c.id === "dc-cache");
      expect(cache?.type).toBe("cache");
    });

    it("maps rabbitmq to queue", () => {
      const result = parseDockerCompose(WELL_KNOWN_IMAGES);
      const mq = result.components.find((c) => c.id === "dc-mq");
      expect(mq?.type).toBe("queue");
    });

    it("maps traefik to loadBalancer", () => {
      const result = parseDockerCompose(WELL_KNOWN_IMAGES);
      const proxy = result.components.find((c) => c.id === "dc-proxy");
      expect(proxy?.type).toBe("loadBalancer");
    });

    it("maps keycloak to authService", () => {
      const result = parseDockerCompose(WELL_KNOWN_IMAGES);
      const auth = result.components.find((c) => c.id === "dc-auth");
      expect(auth?.type).toBe("authService");
    });

    it("maps minio to storage", () => {
      const result = parseDockerCompose(WELL_KNOWN_IMAGES);
      const storage = result.components.find((c) => c.id === "dc-storage");
      expect(storage?.type).toBe("storage");
    });

    it("maps elasticsearch to database", () => {
      const result = parseDockerCompose(WELL_KNOWN_IMAGES);
      const search = result.components.find((c) => c.id === "dc-search");
      expect(search?.type).toBe("database");
    });
  });

  describe("trust levels from ports", () => {
    it("marks services with exposed ports as PUBLIC", () => {
      const result = parseDockerCompose(BASIC_COMPOSE);
      const web = result.components.find((c) => c.id === "dc-web");
      expect(web?.trustLevel).toBe("PUBLIC");
    });

    it("marks services without exposed ports as INTERNAL", () => {
      const result = parseDockerCompose(BASIC_COMPOSE);
      const db = result.components.find((c) => c.id === "dc-db");
      expect(db?.trustLevel).toBe("INTERNAL");
    });
  });

  describe("data flows from depends_on (list style)", () => {
    it("creates flows from depends_on list", () => {
      const result = parseDockerCompose(DEPENDS_ON_COMPOSE);
      expect(result.dataFlows).toHaveLength(2);
    });

    it("creates flow from api to db", () => {
      const result = parseDockerCompose(DEPENDS_ON_COMPOSE);
      const flow = result.dataFlows.find(
        (f) => f.sourceId === "dc-api" && f.targetId === "dc-db",
      );
      expect(flow).toBeDefined();
    });

    it("creates flow from api to cache", () => {
      const result = parseDockerCompose(DEPENDS_ON_COMPOSE);
      const flow = result.dataFlows.find(
        (f) => f.sourceId === "dc-api" && f.targetId === "dc-cache",
      );
      expect(flow).toBeDefined();
    });

    it("labels flows as 'depends on'", () => {
      const result = parseDockerCompose(DEPENDS_ON_COMPOSE);
      for (const f of result.dataFlows) {
        expect(f.label).toBe("depends on");
      }
    });

    it("sets confidence 0.9 on dependency flows", () => {
      const result = parseDockerCompose(DEPENDS_ON_COMPOSE);
      for (const f of result.dataFlows) {
        expect(f.confidence).toBe(0.9);
      }
    });
  });

  describe("data flows from depends_on (map style)", () => {
    it("parses map-style depends_on with conditions", () => {
      const result = parseDockerCompose(DEPENDS_ON_MAP_STYLE);
      expect(result.dataFlows).toHaveLength(2);
    });

    it("creates flow from server to db (map style)", () => {
      const result = parseDockerCompose(DEPENDS_ON_MAP_STYLE);
      const flow = result.dataFlows.find(
        (f) => f.sourceId === "dc-server" && f.targetId === "dc-db",
      );
      expect(flow).toBeDefined();
    });
  });

  describe("boundaries", () => {
    it("creates an internal boundary for non-public services", () => {
      const result = parseDockerCompose(BASIC_COMPOSE);
      const internal = result.boundaries.find((b) => b.id === "dc-internal");
      expect(internal).toBeDefined();
    });

    it("creates a public boundary for services with exposed ports", () => {
      const result = parseDockerCompose(BASIC_COMPOSE);
      const pub = result.boundaries.find((b) => b.id === "dc-public");
      expect(pub).toBeDefined();
    });

    it("internal boundary includes only non-public services", () => {
      const result = parseDockerCompose(BASIC_COMPOSE);
      const internal = result.boundaries.find((b) => b.id === "dc-internal");
      expect(internal?.componentIds).toContain("dc-db");
      expect(internal?.componentIds).toContain("dc-redis");
      expect(internal?.componentIds).not.toContain("dc-web");
    });

    it("creates named network boundaries when 2+ services share a network", () => {
      const result = parseDockerCompose(WITH_NETWORKS_COMPOSE);
      const backendNet = result.boundaries.find(
        (b) => b.id === "dc-net-backend",
      );
      expect(backendNet).toBeDefined();
      expect(backendNet?.componentIds).toContain("dc-api");
      expect(backendNet?.componentIds).toContain("dc-db");
    });

    it("does not pre-select named network boundaries", () => {
      const result = parseDockerCompose(WITH_NETWORKS_COMPOSE);
      const netBoundary = result.boundaries.find((b) =>
        b.id.startsWith("dc-net-"),
      );
      expect(netBoundary?.selected).toBe(false);
    });
  });

  describe("technology extraction", () => {
    it("extracts base image name as technology", () => {
      const result = parseDockerCompose(BASIC_COMPOSE);
      expect(result.technologies).toContain("postgres");
    });

    it("does not duplicate technologies", () => {
      const compose = `
version: '3.8'
services:
  db1:
    image: postgres:15
  db2:
    image: postgres:14
`;
      const result = parseDockerCompose(compose);
      const pgCount = result.technologies.filter(
        (t) => t === "postgres",
      ).length;
      expect(pgCount).toBe(1);
    });
  });

  describe("empty compose file", () => {
    it("returns empty components", () => {
      const result = parseDockerCompose(EMPTY_COMPOSE);
      expect(result.components).toHaveLength(0);
    });

    it("returns a warning", () => {
      const result = parseDockerCompose(EMPTY_COMPOSE);
      expect(result.warnings).toContain(
        "No services found in docker-compose file",
      );
    });

    it("returns confidence 0.1", () => {
      const result = parseDockerCompose(EMPTY_COMPOSE);
      expect(result.confidence).toBe(0.1);
    });
  });

  describe("overall result shape", () => {
    it("returns confidence 0.82 for valid compose files", () => {
      const result = parseDockerCompose(BASIC_COMPOSE);
      expect(result.confidence).toBe(0.82);
    });

    it("returns dataTypes as empty array", () => {
      const result = parseDockerCompose(BASIC_COMPOSE);
      expect(result.dataTypes).toEqual([]);
    });

    it("returns no warnings for well-formed compose files", () => {
      const result = parseDockerCompose(BASIC_COMPOSE);
      expect(result.warnings).toHaveLength(0);
    });
  });
});
