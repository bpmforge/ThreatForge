import { describe, it, expect } from "vitest";
import { scanFiles, groupByCategory } from "./scanner.js";

const makeFile = (path: string, content: string) => ({ path, content });

describe("scanFiles", () => {
  it("returns empty array for empty input", () => {
    expect(scanFiles([])).toEqual([]);
  });

  it("detects bcrypt password hashing", () => {
    const file = makeFile(
      "src/auth.ts",
      `const hash = await bcrypt.hash(password, 12);`,
    );
    const results = scanFiles([file]);
    expect(results).toHaveLength(1);
    expect(results[0].patternId).toBe("bcrypt-hash");
    expect(results[0].file).toBe("src/auth.ts");
    expect(results[0].line).toBe(1);
    expect(results[0].controlCategory).toBe("IAM");
  });

  it("detects JWT verification", () => {
    const file = makeFile(
      "src/middleware.ts",
      ["// JWT middleware", "const payload = jwt.verify(token, secret);"].join(
        "\n",
      ),
    );
    const results = scanFiles([file]);
    const jwt = results.find((r) => r.patternId === "jwt-verify");
    expect(jwt).toBeDefined();
    expect(jwt!.line).toBe(2);
  });

  it("detects zod validation", () => {
    const file = makeFile(
      "src/routes/users.ts",
      `const body = UserSchema.parse(req.body);`,
    );
    const results = scanFiles([file]);
    const zod = results.find((r) => r.patternId === "zod-parse");
    expect(zod).toBeDefined();
    expect(zod!.controlCategory).toBe("INPUT_VALIDATION");
  });

  it("detects rate limiting", () => {
    const file = makeFile(
      "src/server.ts",
      `app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));`,
    );
    const results = scanFiles([file]);
    expect(results.find((r) => r.patternId === "rate-limit")).toBeDefined();
  });

  it("only emits one match per (pattern, file)", () => {
    const file = makeFile(
      "src/auth.ts",
      ["bcrypt.hash(pwd, 10)", "bcrypt.compare(pwd, hash)"].join("\n"),
    );
    const results = scanFiles([file]);
    const bcryptMatches = results.filter((r) => r.patternId === "bcrypt-hash");
    expect(bcryptMatches).toHaveLength(1);
    expect(bcryptMatches[0].line).toBe(1); // first match wins
  });

  it("emits same pattern for different files", () => {
    const files = [
      makeFile("src/a.ts", "bcrypt.hash(pwd, 10)"),
      makeFile("src/b.ts", "bcrypt.compare(pwd, hash)"),
    ];
    const results = scanFiles(files);
    const bcryptMatches = results.filter((r) => r.patternId === "bcrypt-hash");
    expect(bcryptMatches).toHaveLength(2);
  });

  it("builds GitHub evidence URL when repoUrl provided", () => {
    const file = makeFile(
      "src/auth.ts",
      "const hash = await bcrypt.hash(password, 12);",
    );
    const results = scanFiles([file], "https://github.com/org/repo", "main");
    expect(results[0].evidenceUrl).toBe(
      "https://github.com/org/repo/blob/main/src/auth.ts#L1",
    );
  });

  it("sets evidenceUrl to null when no repoUrl", () => {
    const file = makeFile(
      "src/auth.ts",
      "const hash = await bcrypt.hash(password, 12);",
    );
    const results = scanFiles([file]);
    expect(results[0].evidenceUrl).toBeNull();
  });

  it("truncates long snippets", () => {
    const longLine = "const x = " + "a".repeat(200);
    const file = makeFile("src/auth.ts", `bcrypt.hash(${longLine})`);
    const results = scanFiles([file]);
    if (results.length > 0) {
      expect(results[0].snippet.length).toBeLessThanOrEqual(120);
    }
  });
});

describe("groupByCategory", () => {
  it("groups controls by category", () => {
    const controls = [
      {
        patternId: "bcrypt-hash",
        patternName: "bcrypt",
        file: "a.ts",
        line: 1,
        snippet: "",
        evidenceUrl: null,
        evidenceTitle: "",
        controlCategory: "IAM",
        mitigationDescription: "",
      },
      {
        patternId: "zod-parse",
        patternName: "zod",
        file: "b.ts",
        line: 1,
        snippet: "",
        evidenceUrl: null,
        evidenceTitle: "",
        controlCategory: "INPUT_VALIDATION",
        mitigationDescription: "",
      },
      {
        patternId: "jwt-verify",
        patternName: "jwt",
        file: "c.ts",
        line: 1,
        snippet: "",
        evidenceUrl: null,
        evidenceTitle: "",
        controlCategory: "IAM",
        mitigationDescription: "",
      },
    ];
    const grouped = groupByCategory(controls);
    expect(grouped["IAM"]).toHaveLength(2);
    expect(grouped["INPUT_VALIDATION"]).toHaveLength(1);
  });
});
