/**
 * The sidebar separator has side margins, so a full-width separator overflows
 * the sidebar by 16px and puts a horizontal scrollbar under the nav.
 */
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { SidebarSeparator } from "./sidebar-content";

describe("SidebarSeparator", () => {
  it("does not keep the base separator's full width alongside its margins", () => {
    const { container } = render(<SidebarSeparator />);
    const cls = (container.firstElementChild as HTMLElement).className;
    expect(cls).toContain("mx-2");
    expect(cls).not.toContain("w-full");
  });
});
