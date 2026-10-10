import { useEffect, useRef, useCallback } from "react";

type Pt = { x: number; y: number };

/** Snap an endpoint to the nearest 45° from a source point. */
export function snapTo45(from: Pt, to: Pt): Pt {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const angle = Math.atan2(dy, dx);
  const snapped = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);
  const len = Math.hypot(dx, dy);
  return {
    x: from.x + Math.cos(snapped) * len,
    y: from.y + Math.sin(snapped) * len,
  };
}

/**
 * Tracks Shift key state. Returns a ref that is true when Shift is held
 * and a snap function that snaps to 45° increments when Shift is active.
 */
export function useShiftSnap() {
  const shiftHeld = useRef(false);

  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (e.key === "Shift") shiftHeld.current = true;
    };
    const onUp = (e: KeyboardEvent) => {
      if (e.key === "Shift") shiftHeld.current = false;
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
    };
  }, []);

  const maybeSnap = useCallback((from: Pt, to: Pt): Pt => {
    return shiftHeld.current ? snapTo45(from, to) : to;
  }, []);

  return { shiftHeld, maybeSnap };
}
