#!/usr/bin/env node
// Code-health ratchet: jscpd (clones) + knip (unused files/exports/deps) + optional
// opengrep code-health rules, compared against tools/code-health/baseline.json.
// Usage: see docs/process/CODE_HEALTH_RATCHET.md. Exit 0 = clean, 1 = regression, 2 = tool error.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const BIN = join(HERE, 'node_modules', '.bin');
const BASELINE = join(HERE, 'baseline.json');
const PACKAGES = ['server', 'frontend'];
const OPENGREP_EXCLUDES = ['node_modules', '__tests__', 'test', 'tests', 'test-utils', 'e2e',
  'contracts', 'prisma', '*.test.ts', '*.test.tsx', '*.spec.ts', '*.d.ts'];

const args = process.argv.slice(2);
const UPDATE = args.includes('--update');
const reasonIdx = args.indexOf('--allow-increase');
const REASON = reasonIdx >= 0 ? args[reasonIdx + 1] : undefined;
if (reasonIdx >= 0 && (!REASON || REASON.startsWith('--'))) die('--allow-increase needs a "<reason>"');

function die(msg) { console.error(`code-health: ${msg}`); process.exit(2); }

function run(cmd, cmdArgs, cwd) {
  // opengrep (Python) crashes reading UTF-8 rule files under a C/ASCII locale.
  const env = { ...process.env, PYTHONUTF8: '1', LC_ALL: 'en_US.UTF-8', LANG: 'en_US.UTF-8' };
  const r = spawnSync(cmd, cmdArgs, { cwd, env, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  if (r.error) die(`${cmd} failed to start: ${r.error.message}`);
  return r;
}

// ---- jscpd -----------------------------------------------------------------
// Fingerprint = the (sorted) file pair. A pair may hold several clones, so the
// fingerprint list is a multiset. Line numbers are display-only, so edits that
// shift code never produce phantom "new" findings.
function jscpd(pkg, out) {
  const outDir = mkdtempSync(join(tmpdir(), 'code-health-jscpd-'));
  try {
    const r = run(join(BIN, 'jscpd'), ['-c', join(ROOT, '.jscpd.json'), '-r', 'json', '-o', outDir, '.'], join(ROOT, pkg));
    const reportPath = join(outDir, 'jscpd-report.json');
    if (!existsSync(reportPath)) die(`jscpd produced no report for ${pkg}:\n${r.stderr || r.stdout}`);
    const report = JSON.parse(readFileSync(reportPath, 'utf8'));
    const t = report.statistics.total;
    out.metrics[`${pkg}.jscpd.clones`] = t.clones;
    out.metrics[`${pkg}.jscpd.duplicatedLines`] = t.duplicatedLines;
    out.info[`${pkg}.jscpd.duplicatedPct`] = Math.round(t.percentage * 100) / 100;
    for (const d of report.duplicates) {
      const a = `${pkg}/${d.firstFile.name}`;
      const b = `${pkg}/${d.secondFile.name}`;
      const [x, y] = a <= b ? [a, b] : [b, a];
      const fp = `jscpd ${x} <-> ${y}`;
      out.fingerprints.push(fp);
      (out.details[fp] ??= []).push(
        `${a}:${d.firstFile.start}-${d.firstFile.end} <-> ${b}:${d.secondFile.start}-${d.secondFile.end} (${d.lines} lines)`);
    }
  } finally {
    rmSync(outDir, { recursive: true, force: true });
  }
}

// ---- knip ------------------------------------------------------------------
const KNIP_KINDS = {
  files: 'files', exports: 'exports', nsExports: 'exports', duplicates: 'exports',
  enumMembers: 'exports', namespaceMembers: 'exports', types: 'types', nsTypes: 'types',
  dependencies: 'deps', devDependencies: 'deps', optionalPeerDependencies: 'deps',
  unlisted: 'deps', binaries: 'deps', unresolved: 'deps',
};

function knip(pkg, out) {
  const r = run(join(BIN, 'knip'), ['--directory', pkg, '--config', `../tools/code-health/knip.${pkg}.jsonc`,
    '--no-progress', '--no-exit-code', '--no-config-hints', '--reporter', 'json'], ROOT);
  let report;
  try { report = JSON.parse(r.stdout); } catch { die(`knip output for ${pkg} is not JSON:\n${r.stderr || r.stdout}`); }
  const counts = { files: 0, exports: 0, types: 0, deps: 0 };
  for (const issue of report.issues) {
    for (const [key, bucket] of Object.entries(KNIP_KINDS)) {
      for (const item of issue[key] ?? []) {
        const name = Array.isArray(item) ? item.map((i) => i.name).join('|') : item.name;
        const file = `${pkg}/${issue.file}`;
        const fp = bucket === 'files' ? `knip file ${file}` : `knip ${key} ${file}:${name}`;
        counts[bucket]++;
        out.fingerprints.push(fp);
        const line = Array.isArray(item) ? item[0]?.line : item.line;
        (out.details[fp] ??= []).push(line ? `${file}:${line} ${name}` : bucket === 'files' ? file : `${file} ${name}`);
      }
    }
  }
  for (const [bucket, n] of Object.entries(counts)) out.metrics[`${pkg}.knip.${bucket}`] = n;
}

// ---- opengrep (optional, local only) ----------------------------------------
function opengrep(out) {
  const rules = process.env.CODE_HEALTH_RULES_DIR || '';
  const has = spawnSync('opengrep', ['--version'], { encoding: 'utf8' });
  if (has.error || !existsSync(rules)) {
    console.log(`code-health: opengrep rules skipped (${has.error ? 'opengrep not on PATH' : `no rules at ${rules}`}; set CODE_HEALTH_RULES_DIR)`);
    return false;
  }
  const targets = PACKAGES.map((p) => `${p}/src`);
  const r = run('opengrep', ['scan', '--config', rules, '--json', '--quiet',
    ...OPENGREP_EXCLUDES.map((e) => `--exclude=${e}`), ...targets], ROOT);
  let report;
  try { report = JSON.parse(r.stdout); } catch { die(`opengrep output is not JSON:\n${r.stderr.slice(-2000)}`); }
  for (const pkg of PACKAGES) out.metrics[`${pkg}.opengrep.hits`] = 0;
  for (const hit of report.results) {
    const pkg = hit.path.split('/')[0];
    const rule = hit.check_id.split('.').pop();
    out.metrics[`${pkg}.opengrep.hits`]++;
    const fp = `opengrep ${rule} ${hit.path}`;
    out.fingerprints.push(fp);
    (out.details[fp] ??= []).push(`${hit.path}:${hit.start.line} ${rule}`);
  }
  return true;
}

// ---- compare ---------------------------------------------------------------
function multiset(list) {
  const m = new Map();
  for (const x of list) m.set(x, (m.get(x) ?? 0) + 1);
  return m;
}

const current = { metrics: {}, info: {}, fingerprints: [], details: {} };
for (const pkg of PACKAGES) { jscpd(pkg, current); knip(pkg, current); }
const opengrepRan = opengrep(current);

const base = existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, 'utf8')) : null;
const comparable = (key) => !key.includes('.opengrep.') || (opengrepRan && base?.opengrepRan);
const isOpengrepFp = (fp) => fp.startsWith('opengrep ');

