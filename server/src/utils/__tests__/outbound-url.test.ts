import { describe, it, expect, vi } from "vitest";
import { isIP } from "node:net";

// Hostnames resolve through this table; IP literals resolve to themselves,
// exactly as dns.lookup does without touching the network.
const DNS: Record<string, string[]> = {
  "hooks.example.com": ["93.184.216.34"],
  "dual.example.com": ["93.184.216.34", "2606:2800:220:1::1"],
  "internal.example.com": ["10.1.2.3"],
  "rebind.example.com": ["93.184.216.34", "127.0.0.1"],
  "v6-ula.example.com": ["fd12:3456::1"],
  "lmstudio.lan": ["192.168.50.20"],
  localhost: ["127.0.0.1", "::1"],
  "meta.example.com": ["169.254.169.254"],
};

vi.mock("node:dns/promises", () => ({
  lookup: vi.fn(async (host: string) => {
    const family = isIP(host);
    if (family) return [{ address: host, family }];
    const hit = DNS[host];
    if (!hit)
      throw Object.assign(new Error("ENOTFOUND"), { code: "ENOTFOUND" });
    return hit.map((address) => ({ address, family: isIP(address) }));
  }),
}));

const {
  checkConfiguredBaseUrl,
  assertPublicHttpUrl,
  checkAIBaseUrl,
  validatePrivateHostEntries,
} = await import("../outbound-url.js");

describe("checkConfiguredBaseUrl", () => {
  it.each([
    "https://api.anthropic.com",
    "http://127.0.0.1:8000",
    "http://192.168.50.20:1234/v1",
    "http://localhost:11434",
  ])("allows %s (public and self-hosted model hosts)", (url) => {
    expect(checkConfiguredBaseUrl(url)).toBeNull();
  });

  it.each([
    "http://169.254.169.254/latest/meta-data",
    "http://[fd00:ec2::254]/",
    "http://[::ffff:169.254.169.254]/",
    "http://metadata.google.internal/computeMetadata/v1",
    "file:///etc/passwd",
    "gopher://127.0.0.1:6379/",
    "http://user:pass@example.com",
    "not a url",
  ])("rejects %s", (url) => {
    expect(checkConfiguredBaseUrl(url)).not.toBeNull();
  });
});

describe("assertPublicHttpUrl", () => {
  it.each([
    "https://hooks.example.com/threatforge",
    "https://dual.example.com",
    "http://93.184.216.34:8080/x",
    "https://[2606:2800:220:1::1]/",
  ])("allows public target %s", async (url) => {
    expect(await assertPublicHttpUrl(url)).toBeNull();
  });

  it.each([
    // loopback, any spelling
    "http://127.0.0.1/",
    "http://127.1.2.3/",
    "http://0x7f.1/",
    "http://2130706433/",
    "http://[::1]/",
    "http://[::ffff:127.0.0.1]/",
    "http://[::ffff:7f00:1]/",
    // unspecified
    "http://0.0.0.0/",
    "http://[::]/",
    // RFC1918
    "http://10.0.0.5/",
    "http://172.16.0.1/",
    "http://172.31.255.255/",
    "http://192.168.50.20:1234/",
    "http://[::ffff:192.168.1.1]/",
    // CGNAT 100.64/10
    "http://100.64.0.1/",
    "http://100.127.255.254/",
    // link-local and metadata
    "http://169.254.169.254/latest/meta-data",
    "http://[fe80::1]/",
    "http://[fd00:ec2::254]/",
    // ULA fc00::/7
    "http://[fc00::1]/",
    "http://[fd12:3456::1]/",
    // hostnames resolving inward
    "https://internal.example.com/",
    "https://v6-ula.example.com/",
    "https://rebind.example.com/",
  ])("rejects non-public target %s", async (url) => {
    expect(await assertPublicHttpUrl(url)).not.toBeNull();
  });

  it.each([
    "file:///etc/passwd",
    "gopher://hooks.example.com/",
    "http://user:pass@hooks.example.com/",
    "http://metadata.google.internal/",
    "not a url",
  ])("still applies the base checks to %s", async (url) => {
    expect(await assertPublicHttpUrl(url)).not.toBeNull();
  });

  it("rejects a host that does not resolve", async () => {
    expect(await assertPublicHttpUrl("https://nope.invalid/")).toMatch(
      /resolved/,
    );
  });

  it("does not treat public addresses next to private ranges as private", async () => {
    for (const url of [
      "http://100.63.255.255/",
      "http://100.128.0.1/",
      "http://172.15.255.255/",
      "http://172.32.0.1/",
      "http://11.0.0.1/",
    ]) {
      expect(await assertPublicHttpUrl(url)).toBeNull();
    }
  });
});

