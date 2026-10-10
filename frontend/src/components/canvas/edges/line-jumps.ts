/**
 * Line Jump Utilities
 *
 * Detects where orthogonal edge segments cross and inserts
 * semicircle arc "jumps" — matching draw.io / Visio / Lucidchart behavior.
 *
 * Convention: horizontal segments show the jump arc (over vertical crossings).
 */

interface Point {
  x: number;
  y: number;
}

interface Segment {
  from: Point;
  to: Point;
}

/**
 * Parse SVG path into line segments (M/L commands).
 * Curves (Q/C/A) advance the cursor but don't create segments.
 */
export function parsePathSegments(d: string): Segment[] {
  const segments: Segment[] = [];
  const tokens = d.match(/[MLHVCSQTA][^MLHVCSQTA]*/gi);
  if (!tokens) return segments;

  let cx = 0,
    cy = 0;

  for (const token of tokens) {
    const type = token[0].toUpperCase();
    const nums = token
      .slice(1)
      .trim()
      .split(/[\s,]+/)
      .map(Number);

    switch (type) {
      case "M":
        cx = nums[0];
        cy = nums[1];
        break;
      case "L":
        segments.push({
          from: { x: cx, y: cy },
          to: { x: nums[0], y: nums[1] },
        });
        cx = nums[0];
        cy = nums[1];
        break;
      case "H":
        segments.push({ from: { x: cx, y: cy }, to: { x: nums[0], y: cy } });
        cx = nums[0];
        break;
      case "V":
        segments.push({ from: { x: cx, y: cy }, to: { x: cx, y: nums[0] } });
        cy = nums[0];
        break;
      case "Q":
        cx = nums[2];
        cy = nums[3];
        break;
      case "C":
        cx = nums[4];
        cy = nums[5];
        break;
      case "A":
        cx = nums[5];
        cy = nums[6];
        break;
    }
  }

  return segments;
}

/**
 * Find points where `mySegs` horizontal segments cross `otherSegs` vertical segments.
 * Only the horizontal edge shows the jump — avoids double-arc at same point.
 */
export function findHorizontalCrossings(
  mySegs: Segment[],
  otherSegs: Segment[],
): Point[] {
  const MARGIN = 15; // min px from segment endpoint to avoid false positives
  const MIN_SEG_LEN = 30; // ignore very short segments (routing artifacts)
  const crossings: Point[] = [];

  for (const h of mySegs) {
    if (Math.abs(h.from.y - h.to.y) > 0.5) continue; // must be horizontal
    const hLen = Math.abs(h.from.x - h.to.x);
    if (hLen < MIN_SEG_LEN) continue; // skip tiny segments

    const hY = h.from.y;
    const hMin = Math.min(h.from.x, h.to.x);
    const hMax = Math.max(h.from.x, h.to.x);

    for (const v of otherSegs) {
      if (Math.abs(v.from.x - v.to.x) > 0.5) continue; // must be vertical
      const vLen = Math.abs(v.from.y - v.to.y);
      if (vLen < MIN_SEG_LEN) continue; // skip tiny segments

      const vX = v.from.x;
      const vMin = Math.min(v.from.y, v.to.y);
      const vMax = Math.max(v.from.y, v.to.y);

      if (
        vX > hMin + MARGIN &&
        vX < hMax - MARGIN &&
        hY > vMin + MARGIN &&
        hY < vMax - MARGIN
      ) {
        // Deduplicate: skip if too close to an existing crossing
        const isDupe = crossings.some(
          (c) => Math.abs(c.x - vX) < 20 && Math.abs(c.y - hY) < 20,
        );
        if (!isDupe) {
          crossings.push({ x: vX, y: hY });
        }
      }
    }
  }

  return crossings;
}

/**
 * Insert semicircle arc jumps into an SVG path at crossing points.
 * Only modifies L (line-to) segments on horizontal lines.
 */
export function insertLineJumps(
  d: string,
  crossings: Point[],
  radius = 6,
): string {
  if (crossings.length === 0) return d;

  const tokens = d.match(/[MLHVCSQTA][^MLHVCSQTA]*/gi);
  if (!tokens) return d;

  const result: string[] = [];
  let cx = 0,
    cy = 0;

  for (const token of tokens) {
    const type = token[0].toUpperCase();
    const nums = token
      .slice(1)
      .trim()
      .split(/[\s,]+/)
      .map(Number);

    if (type === "M") {
      result.push(`M ${nums[0]} ${nums[1]}`);
      cx = nums[0];
      cy = nums[1];
      continue;
    }

    if (type === "L") {
      const tx = nums[0],
        ty = nums[1];
      const isH = Math.abs(cy - ty) < 0.5;

      if (!isH) {
        result.push(`L ${tx} ${ty}`);
        cx = tx;
        cy = ty;
        continue;
      }

      // Find crossings on this horizontal segment
      const hMin = Math.min(cx, tx);
      const hMax = Math.max(cx, tx);
      const onSeg = crossings.filter(
        (pt) =>
          Math.abs(pt.y - cy) < 1 &&
          pt.x > hMin + radius &&
          pt.x < hMax - radius,
      );

      if (onSeg.length === 0) {
        result.push(`L ${tx} ${ty}`);
      } else {
        const dir = tx > cx ? 1 : -1;
        onSeg.sort((a, b) => dir * (a.x - b.x));

        for (const pt of onSeg) {
          const preX = pt.x - dir * radius;
          const postX = pt.x + dir * radius;
          result.push(`L ${preX} ${cy}`);
          // Semicircle arc: sweep flag depends on direction
          result.push(
            `A ${radius} ${radius} 0 0 ${dir > 0 ? 1 : 0} ${postX} ${cy}`,
          );
        }
        result.push(`L ${tx} ${ty}`);
      }

      cx = tx;
      cy = ty;
      continue;
    }

    // Pass through other commands unchanged
    result.push(token.trim());
    if (type === "H") cx = nums[0];
    else if (type === "V") cy = nums[0];
    else if (type === "Q") {
      cx = nums[2];
      cy = nums[3];
    } else if (type === "C") {
      cx = nums[4];
      cy = nums[5];
    } else if (type === "A") {
      cx = nums[5];
      cy = nums[6];
    }
  }

  return result.join(" ");
}
