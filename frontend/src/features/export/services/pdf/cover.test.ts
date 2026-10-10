import { describe, it, expect } from "vitest";
import type { Node } from "@xyflow/react";
import { getSummarySection } from "./cover";

describe("getSummarySection", () => {
  it("counts components the way the Components table lists them", () => {
    const nodes = [
      { id: "b", type: "boundary", position: { x: 0, y: 0 }, data: {} },
      { id: "a", type: "component", position: { x: 0, y: 0 }, data: {} },
      { id: "c", type: "component", position: { x: 0, y: 0 }, data: {} },
    ] as Node[];
    const html = getSummarySection(nodes, [], []);
    expect(html).toMatch(
      /<div class="value">2<\/div><div class="label">Components/,
    );
  });
});
