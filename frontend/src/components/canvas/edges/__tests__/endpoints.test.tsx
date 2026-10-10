import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import {
  endpointMarkerId,
  endpointUrl,
  EndpointMarkerDefs,
} from "../endpoints";
import type { EndpointStyle } from "@/types/canvas";

describe("endpointMarkerId", () => {
  it("builds expected id for diamond end", () => {
    expect(endpointMarkerId("diamond", "end")).toBe("ep-diamond-end");
  });

  it("builds expected id for tee start", () => {
    expect(endpointMarkerId("tee", "start")).toBe("ep-tee-start");
  });
});

describe("endpointUrl", () => {
  it("returns undefined for default arrow (React Flow handles it)", () => {
    expect(endpointUrl("arrow", "end")).toBeUndefined();
  });

  it("returns empty string for none (removes default marker)", () => {
    expect(endpointUrl("none", "end")).toBe("");
  });

  it("returns url() for diamond", () => {
    expect(endpointUrl("diamond", "end")).toBe("url(#ep-diamond-end)");
  });

  it("returns url() for tee start", () => {
    expect(endpointUrl("tee", "start")).toBe("url(#ep-tee-start)");
  });

  it("returns undefined when style is undefined", () => {
    expect(endpointUrl(undefined, "end")).toBeUndefined();
  });

  it("each non-arrow style produces a unique url", () => {
    const styles: EndpointStyle[] = [
      "arrow-open",
      "diamond",
      "circle",
      "tee",
      "cross",
    ];
    const urls = styles.map((s) => endpointUrl(s, "end"));
    const unique = new Set(urls);
    expect(unique.size).toBe(styles.length);
  });
});

describe("EndpointMarkerDefs", () => {
  it("renders a <defs> element with markers", () => {
    const { container } = render(
      <svg>
        <EndpointMarkerDefs />
      </svg>,
    );
    const defs = container.querySelector("defs");
    expect(defs).not.toBeNull();
    const markers = container.querySelectorAll("marker");
    expect(markers.length).toBeGreaterThan(0);
  });

  it("renders marker for every non-arrow, non-none style × 2 positions", () => {
    const { container } = render(
      <svg>
        <EndpointMarkerDefs />
      </svg>,
    );
    const ids = Array.from(container.querySelectorAll("marker")).map((m) =>
      m.getAttribute("id"),
    );
    expect(ids).toContain("ep-diamond-end");
    expect(ids).toContain("ep-diamond-start");
    expect(ids).toContain("ep-tee-end");
    expect(ids).toContain("ep-circle-end");
    expect(ids).toContain("ep-cross-end");
    expect(ids).toContain("ep-arrow-open-end");
  });
});
