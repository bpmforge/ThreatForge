/**
 * Validation for URLs that tenants configure and the server then calls.
 *
 * checkConfiguredBaseUrl is the syntactic floor: no non-HTTP scheme, no
 * credentials, no link-local / cloud-metadata host, which would hand instance
 * credentials to whoever set the URL.
 *
 * checkAIBaseUrl is what AI base URLs must pass: public hosts are fine, and a
 * loopback or private-LAN host (where self-hosted models such as LM Studio,
 * Ollama and MTPLX live) only when a super-admin allowlisted it.
 *
 * assertPublicHttpUrl is the stricter variant for targets that are never a
 * self-hosted model: webhooks, Jira/GitHub base URLs.
 */
import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";

const METADATA_HOSTS = new Set([
  "metadata.google.internal",
  "metadata",
  "instance-data",
  "instance-data.ec2.internal",
]);

function isLinkLocal(host: string): boolean {
  const bare = host.replace(/^\[|\]$/g, "").toLowerCase();
  if (isIP(bare) === 4) return bare.startsWith("169.254.");
  if (isIP(bare) === 6) {
    // fe80::/10 link-local, fd00:ec2::254 AWS IMDS over IPv6, and
    // IPv4-mapped forms of 169.254.x.x.
    return (
      /^fe[89ab][0-9a-f]:/.test(bare) ||
      bare === "fd00:ec2::254" ||
      /^::ffff:169\.254\./.test(bare) ||
      /^::ffff:a9fe:/.test(bare)
    );
  }
  return false;
}

/** Returns an error message, or null when the URL may be stored and called. */
export function checkConfiguredBaseUrl(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return "Base URL is not a valid URL";
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return "Base URL must use http or https";
  }
  if (url.username || url.password) {
    return "Base URL must not contain credentials";
  }
  const host = url.hostname.toLowerCase();
  if (METADATA_HOSTS.has(host) || isLinkLocal(host)) {
    return "Base URL must not point at a link-local or cloud metadata address";
  }
  return null;
}

/**
 * Addresses a webhook or integration target may never resolve to.
 * net.BlockList also matches IPv4-mapped IPv6 (::ffff:a.b.c.d / ::ffff:7f00:1)
 * against the IPv4 rules.
 */
const NON_PUBLIC = new BlockList();
for (const [net, prefix] of [
  ["0.0.0.0", 8], // "this network", incl. 0.0.0.0
  ["10.0.0.0", 8],
  ["100.64.0.0", 10], // CGNAT
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["224.0.0.0", 4], // multicast
  ["240.0.0.0", 4], // reserved + broadcast
] as const) {
  NON_PUBLIC.addSubnet(net, prefix, "ipv4");
}
for (const [net, prefix] of [
  ["::", 128],
  ["::1", 128],
  ["fc00::", 7], // ULA, incl. fd00:ec2::254
  ["fe80::", 10],
  ["fec0::", 10], // deprecated site-local
  ["ff00::", 8],
] as const) {
  NON_PUBLIC.addSubnet(net, prefix, "ipv6");
}

function isNonPublicAddress(address: string): boolean {
  const bare = address.replace(/%.*$/, "");
  const family = isIP(bare);
  if (family === 4) return NON_PUBLIC.check(bare, "ipv4");
  if (family === 6) return NON_PUBLIC.check(bare, "ipv6");
  return true;
}

/**
 * Stricter check for URLs the server calls on a tenant's behalf (webhooks,
 * Jira/GitHub base URLs): everything checkConfiguredBaseUrl
 * rejects, plus any host that resolves to loopback, private, CGNAT, link-local
 * or ULA space. Returns an error message, or null when the URL is public.
 *
 * Callers must also fetch with `redirect: "manual"` so a public host cannot
 * bounce the request inward. A DNS answer can still change between this check
 * and the fetch (rebinding); this closes the direct path, not that one.
 */
export async function assertPublicHttpUrl(raw: string): Promise<string | null> {
  const basic = checkConfiguredBaseUrl(raw);
  if (basic) return basic.replace(/^Base URL/, "URL");

  const host = new URL(raw).hostname.replace(/^\[|\]$/g, "");
  let addresses: { address: string }[];
  try {
    addresses = await lookup(host, { all: true, verbatim: true });
  } catch {
    return "URL host could not be resolved";
  }
  if (
    addresses.length === 0 ||
    addresses.some((a) => isNonPublicAddress(a.address))
  ) {
    return "URL must point at a public host, not a private or internal address";
  }
  return null;
}

/** Super-admin policy for AI endpoints on loopback / private networks. */
export interface PrivateHostPolicy {
  /** Single-tenant self-hosted installs: any private host is acceptable. */
  allowAll: boolean;
  /** Hostnames, IP addresses and CIDRs that are acceptable. */
  entries: string[];
}

