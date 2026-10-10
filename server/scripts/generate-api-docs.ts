/**
 * Regenerate the API route tables in docs/FEATURES.md from the registered
 * Fastify routes (between the BEGIN/END GENERATED ROUTES markers).
 *
 * Usage (from server/): npm run docs:routes
 */
import { readFileSync, writeFileSync } from "node:fs";
import {
  FEATURES_PATH,
  collectRouteDocs,
  renderRoutesSection,
  spliceGeneratedSection,
} from "../src/docs/route-docs.js";

const routes = await collectRouteDocs();
const current = readFileSync(FEATURES_PATH, "utf8");
const next = spliceGeneratedSection(current, renderRoutesSection(routes));
if (next === current) {
  console.log(`docs/FEATURES.md is up to date (${routes.length} routes).`);
} else {
  writeFileSync(FEATURES_PATH, next);
  console.log(`docs/FEATURES.md updated (${routes.length} routes).`);
}
// Imported services (queues, timers) can hold the event loop open.
process.exit(0);
