/**
 * /labs/menu-edge: e2e fixture for context menus opened near the bottom of
 * the viewport (e2e/menu-edge.spec.ts). Returns 404 in production.
 */
import { notFound } from "next/navigation";
import { MenuEdgeClient } from "./MenuEdgeClient";

export const metadata = { title: "Menu Edge — ThreatForge Labs" };

export default function MenuEdgePage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return (
    <main className="h-screen w-screen" aria-label="context menu edge repro">
      <MenuEdgeClient />
    </main>
  );
}
