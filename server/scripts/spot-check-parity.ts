/**
 * Parity spot-check CLI — the A6 default-ON gate on REAL models.
 *
 * `A6_ROLLOUT.md` requires, before flipping `agent-chain-v2` default-ON:
 *   "Parity spot-checks pass on 3 real models — set-equality on the ADR-006 key,
 *    severity within ±1 ordinal step, mitigation count within ±1."
 *
 * `parity:run` already proves this on the committed FIXTURE (replay caller, no
 * cost). This CLI does the SAME comparison on two REAL persisted analysis runs,
 * so the operator's manual "spot-check parity" step becomes one command instead
 * of eyeballing two review queues.
 *
 * It is a COMPARISON tool — it does not run the pipelines. Produce the two runs
 * first (recommended, because ADR-006 dedup would merge two runs on the SAME
 * model):
 *   1. Duplicate the model (or use two equivalent models): M_legacy, M_v2.
 *   2. `agent-chain-v2` OFF → Suggest Threats on M_legacy → note its
 *      `analysisSessionId` (`--list` below prints it).
 *   3. `agent-chain-v2` ON  → Suggest Threats on M_v2 → note its session.
 *   4. `npm run parity:spot-check -- --legacy <sessionId> --v2 <sessionId>`
 *
 * Reuses the A0-2 comparator (`compareThreatSets`) — set-equality on the
 * ADR-006 key `${target}::${category}::${normalizeThreatName(name)}`, severity
 * drift > 1 and mitigation-count drift > 1 fail. Exit 0 = parity, 1 = drift.
 *
 *   npm run parity:spot-check -- --list --model <modelId>   # find session ids
 *   npm run parity:spot-check -- --legacy <sidA> --v2 <sidB>
 */
import "dotenv/config";
import { getPrisma } from "../src/db.js";
import {
  compareThreatSets,
  formatParityReport,
  type ThreatLike,
} from "../src/test/helpers/parity.js";

interface DbThreat {
  name: string;
  category: string | null;
  severity: ThreatLike["severity"];
  componentNodeId: string | null;
  connectionEdgeId: string | null;
  _count: { mitigations: number };
}

/** Map a persisted Threat row to the parity comparator's structural shape. */
export function toThreatLike(t: DbThreat): ThreatLike {
  return {
    name: t.name,
    category: t.category ?? "",
    severity: t.severity,
    componentId: t.componentNodeId,
    connectionEdgeId: t.connectionEdgeId,
    mitigationCount: t._count.mitigations,
  };
}

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main(): Promise<void> {
  const prisma = await getPrisma();

  // --list: print the analysis sessions on a model so the operator can pick the
  // two runs to compare.
  if (process.argv.includes("--list")) {
    const modelId = arg("--model");
    if (!modelId) {
      console.error("--list requires --model <modelId>");
      process.exit(2);
    }
    const rows = await prisma.threat.groupBy({
      by: ["analysisSessionId"],
      where: { threatModelId: modelId, analysisSessionId: { not: null } },
      _count: { _all: true },
    });
    if (rows.length === 0) {
      console.log(`No analysis sessions found for model ${modelId}.`);
      return;
    }
    console.log(`Analysis sessions for model ${modelId}:`);
    for (const r of rows) {
      console.log(`  ${r.analysisSessionId}  (${r._count._all} threats)`);
    }
    return;
  }

  const legacySession = arg("--legacy");
  const v2Session = arg("--v2");
  if (!legacySession || !v2Session) {
    console.error(
      "Usage: parity:spot-check -- --legacy <sessionId> --v2 <sessionId>\n" +
        "       parity:spot-check -- --list --model <modelId>",
    );
    process.exit(2);
  }

  const select = {
    name: true,
    category: true,
    severity: true,
    componentNodeId: true,
    connectionEdgeId: true,
    _count: { select: { mitigations: true } },
  } as const;

  const [legacyRows, v2Rows] = await Promise.all([
    prisma.threat.findMany({
      where: { analysisSessionId: legacySession },
      select,
    }),
    prisma.threat.findMany({ where: { analysisSessionId: v2Session }, select }),
  ]);

  if (legacyRows.length === 0 || v2Rows.length === 0) {
    console.error(
      `Empty run(s): legacy(${legacySession})=${legacyRows.length} threats, ` +
        `v2(${v2Session})=${v2Rows.length} threats. Check the session ids with --list.`,
    );
    process.exit(2);
  }

  const report = compareThreatSets(
    legacyRows.map(toThreatLike),
    v2Rows.map(toThreatLike),
  );

  console.log(
    `\nLegacy session : ${legacySession} (${legacyRows.length} threats)`,
  );
  console.log(`v2 session     : ${v2Session} (${v2Rows.length} threats)`);
  console.log(formatParityReport(report));
  console.log(report.pass ? "\nPARITY: PASS ✅" : "\nPARITY: FAIL ❌");

  process.exit(report.pass ? 0 : 1);
}

// Only run the CLI when executed directly (tsx scripts/spot-check-parity.ts),
// not when imported by a unit test for `toThreatLike`.
const invokedPath = process.argv[1] ?? "";
if (invokedPath.endsWith("spot-check-parity.ts")) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
