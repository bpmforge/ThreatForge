/**
 * eval-run — score AI threat output for QUALITY, not equivalence.
 *
 * The parity harness answers "did this refactor change the output?" It cannot
 * answer "is the output any good?", because golden-threats.json is a recorded
 * snapshot: whatever the model emitted became the definition of correct. So a
 * prompt change that helps and one that hurts are procedurally identical —
 * both end in a re-record and a green suite.
 *
 * This script answers the other question, against human-labelled ground truth:
 *
 *   precision = TRUE_POSITIVE / (TRUE_POSITIVE + FALSE_POSITIVE)
 *               of what the model claimed, how much was real?
 *   duplicate rate
 *             = DUPLICATE / labelled
 *               how much of the output is the same finding said twice? This is
 *               the abstraction-level metric — high means threats are being
 *               emitted at instance grain instead of class grain.
 *   recall    = expectations matched / expectations enabled
 *               of what a reviewer expects to exist, how much was found?
 *
 * Inputs (both hand-authored, both optional):
 *   threat-labels.json    verdicts for the snapshot   -> precision, duplicates
 *   expected-threats.json threats that SHOULD exist   -> recall
 *
 * Unlabelled entries are excluded rather than assumed correct, so a partial
 * labelling pass still yields a valid number over a smaller denominator. The
 * coverage figure is printed so a precision score from 6 labels is never
 * mistaken for one from 76.
 *
 * Usage:
 *   npx tsx scripts/eval-run.ts              # score the committed snapshot
 *   npx tsx scripts/eval-run.ts --json       # machine-readable, for CI trends
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { TokenTotals } from "../src/services/ai/providers/token-meter.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(
  __dirname,
  "..",
  "src",
  "test",
  "fixtures",
  "go-forward",
);
const GOLDEN_PATH = join(FIXTURES_DIR, "golden-threats.json");
const LABELS_PATH = join(FIXTURES_DIR, "threat-labels.json");
const SEED_LABELS_DIR = join(FIXTURES_DIR, "labels");
const EXPECTED_PATH = join(FIXTURES_DIR, "expected-threats.json");
const SEEDS_DIR = join(FIXTURES_DIR, "seeds");

type Verdict = "TRUE_POSITIVE" | "FALSE_POSITIVE" | "DUPLICATE" | null;

interface GoldenEntry {
  key: string;
  name: string;
  category: string;
  severity: string;
  componentId?: string;
}

interface LabelEntry {
  key: string;
  name: string;
  componentId?: string;
  verdict: Verdict;
  duplicateOf?: string | null;
  note?: string;
}

interface ExpectedEntry {
  componentId: string;
  category: string;
  match: string[];
  rationale?: string;
  enabled?: boolean;
}

/** Mirrors normalizeThreatName's intent: order-insensitive, punctuation-free. */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .join(" ");
}

function readJson<T>(path: string): T | null {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as T;
  } catch (err) {
    console.error(`  ! could not parse ${path}: ${(err as Error).message}`);
    return null;
  }
}

function pct(n: number, d: number): string {
  if (d === 0) return "n/a";
  return `${((n / d) * 100).toFixed(1)}%`;
}

/**
 * Does this expectation match anywhere in one normalized snapshot?
 *
 * The STRIDE category is NOT part of the match, and that is a deliberate
 * correction. It used to be, and it manufactured phantom gaps: password reset
 * on the Auth Service read ABSENT in every recording, which motivated a whole
 * feature — while the model was in fact producing password-reset threats in 4
 * of 6 recordings and merely filing them under ELEVATION_OF_PRIVILEGE or
 * REPUDIATION instead of SPOOFING.
 *
 * Requiring exact category agreement measures TAXONOMY AGREEMENT, not coverage.
 * The register's §5 defines a threat as the class plus the affected asset; which
 * STRIDE bucket an analyst files it under is a judgement call, and a reviewer
 * asking "did it find the password-reset problem?" does not care about the
 * bucket. `category` is retained on each expectation as documentation of the
 * class a reviewer had in mind, and is reported when a match is found
 * elsewhere — but it no longer gates the match.
 */
function matchesSnapshot(
  exp: ExpectedEntry,
  snapshot: Array<{ componentId?: string; category: string; norm: string }>,
): boolean {
  return snapshot.some(
    (g) =>
      g.componentId === exp.componentId &&
      exp.match.some((m) => g.norm.includes(normalize(m))),
  );
}

