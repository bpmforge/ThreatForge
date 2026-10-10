import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { run } from "../src/run.js";

const fx = (n: string) =>
  fileURLToPath(new URL(`./fixtures/${n}`, import.meta.url));
function cli(...argv: string[]) {
  const out: string[] = [];
  const err: string[] = [];
  const code = run(argv, { out: (s) => out.push(s), err: (s) => err.push(s) });
  return { code, out: out.join("\n"), err: err.join("\n") };
}

describe("ftm validate", () => {
  it("passes when CRITICAL threats are mitigated", () => {
    const r = cli("validate", fx("pass.yaml"));
    expect(r.code).toBe(0);
    expect(r.out).toContain("PASS");
  });

  it("exits 1 on unmitigated CRITICAL", () => {
    const r = cli("validate", fx("unmitigated-critical.yaml"));
    expect(r.code).toBe(1);
    expect(r.out).toContain("[CRITICAL] Auth bypass");
    expect(r.out).not.toContain("Open redirect");
  });

  it("--fail-on HIGH also blocks HIGH threats", () => {
    const r = cli(
      "validate",
      fx("unmitigated-critical.yaml"),
      "--fail-on",
      "high",
    );
    expect(r.code).toBe(1);
    expect(r.out).toContain("Open redirect");
  });

  it("--fail-on LOW fails pass.yaml's unmitigated LOW threat", () => {
    expect(cli("validate", fx("pass.yaml"), "--fail-on=LOW").code).toBe(1);
  });

  it("understands the flat server export dialect", () => {
    expect(cli("validate", fx("flat-export.yaml")).code).toBe(1);
  });

  it("--json emits structured output", () => {
    const j = JSON.parse(
      cli("validate", fx("unmitigated-critical.yaml"), "--json").out,
    );
    expect(j).toMatchObject({ valid: true, pass: false, failOn: "CRITICAL" });
    expect(j.blocking).toEqual([
      { id: "T1", name: "Auth bypass", severity: "CRITICAL" },
    ]);
  });

  it("exits 2 on schema errors, listing all of them", () => {
    const r = cli("validate", fx("bad-schema.yaml"));
    expect(r.code).toBe(2);
    expect(r.err).toContain("missing id");
    expect(r.err).toContain('invalid severity "SCARY"');
    expect(r.err).toContain("model.name");
  });

  it("exits 2 on YAML parse errors and missing files, JSON too", () => {
    expect(cli("validate", fx("bad-yaml.yaml")).code).toBe(2);
    expect(cli("validate", fx("nope.yaml")).code).toBe(2);
    expect(
      JSON.parse(cli("validate", fx("bad-schema.yaml"), "--json").out).valid,
    ).toBe(false);
  });

  it("exits 2 on usage errors", () => {
    expect(cli("validate").code).toBe(2);
    expect(cli("validate", fx("pass.yaml"), "--fail-on", "nope").code).toBe(2);
    expect(cli("bogus").code).toBe(2);
  });
});
