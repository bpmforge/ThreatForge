import { describe, it, expect, vi, beforeEach } from "vitest";
import { persistExtractedSequences } from "../persist.js";
import type { ExtractedSequenceDiagram } from "../types.js";

function makePrisma(existingCount = 0) {
  const diagramCreates: any[] = [];
  const participantCreates: any[] = [];
  const messageCreates: any[] = [];
  let diagramCount = existingCount;
  let participantCount = 0;

  const api = {
    sequenceDiagram: {
      count: vi.fn().mockResolvedValue(diagramCount),
      create: vi.fn(async ({ data }: any) => {
        const row = { id: `diag_${++diagramCount}`, ...data };
        diagramCreates.push(row);
        return row;
      }),
    },
    sequenceParticipant: {
      create: vi.fn(async ({ data }: any) => {
        const row = { id: `part_${++participantCount}`, ...data };
        participantCreates.push(row);
        return row;
      }),
    },
    sequenceMessage: {
      create: vi.fn(async ({ data }: any) => {
        const row = { id: `msg_${messageCreates.length + 1}`, ...data };
        messageCreates.push(row);
        return row;
      }),
    },
  };
  return { api, diagramCreates, participantCreates, messageCreates };
}

function makeDiagram(
  overrides: Partial<ExtractedSequenceDiagram> = {},
): ExtractedSequenceDiagram {
  return {
    name: "Login",
    format: "mermaid",
    participants: [
      { label: "Client", order: 0 },
      { label: "API", order: 1 },
    ],
    messages: [
      {
        from: "Client",
        to: "API",
        label: "POST /login",
        order: 0,
        messageType: "SYNC",
        isReturn: false,
        sourceQuote: "Client->>API: POST /login",
      },
      {
        from: "API",
        to: "Client",
        label: "200 OK",
        order: 1,
        messageType: "RETURN",
        isReturn: false,
        sourceQuote: "API-->>Client: 200 OK",
      },
    ],
    sourceQuote: "sequenceDiagram\nClient->>API: POST /login",
    ...overrides,
  };
}