/**
 * Independent recordings of the same code, committed under seeds/. Named
 * golden-seed-NN.json so ordering is stable and adding one is a file copy.
 */
function loadSeeds(): Array<{
  name: string;
  code: string;
  tokens: TokenTotals | null;
  entries: GoldenEntry[];
}> {
  if (!existsSync(SEEDS_DIR)) return [];
  const manifest =
    readJson<{
      seeds: Record<string, { code?: string; tokens?: TokenTotals }>;
    }>(join(SEEDS_DIR, "manifest.json"))?.seeds ?? {};
  return readdirSync(SEEDS_DIR)
    .filter((f) => f.endsWith(".json") && f !== "manifest.json")
    .sort()
    .map((f) => ({
      name: f,
      code: manifest[f]?.code ?? "unknown",
      // X-01: copied from the recorder's "Tokens:" line. Seeds recorded before
      // token accounting have none and print as "not recorded", never as 0.
      tokens: manifest[f]?.tokens ?? null,
      entries: readJson<GoldenEntry[]>(join(SEEDS_DIR, f)) ?? [],
    }))
    .filter((s) => s.entries.length > 0);
}

/**
 * Resolve `--seed=<name>` to one recording. Accepts the full file name, the
 * name without `.json`, or any unambiguous substring ("seed-08"). Ambiguity is
 * an error rather than a guess: scoring the wrong recording produces a
 * plausible-looking number for the wrong thing.
 */
export function resolveSeed<T extends { name: string }>(
  arg: string,
  seeds: T[],
): T {
  const exact = seeds.find((s) => s.name === arg || s.name === `${arg}.json`);
  if (exact) return exact;
  const hits = seeds.filter((s) => s.name.includes(arg));
  if (hits.length === 1) return hits[0]!;
  throw new Error(
    hits.length === 0
      ? `no seed matches "${arg}" (have: ${seeds.map((s) => s.name).join(", ")})`
      : `"${arg}" is ambiguous: ${hits.map((s) => s.name).join(", ")}`,
  );
}

/** Per-expectation hit counts over one group of comparable recordings. */
function stabilityFor(
  expected: ExpectedEntry[],
  group: Array<{ entries: GoldenEntry[] }>,
): Array<{ expectation: string; hits: number; of: number }> {
  return expected.map((exp) => ({
    expectation: `${exp.componentId}/${exp.category}`,
    hits: group.filter((s) =>
      matchesSnapshot(
        exp,
        s.entries.map((g) => ({
          componentId: g.componentId,
          category: g.category,
          norm: normalize(g.name),
        })),
      ),
    ).length,
    of: group.length,
  }));
}

