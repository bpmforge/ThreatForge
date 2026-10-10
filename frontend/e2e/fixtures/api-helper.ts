/**
 * API Helper for E2E Tests
 *
 * Provides direct API access for:
 * - Verifying data state after UI operations
 * - Creating test fixtures
 * - Cleaning up test data
 * - Testing multi-tenant isolation
 */
import type { Page } from "@playwright/test";

const API_BASE_URL = process.env.E2E_API_URL || "http://localhost:3001";

/**
 * Get cookies from a page as a header string
 */
export async function getCookieHeader(page: Page): Promise<string> {
  const cookies = await page.context().cookies();
  return cookies.map((c) => `${c.name}=${c.value}`).join("; ");
}

/**
 * API response types matching backend schemas
 */
export interface Organization {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  status: string;
  organizationId: string;
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

export interface ThreatModel {
  id: string;
  name: string;
  version: number;
  projectId: string;
  createdById: string;
  canvasState: {
    nodes: unknown[];
    edges: unknown[];
    viewport?: { x: number; y: number; zoom: number };
  };
  createdAt: string;
  updatedAt: string;
  project?: {
    id: string;
    name: string;
    organizationId?: string;
  };
}

export interface User {
  id: string;
  name: string;
  email: string;
}

export interface Membership {
  id: string;
  userId: string;
  organizationId: string;
  role: string;
}

/**
 * API client for authenticated requests
 */
export class ApiTestHelper {
  private cookieHeader: string;

  constructor(cookieHeader: string) {
    this.cookieHeader = cookieHeader;
  }

  /**
   * Create helper from an authenticated page
   */
  static async fromPage(page: Page): Promise<ApiTestHelper> {
    const cookieHeader = await getCookieHeader(page);
    return new ApiTestHelper(cookieHeader);
  }

  /**
   * Make authenticated GET request with retry for rate limits
   */
  async get<T>(endpoint: string, retries = 5): Promise<T> {
    for (let attempt = 1; attempt <= retries; attempt++) {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: "GET",
        headers: {
          Cookie: this.cookieHeader,
          "Content-Type": "application/json",
        },
      });

