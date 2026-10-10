/**
 * S1 regression guard: every AI route scoped to a :modelId must authorize the
 * caller against that model.
 *
 * Per-route mock tests prove the routes that exist today behave. They do not
 * stop the NEXT route from forgetting, which is how this class of bug arrived:
 * chat, refinement and attack-tree all checked access, while agentic-analysis,
 * expert-analysis and suggestions — added later, doing strictly more with the
 * model — did not. The gap was invisible because each file looked reasonable
 * on its own.
 *
 * So this asserts the invariant over the source: a file that registers a
 * `/api/threat-models/:modelId/...` route must call canAccessThreatModel or
 * canEditThreatModel (or
 * a role-aware helper: authorizeModelAction, requireThreatModelEdit, or
 * loadSynthesisInputs, which calls authorizeModelAction) at least
 * as many times as it registers such routes. Crude, and deliberately so
 * — it fails loudly when someone adds a model-scoped route without the check,
 * which is exactly when a reviewer needs telling.
 */
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROUTES_DIR = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Route registrations scoped to a specific threat model. */
const MODEL_SCOPED_ROUTE = /["'`]\/api\/threat-models\/:modelId\//g;
const ACCESS_CHECK =
  /\b(?:canAccessThreatModel|canEditThreatModel|aiServiceForModelEditor|authorizeModelAction|requireThreatModelEdit|loadSynthesisInputs)\s*\(/g;

function countMatches(source: string, re: RegExp): number {
  return (source.match(re) ?? []).length;
}

describe("model-scoped AI routes authorize the caller", () => {
  const files = readdirSync(ROUTES_DIR).filter(
    (f) => f.endsWith(".ts") && !f.endsWith(".d.ts"),
  );

  it("finds route files to check (guards against a silently empty sweep)", () => {
    expect(files.length).toBeGreaterThan(5);
  });

  for (const file of files) {
    const source = readFileSync(join(ROUTES_DIR, file), "utf8");
    const routes = countMatches(source, MODEL_SCOPED_ROUTE);
    if (routes === 0) continue;

    it(`${file} authorizes each of its ${routes} model-scoped route(s)`, () => {
      const checks = countMatches(source, ACCESS_CHECK);
      expect(
        checks,
        `${file} registers ${routes} route(s) under /api/threat-models/:modelId/ ` +
          `but calls a model access check ${checks} time(s). An authenticated ` +
          `user is not an authorized one: without the check, any signed-in user ` +
          `can reach another organisation's model.`,
      ).toBeGreaterThanOrEqual(routes);
    });
  }
});