async function main(): Promise<void> {
  const asJson = process.argv.includes("--json");
  const seedArg = process.argv
    .find((a) => a.startsWith("--seed="))
    ?.slice("--seed=".length);

  // --seed scores one committed recording instead of the canon snapshot, with
  // its own labels file (labels/<seed>.labels.json) so a per-seed labelling
  // pass never adds orphans to the default run's threat-labels.json.
  let golden = readJson<GoldenEntry[]>(GOLDEN_PATH);
  let labelsPath = LABELS_PATH;
  if (seedArg) {
    const seed = resolveSeed(seedArg, loadSeeds());
    golden = seed.entries;
    labelsPath = join(
      SEED_LABELS_DIR,
      `${seed.name.replace(/\.json$/, "")}.labels.json`,
    );
  }
  if (!golden) {
    console.error("No golden-threats.json — run `npm run parity:run` first.");
    process.exit(1);
  }

  const labelsFile = readJson<{ threats: LabelEntry[] }>(labelsPath);
  const expectedFile = readJson<{ expected: ExpectedEntry[] }>(EXPECTED_PATH);

  // ---- Precision + duplicate rate, from labels -------------------------
  // Labels join to golden by `key`, which embeds the threat's normalized token
  // set — so a prompt change renames threats, changes their keys, and ORPHANS
  // the labels. Scoring the labels file on its own would then report the OLD
  // precision at 100% coverage against a golden the labels no longer describe,
  // which is finding M4 in a new costume: a stale number indistinguishable
  // from a current one. So score only labels that still match a golden entry,
  // and denominate coverage by GOLDEN, not by the labels file.
  const goldenKeys = new Set(golden.map((g) => g.key));
  const allLabels = labelsFile?.threats ?? [];
  const labels = allLabels.filter((l) => goldenKeys.has(l.key));
  const orphaned = allLabels.length - labels.length;
  const labelled = labels.filter((l) => l.verdict !== null);
  const tp = labelled.filter((l) => l.verdict === "TRUE_POSITIVE").length;
  const fp = labelled.filter((l) => l.verdict === "FALSE_POSITIVE").length;
  const dup = labelled.filter((l) => l.verdict === "DUPLICATE").length;

  // A DUPLICATE is a real finding, so it does not count against precision —
  // it is an abstraction problem, reported separately.
  const precisionDenom = tp + fp;
  const coverage = golden.length > 0 ? labelled.length / golden.length : 0;

  // ---- Recall, from expectations ---------------------------------------
  const expected = (expectedFile?.expected ?? []).filter(
    (e) => e.enabled !== false,
  );
  const goldenNorm = golden.map((g) => ({
    componentId: g.componentId,
    category: g.category,
    norm: normalize(g.name),
  }));

  const missed: ExpectedEntry[] = [];
  let matched = 0;
  for (const exp of expected) {
    const hit = matchesSnapshot(exp, goldenNorm);
    if (hit) matched++;
    else missed.push(exp);
  }

  // ---- Stability across seeds ------------------------------------------
  // A single recording cannot support a before/after claim on this fixture:
  // two runs of IDENTICAL code produced 84 and 100 threats with 12.2% key
  // overlap, and recall 2/10 vs 4/10. Ten expectations means one flickering
  // finding is worth ten points, so a 2x swing needs no cause at all.
  //
  // Seeds are independent recordings of the same code, committed under
  // seeds/. With two or more, every expectation gets a hit RATE instead of a
  // coin toss, and the ones that reproduce are separable from the tail.
  const seeds = loadSeeds();

  // Group by pipeline code version. Pooling recordings made under DIFFERENT
  // code silently mixes populations, and the resulting STABLE/FLAKY/ABSENT
  // labels then describe no version in particular — the same failure mode as
  // reporting a stale precision as current. Groups are never merged.
  const byCode = new Map<string, typeof seeds>();
  for (const s of seeds) {
    const g = byCode.get(s.code) ?? [];
    g.push(s);
    byCode.set(s.code, g);
  }
  const groups = [...byCode.entries()].map(([code, members]) => ({
    code,
    members,
    recalls: members.map(
      (m) =>
        expected.filter((e) =>
          matchesSnapshot(
            e,
            m.entries.map((g) => ({
              componentId: g.componentId,
              category: g.category,
              norm: normalize(g.name),
            })),
          ),
        ).length,
    ),
    stability: members.length >= 2 ? stabilityFor(expected, members) : [],
  }));

  const result = {
    fixture: "go-forward",
    emitted: golden.length,
    labels: {
      total: labels.length,
      orphaned,
      labelled: labelled.length,
      coverage,
      truePositive: tp,
      falsePositive: fp,
      duplicate: dup,
      precision: precisionDenom > 0 ? tp / precisionDenom : null,
      duplicateRate: labelled.length > 0 ? dup / labelled.length : null,
    },
    recall: {
      expectations: expected.length,
      matched,
      missed: missed.length,
      recall: expected.length > 0 ? matched / expected.length : null,
    },
    seeds: {
      count: seeds.length,
      groups: groups.map((g) => ({
        code: g.code,
        seeds: g.members.map((m) => m.name),
        threatsPerSeed: g.members.map((m) => m.entries.length),
        tokensPerSeed: g.members.map((m) => m.tokens),
        recallPerSeed: g.recalls,
        recallMin: g.recalls.length ? Math.min(...g.recalls) : null,
        recallMax: g.recalls.length ? Math.max(...g.recalls) : null,
        stability: g.stability,
      })),
    },
  };

  if (asJson) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log("\n=== AI threat quality — go-forward fixture ===\n");
  console.log(`  threats emitted by the model : ${golden.length}`);

  if (orphaned > 0) {
    console.log(
      `\n  ! ${orphaned} of ${allLabels.length} labels no longer match any golden entry\n` +
        "    and are EXCLUDED. The snapshot was re-recorded after they were written,\n" +
        "    so those verdicts describe threats that no longer exist. Re-label.",
    );
  }

  if (allLabels.length === 0) {
    console.log(
      "\n  PRECISION: no threat-labels.json — nothing to score against.",
    );
  } else if (labelled.length === 0) {
    console.log(
      `\n  PRECISION: none of the ${golden.length} current threats is labelled.\n` +
        '             Set "verdict" in threat-labels.json to produce a score.',
    );
  } else {
    console.log(
      `\n  labelled                     : ${labelled.length}/${golden.length}  (${pct(labelled.length, golden.length)} of the CURRENT snapshot)`,
    );
    console.log(`    TRUE_POSITIVE              : ${tp}`);
    console.log(`    FALSE_POSITIVE             : ${fp}`);
    console.log(`    DUPLICATE                  : ${dup}`);
    console.log(
      `\n  PRECISION                    : ${pct(tp, precisionDenom)}   (real / (real + wrong))`,
    );
    console.log(
      `  DUPLICATE RATE               : ${pct(dup, labelled.length)}   (abstraction-level signal)`,
    );
    if (coverage < 0.5) {
      console.log(
        "\n  ! Under half the snapshot is labelled — treat precision as indicative only.",
      );
    }
  }

  if (expected.length === 0) {
    console.log(
      "\n  RECALL: no enabled entries in expected-threats.json.\n" +
        "          Recall is UNMEASURABLE without it — a snapshot can only ever\n" +
        "          contain what the model already found.",
    );
  } else {
    console.log(
      `\n  RECALL                       : ${pct(matched, expected.length)}   (${matched}/${expected.length} expectations met)`,
    );
    if (missed.length > 0) {
      console.log("\n  MISSED — expected but not found:");
      for (const m of missed) {
        console.log(`    - [${m.componentId}/${m.category}] ${m.match[0]}`);
        if (m.rationale) console.log(`        ${m.rationale}`);
      }
    }
  }

  if (seeds.length === 0) {
    console.log(
      "\n  ! No seed recordings in seeds/. Two runs of identical code have\n" +
        "    measured 84 vs 100 threats and recall 2/10 vs 4/10, so a single\n" +
        "    snapshot cannot support a before/after claim.",
    );
  } else {
    for (const g of groups) {
      const n = g.members.length;
      console.log(`\n  === code "${g.code}" — ${n} recording(s) ===`);
      console.log(
        `  seeds            : ${g.members.map((m) => m.name).join(", ")}`,
      );
      console.log(
        `  threats per seed : ${g.members.map((m) => m.entries.length).join(", ")}`,
      );
      console.log(
        `  tokens per seed  : ${g.members
          .map((m) =>
            m.tokens
              ? `${m.tokens.promptTokens}+${m.tokens.completionTokens} in ${m.tokens.calls} calls, max prompt ${m.tokens.maxPromptTokens}`
              : "not recorded",
          )
          .join(", ")}  (prompt+completion)`,
      );
      if (n < 2) {
        console.log(
          `  recall           : ${g.recalls[0]}/${expected.length}  — single sample, NOT a baseline`,
        );
        continue;
      }
      const lo = Math.min(...g.recalls);
      const hi = Math.max(...g.recalls);
      console.log(
        `  recall per seed  : ${g.recalls.map((r) => `${r}/${expected.length}`).join(", ")}  → spread ${lo}-${hi}`,
      );
      const stable = g.stability.filter((x) => x.hits === x.of);
      const absent = g.stability.filter((x) => x.hits === 0);
      console.log(
        `  ${stable.length} STABLE · ${g.stability.length - stable.length - absent.length} FLAKY · ${absent.length} ABSENT`,
      );
      if (absent.length > 0) {
        console.log("  ABSENT in every recording:");
        for (const a of absent) console.log(`    - ${a.expectation}`);
      }
    }
    if (groups.length > 1) {
      console.log(
        "\n  ! Seeds span " +
          groups.length +
          " code versions and are NOT pooled. Comparing groups is only\n" +
          "    valid where each has enough recordings to separate a real change\n" +
          "    from the spread shown above.",
      );
    }
    if (groups.some((g) => g.code === "unknown")) {
      console.log(
        "\n  ! Some seeds are missing from seeds/manifest.json and are grouped as\n" +
          '    "unknown". Add them so their code version is explicit.',
      );
    }
  }

  console.log(
    "\n  Note: precision here measures agreement with the labeller, not truth.\n" +
      "  Re-label after any change to the fixture model itself.\n",
  );
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error("eval-run failed:", err);
    process.exit(1);
  });
}
