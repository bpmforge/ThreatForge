/**
 * Unit tests for pipeline-service.ts
 *
 * Covers:
 *   - getPipelineById: cache hit, cache miss, not found (null)
 *   - executePipeline: happy path, stage condition → CANCELLED, required stage
 *     failure with stopOnError=true → FAILED, optional stage failure → COMPLETED,
 *     variable resolution from 'input' source and previous stage output,
 *     JSON output parsing
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mock dependencies before importing the module under test
// ---------------------------------------------------------------------------

const mockPrisma = {
  promptPipeline: {
    findUnique: vi.fn(),
  },
  pipelineExecution: {
    create: vi.fn(),
    update: vi.fn(),
  },
  pipelineStageExecution: {
    create: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
  },
  document: {
    findUnique: vi.fn(),
  },
};

vi.mock("../db.js", () => ({
  getPrisma: vi.fn(() => Promise.resolve(mockPrisma)),
}));

// Mock preparePrompt so we don't need a real DB for prompt templates
vi.mock("../services/ai/prompt-service.js", () => ({
  preparePrompt: vi.fn(),
}));

vi.mock("../utils/logger.js", () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// Import after mocks are registered
import {
  getPipelineById,
  executePipeline,
  clearPipelineCache,
} from "../services/ai/pipeline-service.js";
import { preparePrompt } from "../services/ai/prompt-service.js";
import type { PipelineExecutionInput } from "../services/ai/pipeline-service.js";
import type { AIService } from "../services/ai/ai-service.js";

// ---------------------------------------------------------------------------
// Helpers / fixtures
// ---------------------------------------------------------------------------

function makeStage(overrides: Record<string, unknown> = {}) {
  return {
    id: "stage-1",
    name: "Stage One",
    order: 1,
    promptTemplateId: "prompt-tmpl-1",
    inputMapping: "{}",
    outputFields: "[]",
    condition: null,
    optional: false,
    retryCount: 0,
    ...overrides,
  };
}

function makePipeline(
  overrides: Record<string, unknown> = {},
  stages = [makeStage()],
) {
  return {
    id: "pipeline-1",
    name: "Test Pipeline",
    isActive: true,
    stopOnError: true,
    stages,
    ...overrides,
  };
}

function makeExecution(id = "exec-1") {
  return { id, status: "RUNNING" };
}

function makeStageExecution(stageId = "stage-1", execId = "exec-1") {
  return { id: "stage-exec-1", pipelineExecutionId: execId, stageId };
}

function makeAIService(contentOverride = '{"result":"ok"}') {
  return {
    complete: vi.fn().mockResolvedValue({
      content: contentOverride,
      usage: { totalTokens: 42 },
    }),
  } as unknown as AIService;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("getPipelineById", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearPipelineCache();
  });

  it("cache miss: fetches from DB and returns pipeline", async () => {
    const pipeline = makePipeline();
    mockPrisma.promptPipeline.findUnique.mockResolvedValue(pipeline);

    const result = await getPipelineById("pipeline-1");

    expect(mockPrisma.promptPipeline.findUnique).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ id: "pipeline-1" });
  });

  it("cache hit: second call for same ID does NOT hit DB", async () => {
    const pipeline = makePipeline();
    mockPrisma.promptPipeline.findUnique.mockResolvedValue(pipeline);

    await getPipelineById("pipeline-1");
    await getPipelineById("pipeline-1");

    expect(mockPrisma.promptPipeline.findUnique).toHaveBeenCalledTimes(1);
  });

  it("returns null when pipeline is not found", async () => {
    mockPrisma.promptPipeline.findUnique.mockResolvedValue(null);

    const result = await getPipelineById("does-not-exist");

    expect(result).toBeNull();
  });
});

describe("executePipeline", () => {
  const baseInput: PipelineExecutionInput = {
    pipelineId: "pipeline-1",
    userId: "user-1",
    organizationId: "org-1",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    clearPipelineCache();

    // Default: pipeline always found
    mockPrisma.promptPipeline.findUnique.mockResolvedValue(makePipeline());

    // Execution DB lifecycle
    mockPrisma.pipelineExecution.create.mockResolvedValue(makeExecution());
    mockPrisma.pipelineExecution.update.mockResolvedValue({});
    mockPrisma.pipelineStageExecution.create.mockResolvedValue({});
    mockPrisma.pipelineStageExecution.findFirst.mockResolvedValue(
      makeStageExecution(),
    );
    mockPrisma.pipelineStageExecution.update.mockResolvedValue({});

    // Default prepared prompt
    (preparePrompt as ReturnType<typeof vi.fn>).mockResolvedValue({
      systemPrompt: "sys",
      userPrompt: "usr",
    });
  });

  // -------------------------------------------------------------------------
  // Happy path
  // -------------------------------------------------------------------------

  it("happy path: returns COMPLETED with parsed JSON output", async () => {
    const aiService = makeAIService('{"threats":["SQL injection"]}');

    const result = await executePipeline(baseInput, aiService);

    expect(result.status).toBe("COMPLETED");
    expect(result.stageResults).toHaveLength(1);
    expect(result.stageResults[0].status).toBe("COMPLETED");
    expect(result.stageResults[0].output).toEqual({
      threats: ["SQL injection"],
    });
    expect(result.totalTokensUsed).toBe(42);
    expect(result.error).toBeUndefined();
  });

  it("non-JSON AI response is kept as string", async () => {
    const aiService = makeAIService("plain text response, not JSON");

    const result = await executePipeline(baseInput, aiService);

    expect(result.status).toBe("COMPLETED");
    expect(result.stageResults[0].output).toBe("plain text response, not JSON");
  });

  it("throws when pipeline ID is not found", async () => {
    mockPrisma.promptPipeline.findUnique.mockResolvedValue(null);

    await expect(executePipeline(baseInput, makeAIService())).rejects.toThrow(
      "Pipeline not found: pipeline-1",
    );
  });

  // -------------------------------------------------------------------------
  // Stage condition → CANCELLED
  // -------------------------------------------------------------------------

  it("stage with condition that evaluates false is CANCELLED, pipeline COMPLETED", async () => {
    const conditionStage = makeStage({
      condition: JSON.stringify({ field: "missingField", exists: true }),
    });
    mockPrisma.promptPipeline.findUnique.mockResolvedValue(
      makePipeline({}, [conditionStage]),
    );

    const result = await executePipeline(baseInput, makeAIService());

    expect(result.status).toBe("COMPLETED");
    expect(result.stageResults[0].status).toBe("CANCELLED");
  });

  it("stage condition 'equals' match skips CANCEL", async () => {
    // Input metadata has status='active'; condition requires status=active → executes
    const conditionStage = makeStage({
      condition: JSON.stringify({ field: "status", equals: "active" }),
    });
    mockPrisma.promptPipeline.findUnique.mockResolvedValue(
      makePipeline({}, [conditionStage]),
    );

    const result = await executePipeline(
      { ...baseInput, inputMetadata: { status: "active" } },
      makeAIService(),
    );

    expect(result.stageResults[0].status).toBe("COMPLETED");
  });

  it("stage condition 'contains' match executes stage", async () => {
    const conditionStage = makeStage({
      condition: JSON.stringify({
        field: "documentContent",
        contains: "threat",
      }),
    });
    mockPrisma.promptPipeline.findUnique.mockResolvedValue(
      makePipeline({}, [conditionStage]),
    );

    const result = await executePipeline(
      { ...baseInput, inputDocument: "contains threat analysis" },
      makeAIService(),
    );

    expect(result.stageResults[0].status).toBe("COMPLETED");
  });

  // -------------------------------------------------------------------------
  // Required stage failure with stopOnError=true
  // -------------------------------------------------------------------------

  it("required stage failure + stopOnError=true → execution FAILED", async () => {
    (preparePrompt as ReturnType<typeof vi.fn>).mockResolvedValue(null); // will throw

    const result = await executePipeline(baseInput, makeAIService());

    expect(result.status).toBe("FAILED");
    expect(result.error).toBeDefined();
    expect(result.error?.stageId).toBe("stage-1");
  });

  // errorInfo was only ever set inside the
  // `!stage.optional && pipeline.stopOnError` branch, so a non-optional stage
  // that FAILED with stopOnError=false left errorInfo unset and the pipeline
  // reported COMPLETED even though stageResults carried a FAILED entry. A
  // failure scan over the finished stageResults (mirroring
  // suggest-threats-v2-round.ts:171-183) must catch this regardless of
  // stopOnError.
  it("required stage failure + stopOnError=false → execution still FAILED", async () => {
    mockPrisma.promptPipeline.findUnique.mockResolvedValue(
      makePipeline({ stopOnError: false }),
    );
    (preparePrompt as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const result = await executePipeline(baseInput, makeAIService());

    expect(result.stageResults[0].status).toBe("FAILED");
    expect(result.status).toBe("FAILED");
    expect(result.error).toBeDefined();
    expect(result.error?.stageId).toBe("stage-1");
  });

  // -------------------------------------------------------------------------
  // Optional stage failure
  // -------------------------------------------------------------------------

  it("optional stage failure → execution continues, overall COMPLETED", async () => {
    const optionalStage = makeStage({ optional: true });
    const requiredStage = makeStage({
      id: "stage-2",
      name: "Stage Two",
      order: 2,
    });

    mockPrisma.promptPipeline.findUnique.mockResolvedValue(
      makePipeline({}, [optionalStage, requiredStage]),
    );

    // Stage-exec records keyed by stageId
    mockPrisma.pipelineStageExecution.findFirst.mockImplementation(
      ({ where }: { where: { stageId: string } }) => {
        const stageExecId = where.stageId === "stage-1" ? "se-1" : "se-2";
        return Promise.resolve({
          id: stageExecId,
          pipelineExecutionId: "exec-1",
          stageId: where.stageId,
        });
      },
    );

    // First stage (optional) fails, second succeeds
    (preparePrompt as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(null) // optional stage → error
      .mockResolvedValueOnce({ systemPrompt: "sys", userPrompt: "usr" }); // required stage

    const result = await executePipeline(baseInput, makeAIService());

    expect(result.status).toBe("COMPLETED");
    expect(result.stageResults[0].status).toBe("FAILED");
    expect(result.stageResults[1].status).toBe("COMPLETED");
    expect(result.error).toBeUndefined();
  });

  // -------------------------------------------------------------------------
  // Variable resolution
  // -------------------------------------------------------------------------

  it("resolves variables from 'input' source", async () => {
    const stageWithMapping = makeStage({
      inputMapping: JSON.stringify({
        myVar: { source: "input", field: "documentContent" },
      }),
    });
    mockPrisma.promptPipeline.findUnique.mockResolvedValue(
      makePipeline({}, [stageWithMapping]),
    );

    await executePipeline(
      { ...baseInput, inputDocument: "sample document text" },
      makeAIService(),
    );

    // preparePrompt receives resolved variables
    expect(preparePrompt).toHaveBeenCalledWith(
      "prompt-tmpl-1",
      expect.objectContaining({ myVar: "sample document text" }),
    );
  });

  it("resolves variables from a previous stage output", async () => {
    const stageOne = makeStage({ id: "s1", name: "S1", order: 1 });
    const stageTwo = makeStage({
      id: "s2",
      name: "S2",
      order: 2,
      inputMapping: JSON.stringify({
        prevOutput: { source: "s1", field: "threats" },
      }),
    });

    mockPrisma.promptPipeline.findUnique.mockResolvedValue(
      makePipeline({}, [stageOne, stageTwo]),
    );

    mockPrisma.pipelineStageExecution.findFirst.mockImplementation(
      ({ where }: { where: { stageId: string } }) =>
        Promise.resolve({
          id: where.stageId === "s1" ? "se-s1" : "se-s2",
          pipelineExecutionId: "exec-1",
          stageId: where.stageId,
        }),
    );

    // Stage 1 returns JSON with 'threats' field
    const aiService = {
      complete: vi
        .fn()
        .mockResolvedValueOnce({
          content: '{"threats":["XSS"]}',
          usage: { totalTokens: 10 },
        })
        .mockResolvedValueOnce({
          content: '{"done":true}',
          usage: { totalTokens: 10 },
        }),
    } as unknown as AIService;

    await executePipeline(baseInput, aiService);

    // Second call to preparePrompt should receive resolved variable from stage 1
    expect(preparePrompt).toHaveBeenNthCalledWith(
      2,
      "prompt-tmpl-1",
      expect.objectContaining({ prevOutput: ["XSS"] }),
    );
  });

  // -------------------------------------------------------------------------
  // documentId loading
  // -------------------------------------------------------------------------

  it("loads document content from documentId when provided", async () => {
    mockPrisma.document.findUnique.mockResolvedValue({
      content: "doc content from DB",
    });

    const stageWithMapping = makeStage({
      inputMapping: JSON.stringify({
        doc: { source: "input", field: "documentContent" },
      }),
    });
    mockPrisma.promptPipeline.findUnique.mockResolvedValue(
      makePipeline({}, [stageWithMapping]),
    );

    await executePipeline(
      { ...baseInput, documentId: "doc-123" },
      makeAIService(),
    );

    expect(mockPrisma.document.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "doc-123" } }),
    );
    expect(preparePrompt).toHaveBeenCalledWith(
      "prompt-tmpl-1",
      expect.objectContaining({ doc: "doc content from DB" }),
    );
  });

  // -------------------------------------------------------------------------
  // mergeStageOutputs (via finalResult)
  // -------------------------------------------------------------------------

  it("merges multiple stage outputs into finalResult", async () => {
    const s1 = makeStage({ id: "s1", name: "S1", order: 1 });
    const s2 = makeStage({ id: "s2", name: "S2", order: 2 });

    mockPrisma.promptPipeline.findUnique.mockResolvedValue(
      makePipeline({}, [s1, s2]),
    );
    mockPrisma.pipelineStageExecution.findFirst.mockImplementation(
      ({ where }: { where: { stageId: string } }) =>
        Promise.resolve({
          id: where.stageId === "s1" ? "se-s1" : "se-s2",
          pipelineExecutionId: "exec-1",
          stageId: where.stageId,
        }),
    );

    const aiService = {
      complete: vi
        .fn()
        .mockResolvedValueOnce({
          content: '{"alpha":1}',
          usage: { totalTokens: 5 },
        })
        .mockResolvedValueOnce({
          content: '{"beta":2}',
          usage: { totalTokens: 5 },
        }),
    } as unknown as AIService;

    const result = await executePipeline(baseInput, aiService);

    expect(result.finalResult).toEqual({ alpha: 1, beta: 2 });
    expect(result.totalTokensUsed).toBe(10);
  });
});