const rises = [];
const drops = [];
const newFindings = [];
if (base) {
  for (const [k, v] of Object.entries(current.metrics)) {
    if (!comparable(k)) continue;
    const b = base.metrics[k] ?? 0;
    if (v > b) rises.push(`${k} ${b} -> ${v}`);
    else if (v < b) drops.push(`${k} ${b} -> ${v}`);
  }
  const baseSet = multiset(base.fingerprints);
  for (const [fp, n] of multiset(current.fingerprints)) {
    if (isOpengrepFp(fp) && !comparable('.opengrep.')) continue;
    const extra = n - (baseSet.get(fp) ?? 0);
    if (extra > 0) newFindings.push({ fp, extra });
  }
}

function writeBaseline(increase) {
  const keepOpengrep = !opengrepRan && base?.opengrepRan;
  const metrics = { ...current.metrics };
  const fingerprints = [...current.fingerprints];
  if (keepOpengrep) {
    for (const [k, v] of Object.entries(base.metrics)) if (k.includes('.opengrep.')) metrics[k] = v;
    fingerprints.push(...base.fingerprints.filter(isOpengrepFp));
  }
  const commit = run('git', ['rev-parse', '--short', 'HEAD'], ROOT).stdout.trim();
  const next = {
    note: 'Generated by scripts/code-health.sh --update. Do not hand-edit; see docs/process/CODE_HEALTH_RATCHET.md.',
    updatedAt: new Date().toISOString().slice(0, 10),
    commit,
    opengrepRan: Boolean(opengrepRan || keepOpengrep),
    metrics: Object.fromEntries(Object.entries(metrics).sort()),
    info: current.info,
    increases: [...(base?.increases ?? []), ...(increase ? [increase] : [])],
    fingerprints: fingerprints.sort(),
  };
  writeFileSync(BASELINE, `${JSON.stringify(next, null, 2)}\n`);
}

