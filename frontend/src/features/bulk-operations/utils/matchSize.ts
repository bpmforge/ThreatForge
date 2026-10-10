/** Mode for match-size operation */
export type MatchSizeMode = "width" | "height" | "both";

interface NodeDims {
  id: string;
  locked?: boolean;
  width: number;
  height: number;
}

/**
 * Returns new {width, height} for each unlocked target so it matches ref.
 * Falls back to current dimension when mode excludes that axis.
 */
export function computeMatchedSizes(
  ref: { width: number; height: number },
  targets: NodeDims[],
  mode: MatchSizeMode,
): Map<string, { width: number; height: number }> {
  const result = new Map<string, { width: number; height: number }>();
  for (const t of targets) {
    if (t.locked) continue;
    result.set(t.id, {
      width: mode === "height" ? t.width : ref.width,
      height: mode === "width" ? t.height : ref.height,
    });
  }
  return result;
}
