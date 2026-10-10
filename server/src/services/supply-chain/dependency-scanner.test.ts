/**
 * Dependency scanner — NVD lookup failure handling
 *
 * A dependency whose NVD lookup failed, or that was never looked up, is
 * UNKNOWN (not verified) — never NONE — and the scan itself still succeeds.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import Fastify from "fastify";
import { scanDependencies } from "./dependency-scanner.js";
import { supplyChainRoutes } from "../../api/supply-chain.js";

const lodash = {
  name: "lodash",
  version: "4.17.20",
  ecosystem: "npm" as const,
};
const express = {
  name: "express",
  version: "4.18.0",
  ecosystem: "npm" as const,
};

function nvdResponse(vulnerabilities: unknown[] = []) {
  return {
    ok: true,
    status: 200,
    json: vi.fn().mockResolvedValue({ vulnerabilities }),
  };
}

const highCve = {
  cve: {
    id: "CVE-2021-23337",
    descriptions: [{ lang: "en", value: "Command injection" }],
    metrics: {
      cvssMetricV31: [{ cvssData: { baseScore: 7.2, baseSeverity: "HIGH" } }],
    },
  },
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("scanDependencies NVD lookup", () => {
  it("marks a dependency UNKNOWN when the NVD request fails at the network level", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("fetch failed")),
    );

    const report = await scanDependencies([lodash]);

    expect(report.dependencies[0].riskLevel).toBe("UNKNOWN");
    expect(report.dependencies[0].unknownReason).toBe("lookup_failed");
    expect(report.unknownCount).toBe(1);
  });

  it("marks a dependency UNKNOWN when NVD rate-limits or errors (non-OK)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 403, json: vi.fn() }),
    );

    const report = await scanDependencies([lodash]);

    expect(report.dependencies[0].riskLevel).toBe("UNKNOWN");
    expect(report.unknownCount).toBe(1);
  });

  it("only the failed dependency is UNKNOWN; others keep their real result", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(nvdResponse([highCve]))
        .mockRejectedValueOnce(new Error("timeout")),
    );

    const report = await scanDependencies([lodash, express]);

    const byName = Object.fromEntries(
      report.dependencies.map((d) => [d.dependency.name, d.riskLevel]),
    );
    expect(byName).toEqual({ lodash: "HIGH", express: "UNKNOWN" });
    expect(report.highCount).toBe(1);
    expect(report.unknownCount).toBe(1);
  });

  it("marks dependencies past the lookup cap UNKNOWN (not checked), not NONE", async () => {
    const fetchMock = vi.fn().mockResolvedValue(nvdResponse());
    vi.stubGlobal("fetch", fetchMock);

    const report = await scanDependencies([lodash, express], 1);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const byName = Object.fromEntries(
      report.dependencies.map((d) => [d.dependency.name, d]),
    );
    expect(byName.lodash.riskLevel).toBe("NONE");
    expect(byName.express.riskLevel).toBe("UNKNOWN");
    expect(byName.express.unknownReason).toBe("not_checked");
    expect(report.unknownCount).toBe(1);
  });

  it("reports NONE only when NVD answered with no CVEs", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(nvdResponse()));

    const report = await scanDependencies([lodash]);

    expect(report.dependencies[0].riskLevel).toBe("NONE");
    expect(report.unknownCount).toBe(0);
  });
});

describe("POST /api/supply-chain/scan", () => {
  async function buildApp() {
    const app = Fastify();
    app.addHook("preHandler", async (request) => {
      (request as unknown as { authUser: unknown }).authUser = {
        id: "user-1",
        email: "u@example.com",
      };
    });
    await app.register(supplyChainRoutes);
    return app;
  }

  const manifest = JSON.stringify({ dependencies: { lodash: "^4.17.20" } });

  it("returns 200 with UNKNOWN dependencies when every NVD lookup fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("fetch failed")),
    );
    const app = await buildApp();

    const res = await app.inject({
      method: "POST",
      url: "/api/supply-chain/scan",
      payload: { content: manifest, filename: "package.json" },
    });

    expect(res.statusCode).toBe(200);
    const { data } = res.json();
    expect(data.unknownCount).toBe(1);
    expect(data.dependencies[0].riskLevel).toBe("UNKNOWN");
    await app.close();
  });

  it("reports every dependency UNKNOWN (not checked) when scanNVD is false", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const app = await buildApp();

    const res = await app.inject({
      method: "POST",
      url: "/api/supply-chain/scan",
      payload: { content: manifest, filename: "package.json", scanNVD: false },
    });

    expect(res.statusCode).toBe(200);
    const { data } = res.json();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(data.dependencies[0].riskLevel).toBe("UNKNOWN");
    expect(data.dependencies[0].unknownReason).toBe("not_checked");
    await app.close();
  });
});
