/**
 * Tests for OSV/EPSS clients + EPSS severity calibration (backlog #52, #56/G8).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { queryOsvVulnerabilities, _clearOsvCache } from "../osv-client.js";
import { getEpssScores, _clearEpssCache } from "../epss-client.js";
import { calibrateSeverities } from "../../ai/micro-analysis/severity-calibrator.js";
import type { MicroThreat } from "../../ai/micro-analysis/types.js";

function mockFetchOnce(body: unknown, ok = true) {
  return vi.spyOn(globalThis, "fetch").mockResolvedValue({
    ok,
    json: async () => body,
  } as Response);
}

function threat(over: Partial<MicroThreat>): MicroThreat {
  return {
    name: "t",
    description: "",
    category: "TAMPERING",
    severity: "HIGH",
    componentId: "c1",
    componentName: "Comp",
    cweIds: [],
    owaspIds: [],
    evidence: {},
    mitigations: [],
    mitigation: { description: "", effort: "MEDIUM", effectiveness: "0.5" },
    confidence: 0.8,
    sourceMethodology: "stride",
    ...over,
  };
}

describe("OSV client", () => {
  beforeEach(() => _clearOsvCache());
  afterEach(() => vi.restoreAllMocks());

  it("extracts CVE ids from vuln aliases", async () => {
    mockFetchOnce({
      vulns: [
        {
          id: "GHSA-x",
          aliases: ["CVE-2021-44228", "GHSA-x"],
          summary: "Log4Shell",
        },
      ],
    });
    const res = await queryOsvVulnerabilities("maven", "log4j-core", "2.14.1");
    expect(res.cveIds).toEqual(["CVE-2021-44228"]);
    expect(res.summary).toBe("Log4Shell");
  });

  it("returns empty on no match", async () => {
    mockFetchOnce({ vulns: [] });
    const res = await queryOsvVulnerabilities("npm", "left-pad", "1.0.0");
    expect(res.cveIds).toEqual([]);
  });

  it("degrades gracefully on non-ok response", async () => {
    mockFetchOnce({}, false);
    const res = await queryOsvVulnerabilities("npm", "x", "1.0.0");
    expect(res.cveIds).toEqual([]);
  });

  it("caches results (second call does not re-fetch)", async () => {
    const spy = mockFetchOnce({ vulns: [{ aliases: ["CVE-2020-1"] }] });
    await queryOsvVulnerabilities("npm", "axios", "0.21.0");
    await queryOsvVulnerabilities("npm", "axios", "0.21.0");
    expect(spy).toHaveBeenCalledTimes(1);
  });
});

describe("EPSS client", () => {
  beforeEach(() => _clearEpssCache());
  afterEach(() => vi.restoreAllMocks());

  it("returns a CVE→score map", async () => {
    mockFetchOnce({
      data: [
        { cve: "CVE-2021-44228", epss: "0.97" },
        { cve: "CVE-2020-0001", epss: "0.01" },
      ],
    });
    const scores = await getEpssScores(["CVE-2021-44228", "CVE-2020-0001"]);
    expect(scores.get("CVE-2021-44228")).toBeCloseTo(0.97);
    expect(scores.get("CVE-2020-0001")).toBeCloseTo(0.01);
  });

  it("returns empty map and does not throw on failure", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("ECONNREFUSED"));
    const scores = await getEpssScores(["CVE-2021-44228"]);
    expect(scores.size).toBe(0);
  });
});

describe("EPSS severity calibration", () => {
  beforeEach(() => _clearEpssCache());
  afterEach(() => vi.restoreAllMocks());

  it("downgrades a HIGH threat whose only CVE has very low EPSS", async () => {
    mockFetchOnce({ data: [{ cve: "CVE-2020-0001", epss: "0.01" }] });
    const out = await calibrateSeverities(
      undefined,
      [threat({ severity: "HIGH", cveIds: ["CVE-2020-0001"] })],
      [],
      { epssEnabled: true },
    );
    expect(out[0].severity).toBe("MEDIUM");
  });

  it("keeps severity when a linked CVE has high EPSS", async () => {
    mockFetchOnce({ data: [{ cve: "CVE-2021-44228", epss: "0.97" }] });
    const out = await calibrateSeverities(
      undefined,
      [threat({ severity: "HIGH", cveIds: ["CVE-2021-44228"] })],
      [],
      { epssEnabled: true },
    );
    expect(out[0].severity).toBe("HIGH");
  });

  it("does not call EPSS when disabled", async () => {
    const spy = vi.spyOn(globalThis, "fetch");
    const out = await calibrateSeverities(
      undefined,
      [threat({ severity: "HIGH", cveIds: ["CVE-2020-0001"] })],
      [],
      { epssEnabled: false },
    );
    expect(spy).not.toHaveBeenCalled();
    expect(out[0].severity).toBe("HIGH");
  });

  it("leaves threats without CVEs untouched", async () => {
    const spy = vi.spyOn(globalThis, "fetch");
    const out = await calibrateSeverities(
      undefined,
      [threat({ severity: "HIGH", cveIds: [] })],
      [],
      { epssEnabled: true },
    );
    expect(spy).not.toHaveBeenCalled();
    expect(out[0].severity).toBe("HIGH");
  });
});