describe("checkAIBaseUrl", () => {
  const none = { allowAll: false, entries: [] };

  it.each([
    "https://hooks.example.com/v1",
    "https://dual.example.com",
    "http://93.184.216.34:8080",
  ])("allows public host %s with an empty allowlist", async (url) => {
    expect(await checkAIBaseUrl(url, none)).toBeNull();
  });

  it.each([
    "http://127.0.0.1:8000",
    "http://localhost:11434",
    "http://192.168.50.20:1234/v1",
    "http://[::1]:8000",
    "https://internal.example.com",
    "https://rebind.example.com",
  ])("rejects private host %s when nothing is listed", async (url) => {
    expect(await checkAIBaseUrl(url, none)).toMatch(/allowlist/);
  });

  it("allows a private host listed by IP, CIDR or name", async () => {
    expect(
      await checkAIBaseUrl("http://127.0.0.1:8000", {
        allowAll: false,
        entries: ["127.0.0.1"],
      }),
    ).toBeNull();
    expect(
      await checkAIBaseUrl("http://192.168.50.20:1234/v1", {
        allowAll: false,
        entries: ["192.168.50.0/24"],
      }),
    ).toBeNull();
    expect(
      await checkAIBaseUrl("http://lmstudio.lan:1234/v1", {
        allowAll: false,
        entries: ["LMStudio.lan"],
      }),
    ).toBeNull();
    expect(
      await checkAIBaseUrl("http://localhost:11434", {
        allowAll: false,
        entries: ["localhost"],
      }),
    ).toBeNull();
  });

  it("does not let one listed address cover a different private one", async () => {
    expect(
      await checkAIBaseUrl("http://10.0.0.5", {
        allowAll: false,
        entries: ["192.168.50.0/24"],
      }),
    ).not.toBeNull();
  });

  it("allows any private host when the allow-all switch is on", async () => {
    const all = { allowAll: true, entries: [] };
    expect(await checkAIBaseUrl("http://10.0.0.5:8000", all)).toBeNull();
    expect(await checkAIBaseUrl("http://localhost:1234", all)).toBeNull();
  });

  it.each([
    "http://169.254.169.254/latest/meta-data",
    "http://metadata.google.internal/",
    "http://meta.example.com/",
    "http://[fe80::1]/",
  ])(
    "never allows link-local or metadata %s, even with allow-all",
    async (url) => {
      const policy = {
        allowAll: true,
        entries: ["meta.example.com", "169.254.169.254"],
      };
      expect(await checkAIBaseUrl(url, policy)).not.toBeNull();
    },
  );

  it("rejects an unresolvable host unless it is listed by name", async () => {
    expect(await checkAIBaseUrl("http://nope.invalid", none)).toMatch(
      /resolved/,
    );
    expect(
      await checkAIBaseUrl("http://nope.invalid", {
        allowAll: false,
        entries: ["nope.invalid"],
      }),
    ).toBeNull();
  });
});

describe("validatePrivateHostEntries", () => {
  it("accepts hostnames, IPv4/IPv6 addresses and CIDRs", () => {
    expect(
      validatePrivateHostEntries([
        "localhost",
        "lmstudio.lan",
        "host.docker.internal",
        "127.0.0.1",
        "192.168.50.0/24",
        "::1",
        "fd12:3456::/32",
      ]),
    ).toEqual([]);
  });

  it.each([
    "169.254.169.254",
    "169.254.0.0/16",
    "0.0.0.0/0",
    "metadata.google.internal",
    "fe80::1",
    "http://127.0.0.1",
    "10.0.0.0/33",
    "bad host",
    "",
  ])("rejects %j", (entry) => {
    expect(validatePrivateHostEntries([entry])).toHaveLength(1);
  });
});
