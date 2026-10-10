/**
 * A review created without an explicit workflow config must still get the
 * default checklist.
 *
 * The bug was not a crash. `DEFAULT_CHECKLIST_TEMPLATES` sat inside an
 * `import type { ... }` block, so it was usable only in TYPE position — which is
 * why the fallback had been written as `[] as typeof DEFAULT_CHECKLIST_TEMPLATES`.
 * That compiles, reads as if the default is wired because the name appears, and
 * produces an EMPTY checklist for every review without a config.
 *
 * So this test asserts the checklist rows actually handed to Prisma, not the
 * return value — an empty checklist is invisible from the outside.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { createReviewRequest } from "../create-request.js";
import { DEFAULT_CHECKLIST_TEMPLATES } from "../types.js";

const mockReviewRequestCreate = vi.fn();

const mockPrisma = {
  threatModel: {
    findUnique: vi.fn().mockResolvedValue({
      id: "tm-1",
      name: "Model",
      version: 1,
      project: { organizationId: "org-1" },
    }),
  },
  user: {
    findUnique: vi.fn().mockResolvedValue({
      id: "user-1",
      name: "Requester",
      email: "r@test.dev",
    }),
  },
  reviewWorkflowConfig: {
    // The case under test: no explicit config for this model.
    findUnique: vi.fn().mockResolvedValue(null),
  },
  reviewRequest: { create: mockReviewRequestCreate },
  reviewAssignment: { create: vi.fn().mockResolvedValue({ id: "ra-1" }) },
};

vi.mock("../../../db.js", () => ({
  getPrisma: vi.fn(() => Promise.resolve(mockPrisma)),
}));

vi.mock("../../notifications/index.js", () => ({
  getNotificationService: () => ({
    notify: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock("../helpers.js", () => ({
  logReviewActivity: vi.fn().mockResolvedValue(undefined),
  mapReviewRequest: (r: unknown) => r,
}));

describe("createReviewRequest — default checklist", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.threatModel.findUnique.mockResolvedValue({
      id: "tm-1",
      name: "Model",
      version: 1,
      project: { organizationId: "org-1" },
    });
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      name: "Requester",
      email: "r@test.dev",
    });
    mockPrisma.reviewWorkflowConfig.findUnique.mockResolvedValue(null);
    mockReviewRequestCreate.mockImplementation(async ({ data }) => ({
      ...data,
      id: "rr-1",
      assignments: [],
    }));
  });

  it("falls back to DEFAULT_CHECKLIST_TEMPLATES when no workflow config exists", async () => {
    await createReviewRequest({
      threatModelId: "tm-1",
      requestedById: "user-1",
      reviewers: [{ userId: "user-2", role: "SECURITY_LEAD", required: true }],
    });

    const created = mockReviewRequestCreate.mock.calls[0][0].data;
    const checklist = JSON.parse(created.checklist as string);

    const expectedCount = DEFAULT_CHECKLIST_TEMPLATES.reduce(
      (n, c) => n + c.items.length,
      0,
    );
    expect(expectedCount).toBeGreaterThan(0); // guards the fixture itself
    expect(checklist).toHaveLength(expectedCount);

    // Categories come through, not just a count.
    expect(checklist.map((c: { category: string }) => c.category)).toContain(
      DEFAULT_CHECKLIST_TEMPLATES[0].category,
    );
    // Nothing starts pre-completed.
    expect(
      checklist.every((c: { isCompleted: boolean }) => c.isCompleted === false),
    ).toBe(true);
  });

  it("still prefers an explicit workflow config over the defaults", async () => {
    mockPrisma.reviewWorkflowConfig.findUnique.mockResolvedValue({
      id: "wc-1",
      checklistTemplate: JSON.stringify([
        {
          category: "Custom",
          items: [{ description: "Only item", required: true }],
        },
      ]),
      criteria: JSON.stringify({}),
      reminderDays: JSON.stringify([]),
    });

    await createReviewRequest({
      threatModelId: "tm-1",
      requestedById: "user-1",
      reviewers: [{ userId: "user-2", role: "SECURITY_LEAD", required: true }],
      workflowConfigId: "wc-1",
    });

    const created = mockReviewRequestCreate.mock.calls[0][0].data;
    const checklist = JSON.parse(created.checklist as string);
    expect(checklist).toHaveLength(1);
    expect(checklist[0].category).toBe("Custom");
  });
});