      if (response.status === 429 && attempt < retries) {
        // Rate limited - wait the full retry-after period (capped at 40s)
        const retryAfter = Math.min(
          40,
          parseInt(response.headers.get("retry-after") || "5", 10),
        );
        console.log(
          `Rate limited on ${endpoint}, waiting ${retryAfter}s (attempt ${attempt}/${retries})`,
        );
        await new Promise((r) => setTimeout(r, retryAfter * 1000));
        continue;
      }

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`GET ${endpoint} failed: ${response.status} - ${text}`);
      }

      return response.json();
    }
    throw new Error(`GET ${endpoint} failed after ${retries} retries`);
  }

  /**
   * Make authenticated POST request with retry for rate limits
   */
  async post<T>(endpoint: string, body: unknown, retries = 5): Promise<T> {
    for (let attempt = 1; attempt <= retries; attempt++) {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: "POST",
        headers: {
          Cookie: this.cookieHeader,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (response.status === 429 && attempt < retries) {
        // Rate limited - wait the full retry-after period (capped at 40s)
        const retryAfter = Math.min(
          40,
          parseInt(response.headers.get("retry-after") || "5", 10),
        );
        console.log(
          `Rate limited on POST ${endpoint}, waiting ${retryAfter}s (attempt ${attempt}/${retries})`,
        );
        await new Promise((r) => setTimeout(r, retryAfter * 1000));
        continue;
      }

      if (!response.ok) {
        const text = await response.text();
        throw new Error(
          `POST ${endpoint} failed: ${response.status} - ${text}`,
        );
      }

      return response.json();
    }
    throw new Error(`POST ${endpoint} failed after ${retries} retries`);
  }

  /**
   * Make authenticated DELETE request
   */
  async delete(endpoint: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: "DELETE",
      headers: {
        Cookie: this.cookieHeader,
      },
    });

    if (!response.ok && response.status !== 204) {
      const text = await response.text();
      throw new Error(
        `DELETE ${endpoint} failed: ${response.status} - ${text}`,
      );
    }
  }

  // ============ Organization Methods ============

  /**
   * Get user's organizations
   * Note: The API returns an array directly, not wrapped in { data: [...] }
   */
  async getOrganizations(): Promise<{ data: Organization[] }> {
    const orgs = await this.get<Organization[]>("/api/organizations");
    return { data: orgs };
  }

  /**
   * Create a new organization
   */
  async createOrganization(name: string): Promise<Organization> {
    return this.post("/api/organizations", { name });
  }

  // ============ Project Methods ============

  /**
   * Get user's projects
   */
  async getProjects(): Promise<{ data: Project[] }> {
    return this.get("/api/projects");
  }

  /**
   * Get a specific project
   */
  async getProject(id: string): Promise<Project> {
    return this.get(`/api/projects/${id}`);
  }

  /**
   * Create a new project
   */
  async createProject(
    name: string,
    options?: { description?: string; organizationId?: string },
  ): Promise<Project> {
    return this.post("/api/projects", { name, ...options });
  }

  /**
   * Delete a project
   */
  async deleteProject(id: string): Promise<void> {
    return this.delete(`/api/projects/${id}`);
  }

  // ============ Threat Model Methods ============

  /**
   * Get user's threat models
   */
  async getThreatModels(): Promise<{
    data: ThreatModel[];
    pagination: unknown;
  }> {
    return this.get("/api/threat-models");
  }

  /**
   * Get a specific threat model with full data
   */
  async getThreatModel(id: string): Promise<ThreatModel> {
    return this.get(`/api/threat-models/${id}`);
  }

  /**
   * Create a new threat model
   */
  async createThreatModel(
    name: string,
    options?: { projectId?: string; canvasState?: unknown },
  ): Promise<ThreatModel> {
    return this.post("/api/threat-models", { name, ...options });
  }

  /**
   * Delete a threat model
   */
  async deleteThreatModel(id: string): Promise<void> {
    return this.delete(`/api/threat-models/${id}`);
  }

  // ============ Verification Methods ============

  /**
   * Verify a threat model belongs to the correct project and organization chain
   */
  async verifyThreatModelOwnership(
    threatModelId: string,
    expectedOrgId: string,
  ): Promise<{ valid: boolean; details: string }> {
    try {
      const model = await this.getThreatModel(threatModelId);
      const project = await this.getProject(model.projectId);

      if (project.organizationId !== expectedOrgId) {
        return {
          valid: false,
          details: `Model's project belongs to org ${project.organizationId}, expected ${expectedOrgId}`,
        };
      }

      return { valid: true, details: "Ownership chain verified" };
    } catch (error) {
      return {
        valid: false,
        details: `Verification failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }

  /**
   * Verify project belongs to the expected organization
   */
  async verifyProjectOwnership(
    projectId: string,
    expectedOrgId: string,
  ): Promise<{ valid: boolean; details: string }> {
    try {
      const project = await this.getProject(projectId);

      if (project.organizationId !== expectedOrgId) {
        return {
          valid: false,
          details: `Project belongs to org ${project.organizationId}, expected ${expectedOrgId}`,
        };
      }

      return { valid: true, details: "Project ownership verified" };
    } catch (error) {
      return {
        valid: false,
        details: `Verification failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }

  /**
   * Get user's primary organization (first one they're a member of)
   */
  async getPrimaryOrganization(): Promise<Organization | null> {
    const { data } = await this.getOrganizations();
    return data.length > 0 ? data[0] : null;
  }

  /**
   * Clean up test data created during tests
   */
  async cleanupTestData(options: {
    threatModelIds?: string[];
    projectIds?: string[];
  }): Promise<void> {
    const { threatModelIds = [], projectIds = [] } = options;

    // Delete threat models first (they depend on projects)
    for (const id of threatModelIds) {
      try {
        await this.deleteThreatModel(id);
      } catch (error) {
        console.warn(`Failed to delete threat model ${id}:`, error);
      }
    }

    // Then delete projects
    for (const id of projectIds) {
      try {
        await this.deleteProject(id);
      } catch (error) {
        console.warn(`Failed to delete project ${id}:`, error);
      }
    }
  }
}

/**
 * Test data tracker for cleanup
 */
export class TestDataTracker {
  private threatModelIds: string[] = [];
  private projectIds: string[] = [];

  trackThreatModel(id: string): void {
    this.threatModelIds.push(id);
  }

  trackProject(id: string): void {
    this.projectIds.push(id);
  }

  async cleanup(api: ApiTestHelper): Promise<void> {
    await api.cleanupTestData({
      threatModelIds: this.threatModelIds,
      projectIds: this.projectIds,
    });
    this.threatModelIds = [];
    this.projectIds = [];
  }
}
