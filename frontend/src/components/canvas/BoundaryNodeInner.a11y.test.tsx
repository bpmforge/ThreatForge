import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import axe from "axe-core";
import { BoundaryNodeInner } from "./BoundaryNodeInner";
import type { BoundaryNodeData } from "@/types/canvas";

const data = {
  label: "DMZ",
  trustLevel: "INTERNAL",
  description: "Public-facing zone",
} as BoundaryNodeData;

async function violations(selected: boolean) {
  const { container } = render(
    <BoundaryNodeInner
      data={data}
      selected={selected}
      childCount={2}
      nestingDepth={0}
      onToggleCollapse={() => {}}
    />,
  );
  const result = await axe.run(container, {
    runOnly: ["aria-allowed-attr", "nested-interactive"],
  });
  return result.violations.map((v) => v.id);
}

describe("BoundaryNodeInner accessibility", () => {
  it("uses only ARIA attributes its roles allow, with no nested controls", async () => {
    expect(await violations(false)).toEqual([]);
    expect(await violations(true)).toEqual([]);
  });
});
