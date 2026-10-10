import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { RichLabel } from "./RichLabel";
import { ComponentNodeInner } from "./ComponentNodeInner";
import type { ComponentNodeData } from "@/types/canvas";

describe("RichLabel", () => {
  it("renders bold, italic and lists as elements", () => {
    const { container } = render(
      <RichLabel value={"**Bold** and *it*\n- one\n- two\n1. first"} />,
    );
    expect(container.querySelector("strong")?.textContent).toBe("Bold");
    expect(container.querySelector("em")?.textContent).toBe("it");
    expect(container.querySelectorAll("ul > li")).toHaveLength(2);
    expect(container.querySelectorAll("ol > li")).toHaveLength(1);
  });

  it("never injects HTML (XSS payloads stay literal text)", () => {
    const payloads = [
      '<img src=x onerror="window.__xss=1">',
      "<script>window.__xss=1</script>",
      "**<b onclick=alert(1)>x</b>**",
      "[click](javascript:alert(1))",
      '- <svg onload="window.__xss=1"/>',
    ];
    for (const p of payloads) {
      const { container, unmount } = render(<RichLabel value={p} />);
      expect(container.querySelector("script,img,svg,a,b")).toBeNull();
      expect(container.innerHTML).not.toMatch(/<(script|img|svg|a)\b/i);
      expect((window as unknown as { __xss?: number }).__xss).toBeUndefined();
      unmount();
    }
    render(<RichLabel value="<script>x</script>" />);
    expect(screen.getByText("<script>x</script>")).toBeTruthy();
  });

  it("node renders richLabel when set, plain label otherwise", () => {
    const data = {
      label: "Plain",
      type: "SERVICE",
      trustLevel: "INTERNAL",
      richLabel: "**Rich** node",
    } as unknown as ComponentNodeData;
    const { container, rerender } = render(<ComponentNodeInner data={data} />);
    expect(container.querySelector("strong")?.textContent).toBe("Rich");
    rerender(<ComponentNodeInner data={{ ...data, richLabel: undefined }} />);
    expect(container.querySelector("strong")).toBeNull();
    expect(screen.getByText("Plain")).toBeTruthy();
  });
});