const summary = Object.entries(current.metrics).map(([k, v]) => `${k}=${v}`).join(' ');

if (!base) {
  if (!UPDATE) die('no tools/code-health/baseline.json — create it with scripts/code-health.sh --update');
  writeBaseline();
  console.log(`code-health: baseline created\n  ${summary}`);
  process.exit(0);
}

if (UPDATE) {
  const regressed = rises.length > 0 || newFindings.length > 0;
  if (regressed && !REASON) {
    console.error('code-health: refusing to raise the baseline. Fix the findings, or pass --allow-increase "<reason>".');
    for (const r of rises) console.error(`  metric ${r}`);
    for (const { fp, extra } of newFindings) console.error(`  NEW ${fp}${extra > 1 ? ` (+${extra})` : ''}`);
    process.exit(1);
  }
  const increase = regressed
    ? { date: new Date().toISOString().slice(0, 10), reason: REASON, rises, newFindings: newFindings.map((f) => f.fp) }
    : undefined;
  writeBaseline(increase);
  console.log(`code-health: baseline updated${drops.length ? ` (lowered: ${drops.join(', ')})` : ''}${increase ? ` (RAISED: ${REASON})` : ''}`);
  process.exit(0);
}

if (rises.length === 0 && newFindings.length === 0) {
  console.log(`code-health: clean (no new findings)\n  ${summary}`);
  if (drops.length) console.log(`  improved: ${drops.join(', ')} — lock it in with scripts/code-health.sh --update`);
  process.exit(0);
}

console.log(`code-health: FAIL — ${newFindings.length} new finding(s), ${rises.length} metric(s) rose`);
for (const { fp, extra } of newFindings) {
  const [tool] = fp.split(' ');
  const lines = current.details[fp] ?? [fp];
  const shown = tool === 'knip' ? lines.slice(0, extra) : lines;
  const label = tool === 'jscpd' ? `clone pair (+${extra}, all clones of the pair shown)` : fp.split(' ').slice(0, 2).join(' ');
  console.log(`  NEW ${label}`);
  for (const l of shown) console.log(`      ${l}`);
}
for (const r of rises) console.log(`  metric ${r}`);
console.log('hint: dedupe each clone into a shared helper / delete or wire up each unused file, export or dep, then rerun `npm --prefix tools/code-health run check` until clean; truly intentional? scripts/code-health.sh --update --allow-increase "<reason>"');
process.exit(1);
