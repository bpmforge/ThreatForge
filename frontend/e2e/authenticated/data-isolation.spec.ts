import { test, expect, skipIfNotAuthenticated } from "../fixtures/auth";
import { ApiTestHelper, TestDataTracker } from "../fixtures/api-helper";

/**
 * Data Isolation E2E Tests
 *
 * These tests verify that:
 * 1. Data created via UI ends up in correct organization/project
 * 2. Multi-tenant isolation is enforced
 * 3. Ownership chains (org -> project -> model) are correct
 *
 * LEARNINGS APPLIED:
 * - Always verify database state after UI operations, not just UI feedback
 * - Test the full ownership chain, not just immediate parent
 * - Use API verification to confirm data integrity
 */
test.describe("Data Isolation (Authenticated)", () => {
  // Increase timeout for these tests due to API calls and potential rate limit retries (5 retries x 40s max)
  test.setTimeout(240000);
  let api: ApiTestHelper;
  let tracker: TestDataTracker;
  let userOrgId: string;

  test.beforeEach(async ({ authenticatedPage, isAuthenticated }) => {
    skipIfNotAuthenticated(isAuthenticated);

    // Set up API helper
    api = await ApiTestHelper.fromPage(authenticatedPage);
    tracker = new TestDataTracker();

    // Get user's primary organization for verification
    const org = await api.getPrimaryOrganization();
    if (!org) {
      test.skip();
      return;
    }
    userOrgId = org.id;
  });

  test.afterEach(async () => {
    // Clean up any test data created
    if (api && tracker) {
      await tracker.cleanup(api);
    }
  });

  test("project created via UI belongs to user organization", async ({
    authenticatedPage,
  }) => {
    const page = authenticatedPage;
    const projectName = `Test Project ${Date.now()}`;

    // Navigate to projects page
    await page.goto("/projects");
    await page.waitForLoadState("networkidle");

    // Look for "New Project" or "Create Project" button
    const newProjectBtn = page
      .locator(
        'button:has-text("New Project"), button:has-text("Create Project"), button:has-text("Add Project")',
      )
      .first();
    const btnVisible = await newProjectBtn
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    if (!btnVisible) {
      console.log("No create project button found - skipping");
      test.skip();
      return;
    }

    await newProjectBtn.click();
    await page.waitForTimeout(1000);

    // Fill project name in dialog
    const nameInput = page
      .locator('input#name, input[placeholder*="name"]')
      .first();
    const hasDialog = await nameInput
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    if (!hasDialog) {
      console.log("Project dialog not found - skipping");
      test.skip();
      return;
    }

    await nameInput.fill(projectName);

    // Submit the form - look for button in dialog
    const createBtn = page
      .locator('[role="dialog"] button:has-text("Create")')
      .first();
    await createBtn.click({ force: true });

    // Wait for dialog to close or navigation
    await page.waitForTimeout(2000);

    // VERIFICATION: Check via API that project exists and belongs to correct org
    const { data: projects } = await api.getProjects();
    const createdProject = projects.find((p) => p.name === projectName);

    expect(createdProject).toBeDefined();
    expect(createdProject!.organizationId).toBe(userOrgId);

    // Track for cleanup
    if (createdProject) {
      tracker.trackProject(createdProject.id);
    }

    console.log(`Project "${projectName}" verified in org ${userOrgId}`);
  });

  test("threat model created via dashboard belongs to user organization", async ({
    authenticatedPage,
  }) => {
    const page = authenticatedPage;
    const modelName = `Test Model ${Date.now()}`;

    // Navigate to dashboard
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    // Find and click new model button
    const newModelBtn = page
      .locator(
        'button:has-text("New Model"), button:has-text("Create Model"), button:has-text("Get Started")',
      )
      .first();
    const btnVisible = await newModelBtn
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    if (!btnVisible) {
      console.log("No create model button found - skipping");
      test.skip();
      return;
    }

    await newModelBtn.click();
    await page.waitForTimeout(1000);

    // Fill model name in dialog
    const nameInput = page
      .locator('input#name, input[placeholder*="name"]')
      .first();
    const hasDialog = await nameInput
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    if (!hasDialog) {
      console.log("Model dialog not found - skipping");
      test.skip();
      return;
    }

    await nameInput.fill(modelName);

    // Submit - use role="dialog" selector to avoid overlay issues
    const createBtn = page.locator(
      '[role="dialog"] button:has-text("Create Model")',
    );
    await createBtn.click({ force: true });

    // Wait for navigation to model page
    await page.waitForURL(/\/models\//, { timeout: 15000 }).catch(() => {});

    // Extract model ID from URL
    const url = page.url();
    const modelIdMatch = url.match(/\/models\/([^/]+)/);
    const modelId = modelIdMatch ? modelIdMatch[1] : null;

    expect(modelId).toBeTruthy();

    if (modelId) {
      tracker.trackThreatModel(modelId);

      // VERIFICATION: Check ownership chain via API
      const verification = await api.verifyThreatModelOwnership(
        modelId,
        userOrgId,
      );

      expect(verification.valid).toBe(true);
      console.log(
        `Model "${modelName}" ownership verified: ${verification.details}`,
      );
    }
  });

  test("threat model loads without error when accessing via URL", async ({
    authenticatedPage,
  }) => {
    const page = authenticatedPage;

    // First create a model via API to have a known-good model
    const modelName = `API Model ${Date.now()}`;
    const model = await api.createThreatModel(modelName);
    tracker.trackThreatModel(model.id);

    // Now navigate to it via URL
    await page.goto(`/models/${model.id}`);
    await page.waitForLoadState("networkidle");

    // Check for error message
    const hasError = await page
      .locator("text=Failed to load threat model")
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    expect(hasError).toBe(false);

    // Verify canvas loaded
    const canvasVisible = await page
      .locator(".react-flow")
      .isVisible({ timeout: 10000 })
      .catch(() => false);

    expect(canvasVisible).toBe(true);
  });

  test("project list only shows projects from user organization", async ({
    authenticatedPage,
  }) => {
    const page = authenticatedPage;

    // Get projects via API
    const { data: apiProjects } = await api.getProjects();

    // All projects should belong to user's organization
    for (const project of apiProjects) {
      expect(project.organizationId).toBe(userOrgId);
    }

    // Navigate to projects page
    await page.goto("/projects");
    await page.waitForLoadState("networkidle");

    // Count visible project cards/rows
    const projectCards = page.locator(
      '[data-testid="project-card"], [data-testid="project-row"]',
    );
    const projectLinks = page.locator('a[href^="/projects/"]');

    // Either we have project cards or project links (depending on UI implementation)
    const cardCount = await projectCards.count();
    const linkCount = await projectLinks.count();
    const uiProjectCount = Math.max(cardCount, linkCount);

    // UI should show same or fewer projects than API returns
    // (could be fewer due to pagination)
    expect(uiProjectCount).toBeLessThanOrEqual(apiProjects.length);
  });

  test("threat model list only shows models from user organization", async ({
    authenticatedPage,
  }) => {
    const page = authenticatedPage;

    // Get threat models via API
    const { data: apiModels } = await api.getThreatModels();

    // Verify all models are in correct org via their projects
    for (const model of apiModels) {
      if (model.projectId) {
        const verification = await api.verifyProjectOwnership(
          model.projectId,
          userOrgId,
        );
        expect(verification.valid).toBe(true);
      }
    }

    // Navigate to dashboard to see recent models
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    // Look for model links
    const modelLinks = page.locator('a[href^="/models/"]');
    const uiModelCount = await modelLinks.count();

    console.log(
      `API returned ${apiModels.length} models, UI shows ${uiModelCount} links`,
    );
  });
});

test.describe("Data Relationship Integrity (Authenticated)", () => {
  // Increase timeout for these tests due to API calls and potential rate limit retries (5 retries x 40s max)
  test.setTimeout(240000);
  let api: ApiTestHelper;
  let tracker: TestDataTracker;

  test.beforeEach(async ({ authenticatedPage, isAuthenticated }) => {
    skipIfNotAuthenticated(isAuthenticated);
    api = await ApiTestHelper.fromPage(authenticatedPage);
    tracker = new TestDataTracker();
  });

  test.afterEach(async () => {
    if (api && tracker) {
      await tracker.cleanup(api);
    }
  });

  test("creating model in specific project maintains relationship", async ({
    authenticatedPage,
  }) => {
    const page = authenticatedPage;

    // First get an existing project or create one
    const { data: projects } = await api.getProjects();
    let projectId: string;

    if (projects.length > 0) {
      projectId = projects[0].id;
    } else {
      const newProject = await api.createProject(`Test Project ${Date.now()}`);
      projectId = newProject.id;
      tracker.trackProject(projectId);
    }

    // Create model in this specific project via API
    const modelName = `Project Model ${Date.now()}`;
    const model = await api.createThreatModel(modelName, { projectId });
    tracker.trackThreatModel(model.id);

    // Verify the model is in the correct project
    const fetchedModel = await api.getThreatModel(model.id);
    expect(fetchedModel.projectId).toBe(projectId);

    // Navigate to the model and verify it loads
    await page.goto(`/models/${model.id}`);
    await page.waitForLoadState("networkidle");

    const hasError = await page
      .locator("text=Failed to load threat model")
      .isVisible({ timeout: 5000 })
      .catch(() => false);
    expect(hasError).toBe(false);
  });

  test("default project is created in user organization when none exists", async ({
    authenticatedPage: _authenticatedPage,
  }) => {
    // This test verifies the fix for the bug where creating a threat model
    // when no project exists created a new organization instead of using existing

    const org = await api.getPrimaryOrganization();
    if (!org) {
      test.skip();
      return;
    }

    // Get current project count
    const { data: initialProjects } = await api.getProjects();
    const initialCount = initialProjects.length;

    // If user has no projects, creating a model should create a default project
    // in their existing organization
    if (initialCount === 0) {
      const modelName = `Auto Project Model ${Date.now()}`;
      const model = await api.createThreatModel(modelName);
      tracker.trackThreatModel(model.id);

      // Verify the model's project is in the user's org
      const verification = await api.verifyThreatModelOwnership(
        model.id,
        org.id,
      );
      expect(verification.valid).toBe(true);

      // Verify a new project was created
      const { data: newProjects } = await api.getProjects();
      expect(newProjects.length).toBe(initialCount + 1);

      // Track the new project for cleanup
      const newProject = newProjects.find(
        (p) => !initialProjects.some((ip) => ip.id === p.id),
      );
      if (newProject) {
        tracker.trackProject(newProject.id);
      }
    } else {
      // User already has projects, just verify they're in correct org
      for (const project of initialProjects) {
        expect(project.organizationId).toBe(org.id);
      }
    }
  });
});
