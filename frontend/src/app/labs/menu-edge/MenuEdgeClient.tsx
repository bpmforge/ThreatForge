"use client";

/**
 * /labs/menu-edge — regression scaffold for the "context menu near the viewport
 * bottom opens/closes fast and selects something" bug (see the pointer-release
 * guard in components/ui/context-menu.tsx). Uses the SAME shared Radix
 * ContextMenu primitives as the canvas menu, with a 14-item body so the
 * content height (~500px) matches NodeContextMenu, and triggers at several
 * vertical offsets incl. hard against the bottom edge. Driven by
 * e2e/menu-edge.spec.ts, with no canvas, auth or DB. `log()` mirrors item selections to
 * window.__mlog so the e2e "a deliberate item click still selects" check can
 * assert the guard did not break legitimate selection.
 */
import { Fragment } from "react";
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuLabel,
} from "@/components/ui/context-menu";

const log = (...a: unknown[]) => {
  const w = window as unknown as { __mlog?: string[] };
  (w.__mlog ??= []).push(a.map(String).join(" "));
};

const ITEMS = [
  "Edit Properties",
  "Add Threat",
  "Browse Threat Catalog",
  "Suggest Threats (AI)",
  "Analyze Just This Component",
  "Duplicate",
  "Lock",
  "Copy Style",
  "Paste Style",
  "Bring to Front",
  "Send to Back",
  "Bring Forward",
  "Send Backward",
  "Delete",
];

function NodeishMenu({ pos }: { pos: string }) {
  return (
    <ContextMenuContent className="w-56">
      <ContextMenuLabel>Component</ContextMenuLabel>
      <ContextMenuSeparator />
      {ITEMS.map((label, i) => (
        <Fragment key={label}>
          <ContextMenuItem
            variant={label === "Delete" ? "destructive" : "default"}
            onSelect={() => log(pos, "SELECTED", label)}
          >
            {label}
          </ContextMenuItem>
          {(i === 4 || i === 8) && <ContextMenuSeparator />}
        </Fragment>
      ))}
    </ContextMenuContent>
  );
}

const POSITIONS: { label: string; style: React.CSSProperties }[] = [
  { label: "top", style: { top: 20 } },
  { label: "middle", style: { top: "45%" } },
  { label: "near-bottom-40", style: { bottom: 40 } },
  { label: "very-bottom-4", style: { bottom: 4 } },
];

export function MenuEdgeClient() {
  return (
    <div className="relative h-screen w-screen bg-slate-50">
      {POSITIONS.map((p) => (
        <ContextMenu key={p.label}>
          <ContextMenuTrigger asChild>
            <div
              data-pos={p.label}
              className="absolute left-1/2 flex h-16 w-64 -translate-x-1/2 items-center justify-center rounded border border-slate-300 bg-white text-sm text-slate-700 shadow-sm"
              style={p.style}
            >
              right-click me ({p.label})
            </div>
          </ContextMenuTrigger>
          <NodeishMenu pos={p.label} />
        </ContextMenu>
      ))}
    </div>
  );
}
