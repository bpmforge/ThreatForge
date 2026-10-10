/**
 * collision — label collision avoidance.
 *
 * When multiple edges share the same label midpoint, compute a per-edge
 * perpendicular offset so labels don't overlap.
 */

type Pt = { x: number; y: number };

export interface LabelPlacement {
  edgeId: string;
  midpoint: Pt;
  /** labelOffset from ConnectionData; null means default (center). */
  offset: "above" | "center" | "below" | null;
}

export interface DodgedPlacement {
  edgeId: string;
  /** Perpendicular offset in px (positive = right/down of path direction). */
  perp: number;
}

const CLUSTER_RADIUS = 20; // px — labels within this distance are "same cluster"
const STEP = 16; // px between dodged labels

/**
 * For a set of label placements, compute a perpendicular pixel offset
 * for each edge so labels in the same spatial cluster don't overlap.
 *
 * Edges that already have an explicit labelOffset keep perp=0 (user chose
 * their position). Only auto-placed labels (offset=null/"center") are dodged.
 */
export function computeLabelDodge(
  placements: LabelPlacement[],
): DodgedPlacement[] {
  const result: DodgedPlacement[] = placements.map((p) => ({
    edgeId: p.edgeId,
    perp: 0,
  }));

  // Find clusters: groups of auto-placed labels within CLUSTER_RADIUS of each other
  const autoIdx = placements
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => p.offset === null || p.offset === "center");

  const visited = new Set<number>();
  for (let a = 0; a < autoIdx.length; a++) {
    if (visited.has(a)) continue;
    const cluster: number[] = [a];
    for (let b = a + 1; b < autoIdx.length; b++) {
      if (visited.has(b)) continue;
      const pa = autoIdx[a].p.midpoint;
      const pb = autoIdx[b].p.midpoint;
      if (Math.hypot(pa.x - pb.x, pa.y - pb.y) < CLUSTER_RADIUS) {
        cluster.push(b);
      }
    }
    if (cluster.length > 1) {
      // Spread cluster members evenly around centre
      const half = (cluster.length - 1) / 2;
      cluster.forEach((ci, rank) => {
        visited.add(ci);
        const origIdx = autoIdx[ci].i;
        result[origIdx].perp = (rank - half) * STEP;
      });
    }
  }

  return result;
}
