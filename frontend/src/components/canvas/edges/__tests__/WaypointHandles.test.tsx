import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";

// Mock useReactFlow
vi.mock("@xyflow/react", () => ({
  useReactFlow: () => ({
    screenToFlowPosition: ({ x, y }: { x: number; y: number }) => ({ x, y }),
  }),
}));

import { WaypointHandles } from "../WaypointHandles";
import type { Segment } from "../path-segments";

const BASE_PROPS = {
  corners: [{ x: 100, y: 100 }],
  onUpdate: vi.fn(),
  onCommit: vi.fn(),
};

const SEGMENTS: Segment[] = [
  {
    start: { x: 0, y: 100 },
    end: { x: 100, y: 100 },
    orientation: "horizontal",
    midpoint: { x: 50, y: 100 },
    waypointIndex: null,
    manual: false,
  },
  {
    start: { x: 100, y: 100 },
    end: { x: 100, y: 200 },
    orientation: "vertical",
    midpoint: { x: 100, y: 150 },
    waypointIndex: null,
    manual: false,
  },
];

beforeEach(() => {
  vi.clearAllMocks();
});

describe("WaypointHandles — no segments", () => {
  it("renders nothing", () => {
    const { container } = render(
      <svg>
        <WaypointHandles {...BASE_PROPS} segments={[]} />
      </svg>,
    );
    expect(container.querySelectorAll("rect, circle").length).toBe(0);
  });
});

describe("WaypointHandles — pill handles", () => {
  it("renders pills for the provided segments", () => {
    const { container } = render(
      <svg>
        <WaypointHandles {...BASE_PROPS} segments={SEGMENTS} />
      </svg>,
    );
    // Per axis-aligned segment: full-length grab band + midpoint hit-box +
    // visible pill = 3 rects. Plus 2 endpoint squares at source/target.
    const rects = container.querySelectorAll("rect");
    expect(rects.length).toBe(SEGMENTS.length * 3 + 2);
  });

  it("gives each segment a full-length grab band, not just a midpoint pill", () => {
    const { container } = render(
      <svg>
        <WaypointHandles {...BASE_PROPS} segments={SEGMENTS} />
      </svg>,
    );
    const rects = Array.from(container.querySelectorAll("rect"));

    // The horizontal segment spans x 0..100; its band must cover most of that
    // run rather than the ~16px pill hit-box, so the line can be grabbed
    // anywhere along it.
    const horizontalBand = rects.find(
      (r) =>
        Number(r.getAttribute("width")) > 50 &&
        Number(r.getAttribute("height")) < 20,
    );
    expect(horizontalBand).toBeTruthy();

    // Same for the vertical segment spanning y 100..200.
    const verticalBand = rects.find(
      (r) =>
        Number(r.getAttribute("height")) > 50 &&
        Number(r.getAttribute("width")) < 20,
    );
    expect(verticalBand).toBeTruthy();
  });

  it("renders a pill per segment", () => {
    const { container } = render(
      <svg>
        <WaypointHandles {...BASE_PROPS} segments={SEGMENTS} />
      </svg>,
    );
    const groups = container.querySelectorAll("g");
    expect(groups.length).toBe(SEGMENTS.length);
  });

  it("manual waypoint segment renders filled pill", () => {
    const manualSegments: Segment[] = [
      { ...SEGMENTS[0], waypointIndex: 0, manual: true },
    ];
    const { container } = render(
      <svg>
        <WaypointHandles {...BASE_PROPS} segments={manualSegments} />
      </svg>,
    );
    const visuals = container.querySelectorAll(
      "rect:not([fill='transparent'])",
    );
    expect(visuals[0].getAttribute("fill")).toBe("#3b82f6");
  });

  it("auto segment renders hollow pill", () => {
    const { container } = render(
      <svg>
        <WaypointHandles {...BASE_PROPS} segments={[SEGMENTS[0]]} />
      </svg>,
    );
    const visuals = container.querySelectorAll(
      "rect:not([fill='transparent'])",
    );
    expect(visuals[0].getAttribute("fill")).toBe("white");
  });

  it("hit-box is larger than visual pill", () => {
    const { container } = render(
      <svg>
        <WaypointHandles {...BASE_PROPS} segments={[SEGMENTS[0]]} />
      </svg>,
    );
    const rects = Array.from(container.querySelectorAll("rect"));
    const hitBox = rects.find((r) => r.getAttribute("fill") === "transparent");
    const visual = rects.find((r) => r.getAttribute("fill") !== "transparent");
    expect(Number(hitBox?.getAttribute("width"))).toBeGreaterThan(
      Number(visual?.getAttribute("width")),
    );
    expect(Number(hitBox?.getAttribute("height"))).toBeGreaterThan(
      Number(visual?.getAttribute("height")),
    );
  });
});
