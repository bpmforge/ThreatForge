import { readFileSync } from "node:fs";
import {
  SEVERITIES,
  ModelError,
  isMitigated,
  parseModel,
  type Severity,
} from "./model.js";

export interface IO {
  out: (s: string) => void;
  err: (s: string) => void;
}

const USAGE = `Usage: ftm validate <model.yaml> [--fail-on <severity>] [--json]

  --fail-on <severity>  Fail (exit 1) when any threat at or above this severity is
                        unmitigated. One of ${SEVERITIES.join(", ")}. Default: CRITICAL
  --json                Machine-readable output

Exit codes: 0 pass, 1 unmitigated threats at/above threshold, 2 parse/schema/usage error`;

/** Returns the process exit code. */
export function run(
  argv: string[],
  io: IO = { out: console.log, err: console.error },
): number {
  const args = [...argv];
  if (args[0] === "--help" || args[0] === "-h" || args.length === 0) {
    io.out(USAGE);
    return args.length === 0 ? 2 : 0;
  }
  if (args.shift() !== "validate") {
    io.err(`Unknown command\n${USAGE}`);
    return 2;
  }

  let failOn: Severity = "CRITICAL";
  let json = false;
  let file: string | undefined;
  while (args.length) {
    const a = args.shift()!;
    if (a === "--json") json = true;
    else if (a === "--fail-on" || a.startsWith("--fail-on=")) {
      const v = (
        a.includes("=") ? a.split("=")[1] : args.shift()
      )?.toUpperCase();
      if (!v || !(SEVERITIES as readonly string[]).includes(v)) {
        io.err(`--fail-on must be one of ${SEVERITIES.join(", ")}`);
        return 2;
      }
      failOn = v as Severity;
    } else if (a.startsWith("--")) {
      io.err(`Unknown option ${a}\n${USAGE}`);
      return 2;
    } else file = a;
  }
  if (!file) {
    io.err(USAGE);
    return 2;
  }

  const fail = (problems: string[]): number => {
    if (json)
      io.out(JSON.stringify({ file, valid: false, errors: problems }, null, 2));
    else {
      io.err(`ftm: ${file} is not a valid threat model`);
      problems.forEach((p) => io.err(`  x ${p}`));
    }
    return 2;
  };

  let text: string;
  try {
    text = readFileSync(file, "utf8");
  } catch (e) {
    return fail([`Cannot read file: ${(e as Error).message}`]);
  }

  let model;
  try {
    model = parseModel(text);
  } catch (e) {
    if (e instanceof ModelError) return fail(e.problems);
    throw e;
  }

  const threshold = SEVERITIES.indexOf(failOn);
  const unmitigated = model.threats.filter((t) => !isMitigated(t));
  const blocking = unmitigated.filter(
    (t) => SEVERITIES.indexOf(t.severity) <= threshold,
  );
  const pass = blocking.length === 0;
  const row = (t: (typeof model.threats)[number]) => ({
    id: t.id ?? null,
    name: t.name,
    severity: t.severity,
  });

  if (json) {
    io.out(
      JSON.stringify(
        {
          file,
          valid: true,
          pass,
          failOn,
          model: model.name,
          counts: {
            components: model.components,
            connections: model.connections,
            threats: model.threats.length,
            unmitigated: unmitigated.length,
          },
          blocking: blocking.map(row),
        },
        null,
        2,
      ),
    );
  } else {
    io.out(
      `${model.name}: ${model.components} components, ${model.threats.length} threats, ${unmitigated.length} unmitigated`,
    );
    for (const t of blocking)
      io.out(
        `  x [${t.severity}] ${t.name}${t.id ? ` (${t.id})` : ""} - unmitigated`,
      );
    io.out(
      pass
        ? `PASS (no unmitigated ${failOn}+ threats)`
        : `FAIL: ${blocking.length} unmitigated threat(s) at ${failOn} or above`,
    );
  }
  return pass ? 0 : 1;
}