describe("persistExtractedSequences", () => {
  let mock: ReturnType<typeof makePrisma>;
  // No-op resolver — tests in this block focus on persistence shape, not
  // auto-linking. Pass it via opts so persist doesn't try to read components.
  const noLinks = () => ({ nodeId: null, score: 0 });
  const persistOpts = {
    threatModelId: "tm1",
    userId: "u1",
    linkResolver: noLinks,
  };

  beforeEach(() => {
    mock = makePrisma();
  });

  it("creates diagram + participants + messages for a single diagram", async () => {
    const results = await persistExtractedSequences(
      mock.api as any,
      [makeDiagram()],
      persistOpts,
    );

    expect(results).toHaveLength(1);
    expect(results[0].participantCount).toBe(2);
    expect(results[0].messageCount).toBe(2);
    expect(mock.diagramCreates).toHaveLength(1);
    expect(mock.participantCreates).toHaveLength(2);
    expect(mock.messageCreates).toHaveLength(2);
  });

  it("collapses RETURN messageType to SYNC + isReturn=true", async () => {
    await persistExtractedSequences(
      mock.api as any,
      [makeDiagram()],
      persistOpts,
    );
    // Message 2 was messageType=RETURN in the input
    const returnMessage = mock.messageCreates[1];
    expect(returnMessage.messageType).toBe("SYNC");
    expect(returnMessage.isReturn).toBe(true);
  });

  it("keeps ASYNC messageType on the record", async () => {
    const diagram = makeDiagram({
      messages: [
        {
          from: "A",
          to: "B",
          label: "fire",
          order: 0,
          messageType: "ASYNC",
          isReturn: false,
          sourceQuote: "A-)B: fire",
        },
      ],
      participants: [
        { label: "A", order: 0 },
        { label: "B", order: 1 },
      ],
    });
    await persistExtractedSequences(mock.api as any, [diagram], persistOpts);
    expect(mock.messageCreates[0].messageType).toBe("ASYNC");
  });

  it("leaves message.notes unset — raw Mermaid syntax would clutter the UI", async () => {
    await persistExtractedSequences(
      mock.api as any,
      [makeDiagram()],
      persistOpts,
    );
    for (const m of mock.messageCreates) {
      expect(m.notes).toBeUndefined();
    }
  });

  it("leaves participant.componentId null when the resolver returns no match", async () => {
    await persistExtractedSequences(
      mock.api as any,
      [makeDiagram()],
      persistOpts,
    );
    for (const p of mock.participantCreates) {
      expect(p.componentId).toBeNull();
    }
  });

  it("sets participant.componentId from the link resolver when matched", async () => {
    const resolver = (label: string) =>
      label === "Client"
        ? { nodeId: "node-client", score: 1.0, matchedName: "Client" }
        : { nodeId: null, score: 0 };
    const results = await persistExtractedSequences(
      mock.api as any,
      [makeDiagram()],
      { threatModelId: "tm1", userId: "u1", linkResolver: resolver },
    );
    const clientPart = mock.participantCreates.find(
      (p) => p.label === "Client",
    );
    const apiPart = mock.participantCreates.find((p) => p.label === "API");
    expect(clientPart?.componentId).toBe("node-client");
    expect(apiPart?.componentId).toBeNull();
    expect(results[0].linkedParticipantCount).toBe(1);
  });

  it("falls back to a DB lookup when no linkResolver is supplied", async () => {
    const findMany = vi
      .fn()
      .mockResolvedValue([
        { nodeId: "node-x", name: "Client", technology: null },
      ]);
    const apiWithComponents = {
      ...(mock.api as any),
      component: { findMany },
    };
    await persistExtractedSequences(apiWithComponents as any, [makeDiagram()], {
      threatModelId: "tm1",
      userId: "u1",
    });
    expect(findMany).toHaveBeenCalledOnce();
    const clientPart = mock.participantCreates.find(
      (p) => p.label === "Client",
    );
    expect(clientPart?.componentId).toBe("node-x");
  });

  it("offsets new diagrams by the existing diagram count", async () => {
    mock = makePrisma(2);
    await persistExtractedSequences(
      mock.api as any,
      [makeDiagram()],
      persistOpts,
    );
    expect(mock.diagramCreates[0].order).toBe(2);
  });

  it("appends duplicates on re-upload — no name-match dedup", async () => {
    // A re-upload where the parser produces the same Login flow again must
    // NOT be silently swallowed — the new version may have added steps.
    // User prunes the stale copy manually.
    mock = makePrisma(1);
    const results = await persistExtractedSequences(
      mock.api as any,
      [makeDiagram({ name: "Login" })],
      persistOpts,
    );
    expect(results[0].name).toBe("Login");
    expect(mock.diagramCreates).toHaveLength(1);
    expect(mock.diagramCreates[0].order).toBe(1);
  });

  it("drops messages whose from/to don't resolve to known participants", async () => {
    const diagram = makeDiagram({
      messages: [
        {
          from: "Client",
          to: "API",
          label: "ok",
          order: 0,
          messageType: "SYNC",
          isReturn: false,
          sourceQuote: "ok line",
        },
        {
          from: "Ghost",
          to: "API",
          label: "should not appear",
          order: 1,
          messageType: "SYNC",
          isReturn: false,
          sourceQuote: "ghost line",
        },
      ],
    });
    const results = await persistExtractedSequences(
      mock.api as any,
      [diagram],
      persistOpts,
    );
    expect(results[0].messageCount).toBe(1);
    expect(mock.messageCreates).toHaveLength(1);
  });

  it("returns [] and does nothing when given no diagrams", async () => {
    const results = await persistExtractedSequences(
      mock.api as any,
      [],
      persistOpts,
    );
    expect(results).toEqual([]);
    expect(mock.api.sequenceDiagram.create).not.toHaveBeenCalled();
  });

  it("persists both when the same batch has identical names (append-only)", async () => {
    const results = await persistExtractedSequences(
      mock.api as any,
      [makeDiagram({ name: "Login" }), makeDiagram({ name: "Login" })],
      persistOpts,
    );
    expect(results).toHaveLength(2);
    expect(mock.diagramCreates).toHaveLength(2);
    expect(mock.diagramCreates[0].order).toBe(0);
    expect(mock.diagramCreates[1].order).toBe(1);
  });
});