const HOSTNAME =
  /^(?=.{1,253}$)[a-z0-9_]([a-z0-9_-]{0,61}[a-z0-9_])?(\.[a-z0-9_]([a-z0-9_-]{0,61}[a-z0-9_])?)*$/i;

/** Addresses no allowlist entry may cover: IMDS and the link-local ranges. */
const NEVER_ALLOWED = new BlockList();
NEVER_ALLOWED.addSubnet("169.254.0.0", 16, "ipv4");
NEVER_ALLOWED.addSubnet("fe80::", 10, "ipv6");
NEVER_ALLOWED.addAddress("fd00:ec2::254", "ipv6");

function familyOf(address: string): "ipv4" | "ipv6" | null {
  const family = isIP(address);
  return family === 4 ? "ipv4" : family === 6 ? "ipv6" : null;
}

type ParsedEntry =
  | { kind: "host"; host: string }
  | { kind: "net"; address: string; prefix: number; family: "ipv4" | "ipv6" };

function parseEntry(raw: string): ParsedEntry | string {
  const entry = raw.trim();
  if (!entry) return "Empty entry";
  const [address, bits, extra] = entry.split("/");
  const family = familyOf(address);
  if (family) {
    const max = family === "ipv4" ? 32 : 128;
    const prefix = bits === undefined ? max : Number(bits);
    if (
      extra !== undefined ||
      !Number.isInteger(prefix) ||
      prefix < 0 ||
      prefix > max
    ) {
      return `Invalid CIDR: ${entry}`;
    }
    return { kind: "net", address, prefix, family };
  }
  if (bits !== undefined || !HOSTNAME.test(entry)) {
    return `Not a hostname, IP address or CIDR: ${entry}`;
  }
  const host = entry.toLowerCase();
  if (METADATA_HOSTS.has(host))
    return `Cloud metadata host is never allowed: ${entry}`;
  return { kind: "host", host };
}

function coversNeverAllowed(entry: ParsedEntry): boolean {
  if (entry.kind !== "net") return false;
  const probe = new BlockList();
  probe.addSubnet(entry.address, entry.prefix, entry.family);
  return entry.family === "ipv4"
    ? probe.check("169.254.169.254", "ipv4")
    : probe.check("fe80::1", "ipv6") || probe.check("fd00:ec2::254", "ipv6");
}

/** Returns one message per invalid entry; empty when every entry is usable. */
export function validatePrivateHostEntries(entries: string[]): string[] {
  const errors: string[] = [];
  for (const raw of entries) {
    const parsed = parseEntry(typeof raw === "string" ? raw : "");
    if (typeof parsed === "string") errors.push(parsed);
    else if (coversNeverAllowed(parsed)) {
      errors.push(
        `Entry covers link-local or cloud metadata addresses, which are never allowed: ${raw.trim()}`,
      );
    }
  }
  return errors;
}

function compilePolicy(entries: string[]): {
  hosts: Set<string>;
  nets: BlockList;
} {
  const hosts = new Set<string>();
  const nets = new BlockList();
  for (const raw of entries) {
    const parsed = parseEntry(raw);
    if (typeof parsed === "string" || coversNeverAllowed(parsed)) continue;
    if (parsed.kind === "host") hosts.add(parsed.host);
    else nets.addSubnet(parsed.address, parsed.prefix, parsed.family);
  }
  return { hosts, nets };
}

function inList(list: BlockList, address: string): boolean {
  const bare = address.replace(/%.*$/, "");
  const family = familyOf(bare);
  return family !== null && list.check(bare, family);
}

/**
 * Check an AI base URL against the private-host policy. Returns an error
 * message, or null when the server may call it.
 *
 * The host is resolved the way assertPublicHttpUrl does it. All-public answers
 * pass. A loopback/private answer passes only with the allow-all switch, a
 * hostname entry naming this host, or IP/CIDR entries covering every private
 * address it resolves to. Link-local and metadata answers never pass.
 */
export async function checkAIBaseUrl(
  raw: string,
  policy: PrivateHostPolicy,
): Promise<string | null> {
  const basic = checkConfiguredBaseUrl(raw);
  if (basic) return basic;

  const host = new URL(raw).hostname.replace(/^\[|\]$/g, "").toLowerCase();
  const { hosts, nets } = compilePolicy(policy.entries);
  const listedByName = hosts.has(host);

  let addresses: { address: string }[];
  try {
    addresses = await lookup(host, { all: true, verbatim: true });
  } catch {
    return listedByName ? null : "Base URL host could not be resolved";
  }
  if (addresses.some((a) => inList(NEVER_ALLOWED, a.address))) {
    return "Base URL must not point at a link-local or cloud metadata address";
  }
  const internal = addresses.filter((a) => isNonPublicAddress(a.address));
  if (internal.length === 0 || policy.allowAll || listedByName) return null;
  if (internal.every((a) => inList(nets, a.address))) return null;
  return (
    `Base URL points at a private or internal address (${host}). ` +
    "A platform super-admin must add this host to the AI private-host allowlist first."
  );
}
