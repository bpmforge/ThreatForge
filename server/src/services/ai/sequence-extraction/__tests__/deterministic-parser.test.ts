import { describe, it, expect } from "vitest";
import {
  detectSequenceBlocks,
  parseDeterministicSequences,
  parseMermaidBlock,
  parsePlantUMLBlock,
} from "../deterministic-parser.js";

// ---------------------------------------------------------------------------
// Block detection
// ---------------------------------------------------------------------------

describe("detectSequenceBlocks", () => {
  it("finds a fenced mermaid block", () => {
    const doc = [
      "Some prose.",
      "```mermaid",
      "sequenceDiagram",
      "Client->>API: login",
      "```",
      "More prose.",
    ].join("\n");

    const blocks = detectSequenceBlocks(doc);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].format).toBe("mermaid");
    expect(blocks[0].body).toContain("Client->>API");
  });

  it("finds a fenced plantuml block (plantuml and puml tags)", () => {
    const doc1 = "```plantuml\nA -> B: msg\n```";
    const doc2 = "```puml\nA -> B: msg\n```";
    expect(detectSequenceBlocks(doc1)).toHaveLength(1);
    expect(detectSequenceBlocks(doc2)).toHaveLength(1);
    expect(detectSequenceBlocks(doc1)[0].format).toBe("plantuml");
    expect(detectSequenceBlocks(doc2)[0].format).toBe("plantuml");
  });

  it("finds a bare ```...``` fence whose body declares sequenceDiagram", () => {
    const doc = "```\nsequenceDiagram\nClient->>API: x\n```";
    const blocks = detectSequenceBlocks(doc);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].format).toBe("mermaid");
  });

  it("finds @startuml...@enduml outside a fence", () => {
    const doc = [
      "Introduction.",
      "@startuml",
      "A -> B: hello",
      "@enduml",
      "End.",
    ].join("\n");
    const blocks = detectSequenceBlocks(doc);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].format).toBe("plantuml");
  });

  it("returns blocks in document order when multiple appear", () => {
    const doc = [
      "```mermaid",
      "sequenceDiagram",
      "A->>B: first",
      "```",
      "between",
      "```plantuml",
      "C -> D: second",
      "```",
    ].join("\n");
    const blocks = detectSequenceBlocks(doc);
    expect(blocks).toHaveLength(2);
    expect(blocks[0].body).toContain("first");
    expect(blocks[1].body).toContain("second");
  });

  it("rejects a mermaid classDiagram block (not a sequence diagram)", () => {
    const doc = "```mermaid\nclassDiagram\nclass Foo\n```";
    expect(detectSequenceBlocks(doc)).toHaveLength(0);
  });

  it("rejects a plantuml class diagram", () => {
    const doc = "```plantuml\nclass Foo\nFoo -- Bar\n```";
    expect(detectSequenceBlocks(doc)).toHaveLength(0);
  });

  it("returns empty array for plain prose", () => {
    expect(detectSequenceBlocks("Just some text with no diagrams.")).toEqual(
      [],
    );
  });

  it("does not double-count a block tagged AND wrapped in @startuml", () => {
    const doc = "```plantuml\n@startuml\nA -> B: x\n@enduml\n```";
    const blocks = detectSequenceBlocks(doc);
    expect(blocks).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Mermaid parsing
// ---------------------------------------------------------------------------

describe("parseMermaidBlock", () => {
  it("parses a basic diagram with explicit participants and solid arrows", () => {
    const body = [
      "sequenceDiagram",
      "participant Client",
      "participant API",
      "participant DB",
      "Client->>API: POST /login",
      "API->>DB: SELECT user",
      "DB-->>API: row",
      "API-->>Client: 200 OK",
    ].join("\n");

    const r = parseMermaidBlock(body);
    expect(r.participants.map((p) => p.label)).toEqual(["Client", "API", "DB"]);
    expect(r.messages).toHaveLength(4);
    expect(r.messages[0]).toMatchObject({
      from: "Client",
      to: "API",
      label: "POST /login",
      order: 0,
      messageType: "SYNC",
      isReturn: false,
    });
    expect(r.messages[2]).toMatchObject({
      from: "DB",
      to: "API",
      messageType: "RETURN",
      isReturn: true,
    });
  });

  it("auto-declares participants referenced only in messages", () => {
    const body = ["sequenceDiagram", "Alice->>Bob: hi"].join("\n");
    const r = parseMermaidBlock(body);
    expect(r.participants.map((p) => p.label)).toEqual(["Alice", "Bob"]);
  });

  it('honors `participant X as "Display Name"` declarations', () => {
    const body = [
      "sequenceDiagram",
      'participant C as "Customer Web"',
      "C->>Backend: request",
    ].join("\n");
    const r = parseMermaidBlock(body);
    expect(r.participants[0].label).toBe("Customer Web");
  });

  it("classifies async arrows (-) and (-x) as ASYNC", () => {
    const body = [
      "sequenceDiagram",
      "A-)B: fire and forget",
      "A-xB: dropped",
    ].join("\n");
    const r = parseMermaidBlock(body);
    expect(r.messages[0].messageType).toBe("ASYNC");
    expect(r.messages[1].messageType).toBe("ASYNC");
  });

  it("ignores activate / deactivate / notes / alt blocks", () => {
    const body = [
      "sequenceDiagram",
      "participant A",
      "participant B",
      "Note over A: starting",
      "activate A",
      "A->>B: go",
      "deactivate A",
      "alt success",
      "B-->>A: ok",
      "else failure",
      "B-->>A: err",
      "end",
    ].join("\n");
    const r = parseMermaidBlock(body);
    // Just the 3 real messages — notes/activate/alt tokens skipped
    expect(r.messages.map((m) => m.label)).toEqual(["go", "ok", "err"]);
  });

  it("picks up a title directive", () => {
    const body = ["sequenceDiagram", "title Login flow", "A->>B: login"].join(
      "\n",
    );
    expect(parseMermaidBlock(body).name).toBe("Login flow");
  });

  it("strips %% comments", () => {
    const body = ["sequenceDiagram", "A->>B: real %% this is commentary"].join(
      "\n",
    );
    expect(parseMermaidBlock(body).messages[0].label).toBe("real");
  });

  it("each message records the verbatim source line as sourceQuote", () => {
    const body = ["sequenceDiagram", "  A->>B: hello world  "].join("\n");
    const r = parseMermaidBlock(body);
    expect(r.messages[0].sourceQuote).toBe("A->>B: hello world");
  });
});

// ---------------------------------------------------------------------------
// PlantUML parsing
// ---------------------------------------------------------------------------

describe("parsePlantUMLBlock", () => {
  it("parses a basic diagram with participant declarations", () => {
    const body = [
      "@startuml",
      "actor User",
      'participant "Web Server" as WS',
      "database DB",
      "User -> WS: login",
      "WS -> DB: query",
      "DB --> WS: result",
      "WS --> User: page",
      "@enduml",
    ].join("\n");

    const r = parsePlantUMLBlock(body);
    expect(r.participants.map((p) => p.label)).toEqual([
      "User",
      "Web Server",
      "DB",
    ]);
    expect(r.messages).toHaveLength(4);
    expect(r.messages[0]).toMatchObject({
      from: "User",
      to: "Web Server",
      label: "login",
      messageType: "SYNC",
    });
    expect(r.messages[2]).toMatchObject({
      from: "DB",
      to: "Web Server",
      messageType: "RETURN",
      isReturn: true,
    });
  });

  it("classifies ->> and <<- as ASYNC", () => {
    const body = [
      "@startuml",
      "A ->> B: async go",
      "B <<- C: async back",
      "@enduml",
    ].join("\n");
    const r = parsePlantUMLBlock(body);
    expect(r.messages[0]).toMatchObject({
      from: "A",
      to: "B",
      messageType: "ASYNC",
    });
    expect(r.messages[1]).toMatchObject({
      from: "C",
      to: "B",
      messageType: "ASYNC",
    });
  });

  it("reverses direction for <- arrows (from always sends)", () => {
    const body = "@startuml\nClient <- Server: response\n@enduml";
    const r = parsePlantUMLBlock(body);
    expect(r.messages[0].from).toBe("Server");
    expect(r.messages[0].to).toBe("Client");
  });

  it("strips lines beginning with ' (PlantUML comments)", () => {
    const body = [
      "@startuml",
      "' this is a comment",
      "A -> B: real msg",
      "@enduml",
    ].join("\n");
    expect(parsePlantUMLBlock(body).messages).toHaveLength(1);
  });

  it("ignores skinparam / hide / group / note", () => {
    const body = [
      "@startuml",
      "skinparam sequenceArrowThickness 2",
      "hide footbox",
      "group login sequence",
      "A -> B: request",
      "note right: careful",
      "end",
      "@enduml",
    ].join("\n");
    expect(parsePlantUMLBlock(body).messages).toHaveLength(1);
  });

  it("picks up a title directive", () => {
    const body = "@startuml\ntitle Payment Flow\nA -> B: x\n@enduml";
    expect(parsePlantUMLBlock(body).name).toBe("Payment Flow");
  });

  it("handles quoted participant names in messages", () => {
    const body = [
      "@startuml",
      '"Customer Web" -> "Order Service": create order',
      "@enduml",
    ].join("\n");
    const r = parsePlantUMLBlock(body);
    expect(r.participants.map((p) => p.label)).toEqual([
      "Customer Web",
      "Order Service",
    ]);
    expect(r.messages[0].from).toBe("Customer Web");
    expect(r.messages[0].to).toBe("Order Service");
  });
});

// ---------------------------------------------------------------------------
// End-to-end
// ---------------------------------------------------------------------------

describe("parseDeterministicSequences", () => {
  it("returns [] for a document with no diagrams", () => {
    expect(
      parseDeterministicSequences("Plain prose without diagrams."),
    ).toEqual([]);
  });

  it("parses a mixed mermaid + plantuml document into two diagrams", () => {
    const doc = [
      "# SRS",
      "## Login flow",
      "```mermaid",
      "sequenceDiagram",
      "title Login",
      "Client->>API: POST /login",
      "API-->>Client: 200",
      "```",
      "## Payment flow",
      "```plantuml",
      "@startuml",
      "title Payment",
      "actor User",
      "User -> Gateway: pay",
      "Gateway --> User: receipt",
      "@enduml",
      "```",
    ].join("\n");

    const diagrams = parseDeterministicSequences(doc);
    expect(diagrams).toHaveLength(2);
    expect(diagrams[0].format).toBe("mermaid");
    expect(diagrams[0].name).toBe("Login");
    expect(diagrams[0].messages).toHaveLength(2);
    expect(diagrams[1].format).toBe("plantuml");
    expect(diagrams[1].name).toBe("Payment");
    expect(diagrams[1].messages).toHaveLength(2);
  });

  it("drops a block with zero messages (no-op diagrams)", () => {
    const doc = ["```mermaid", "sequenceDiagram", "participant A", "```"].join(
      "\n",
    );
    expect(parseDeterministicSequences(doc)).toEqual([]);
  });

  it("assigns auto-names when no title directive is present", () => {
    const doc = [
      "```mermaid",
      "sequenceDiagram",
      "A->>B: first",
      "```",
      "```mermaid",
      "sequenceDiagram",
      "C->>D: second",
      "```",
    ].join("\n");
    const diagrams = parseDeterministicSequences(doc);
    expect(diagrams[0].name).toMatch(/^Imported Sequence/);
    expect(diagrams[1].name).toMatch(/^Imported Sequence/);
    expect(diagrams[0].name).not.toBe(diagrams[1].name);
  });

  it("stores the full source block on the diagram for traceability", () => {
    const doc = "```mermaid\nsequenceDiagram\nA->>B: msg\n```";
    const diagrams = parseDeterministicSequences(doc);
    expect(diagrams[0].sourceQuote).toContain("sequenceDiagram");
    expect(diagrams[0].sourceQuote).toContain("A->>B: msg");
  });

  it("handles a malformed arrow gracefully (dropped, other messages preserved)", () => {
    const doc = [
      "```mermaid",
      "sequenceDiagram",
      "A->>B: good",
      "nonsense line that isn't an arrow",
      "C->>D: also good",
      "```",
    ].join("\n");
    const diagrams = parseDeterministicSequences(doc);
    expect(diagrams[0].messages.map((m) => m.label)).toEqual([
      "good",
      "also good",
    ]);
  });
});
