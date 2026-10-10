/**
 * CancelJob() must abort the v2 pipeline's signal.
 *
 * Two seams: (1) ai-worker's registerJobAbort/cancelJob pair, (2)
 * runPipelineRound handing the job signal to executePipeline as
 * runtime.signal (it used to build the runtime with no signal at all, so
 * pipeline-service fell back to a never-aborting controller).
 */
import { describe, it, expect, vi } from "vitest";

const { executePipelineMock } = vi.hoisted(() => ({
  executePipelineMock: vi.fn(),
}));

vi.mock("../../services/ai/pipeline-service.js", () => ({
  executePipeline: executePipelineMock,
  clearPipelineCache: vi.fn(),
}));
vi.mock("../../services/ai/stages/index.js", () => ({
  registerStageHandlers: vi.fn(),
}));

describe("registerJobAbort / cancelJob", () => {
  it("cancelJob aborts a registered signal; dispose unregisters", async () => {
    const { cancelJob, registerJobAbort } = await import("../ai-worker.js");
    const reg = registerJobAbort("job-b3-a");
    expect(reg.signal.aborted).toBe(false);
    cancelJob("job-b3-a");
    expect(reg.signal.aborted).toBe(true);

    const reg2 = registerJobAbort("job-b3-b");
    reg2.dispose();
    cancelJob("job-b3-b");
    expect(reg2.signal.aborted).toBe(false);
  });

  it("a cancel requested before registration aborts immediately", async () => {
    const { cancelJob, registerJobAbort } = await import("../ai-worker.js");
    cancelJob("job-b3-early");
    expect(registerJobAbort("job-b3-early").signal.aborted).toBe(true);
  });
});

describe("runPipelineRound threads the cancel signal", () => {
  it("passes args.signal to executePipeline as runtime.signal", async () => {
    executePipelineMock.mockResolvedValue({
      status: "FAILED",
      stageResults: [],
      error: { message: "stop" },
    });
    const { runPipelineRound } = await import("../suggest-threats-v2-round.js");
    const controller = new AbortController();
    await expect(
      runPipelineRound(
        {
          prisma: {} as never,
          aiCall: vi.fn(),
          sessionId: "s",
          userId: "u",
          organizationId: "o",
          context: { components: [], connections: [], boundaries: [] } as never,
          options: {},
          signal: controller.signal,
        },
        { id: "p", stages: [] },
      ),
    ).rejects.toThrow("stop");
    const runtime = executePipelineMock.mock.calls[0][2];
    expect(runtime.signal).toBe(controller.signal);
    controller.abort();
    expect(runtime.signal.aborted).toBe(true);
  });
});
