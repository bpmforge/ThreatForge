/**
 * endpoints.tsx — SVG <marker> definitions for edge arrowhead styles.
 *
 * Render <EndpointMarkerDefs /> once in the canvas SVG overlay (or in a
 * hidden SVG at document root). Then reference markers by id:
 *   markerEnd="url(#ep-arrow)"
 *   markerStart="url(#ep-diamond-start)"
 */
import type { EndpointStyle } from "@/types/canvas";

/** Build the SVG marker id for a given style + position. */
export function endpointMarkerId(
  style: EndpointStyle,
  pos: "start" | "end",
): string {
  return `ep-${style}-${pos}`;
}

/** Convert a ConnectionData endpoint config to a React Flow markerEnd/markerStart URL. */
export function endpointUrl(
  style: EndpointStyle | undefined,
  pos: "start" | "end",
): string | undefined {
  if (!style || style === "arrow") return undefined; // use React Flow default
  if (style === "none") return ""; // explicitly remove default marker
  return `url(#${endpointMarkerId(style, pos)})`;
}

/**
 * SVG <defs> block with all custom arrowhead markers.
 * Render once inside the SVG that hosts the canvas edges.
 */
export function EndpointMarkerDefs() {
  return (
    <defs>
      {/* Open arrow — unfilled arrowhead */}
      <marker
        id="ep-arrow-open-end"
        markerWidth="10"
        markerHeight="7"
        refX="9"
        refY="3.5"
        orient="auto"
      >
        <polyline
          points="0,0 9,3.5 0,7"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        />
      </marker>
      <marker
        id="ep-arrow-open-start"
        markerWidth="10"
        markerHeight="7"
        refX="1"
        refY="3.5"
        orient="auto-start-reverse"
      >
        <polyline
          points="0,0 9,3.5 0,7"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        />
      </marker>

      {/* Diamond */}
      <marker
        id="ep-diamond-end"
        markerWidth="10"
        markerHeight="7"
        refX="10"
        refY="3.5"
        orient="auto"
      >
        <polygon points="5,0 10,3.5 5,7 0,3.5" fill="currentColor" />
      </marker>
      <marker
        id="ep-diamond-start"
        markerWidth="10"
        markerHeight="7"
        refX="0"
        refY="3.5"
        orient="auto-start-reverse"
      >
        <polygon points="5,0 10,3.5 5,7 0,3.5" fill="currentColor" />
      </marker>

      {/* Circle */}
      <marker
        id="ep-circle-end"
        markerWidth="8"
        markerHeight="8"
        refX="7"
        refY="4"
        orient="auto"
      >
        <circle cx="4" cy="4" r="3" fill="currentColor" />
      </marker>
      <marker
        id="ep-circle-start"
        markerWidth="8"
        markerHeight="8"
        refX="1"
        refY="4"
        orient="auto-start-reverse"
      >
        <circle cx="4" cy="4" r="3" fill="currentColor" />
      </marker>

      {/* Tee — mTLS barrier marker */}
      <marker
        id="ep-tee-end"
        markerWidth="6"
        markerHeight="10"
        refX="5"
        refY="5"
        orient="auto"
      >
        <line
          x1="5"
          y1="0"
          x2="5"
          y2="10"
          stroke="currentColor"
          strokeWidth="2"
        />
      </marker>
      <marker
        id="ep-tee-start"
        markerWidth="6"
        markerHeight="10"
        refX="1"
        refY="5"
        orient="auto-start-reverse"
      >
        <line
          x1="1"
          y1="0"
          x2="1"
          y2="10"
          stroke="currentColor"
          strokeWidth="2"
        />
      </marker>

      {/* Cross */}
      <marker
        id="ep-cross-end"
        markerWidth="8"
        markerHeight="8"
        refX="7"
        refY="4"
        orient="auto"
      >
        <line
          x1="1"
          y1="1"
          x2="7"
          y2="7"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <line
          x1="7"
          y1="1"
          x2="1"
          y2="7"
          stroke="currentColor"
          strokeWidth="1.5"
        />
      </marker>
      <marker
        id="ep-cross-start"
        markerWidth="8"
        markerHeight="8"
        refX="1"
        refY="4"
        orient="auto-start-reverse"
      >
        <line
          x1="1"
          y1="1"
          x2="7"
          y2="7"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <line
          x1="7"
          y1="1"
          x2="1"
          y2="7"
          stroke="currentColor"
          strokeWidth="1.5"
        />
      </marker>
    </defs>
  );
}
