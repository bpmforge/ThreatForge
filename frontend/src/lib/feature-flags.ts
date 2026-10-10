type FeatureFlag = "security-overlay";

const DEFAULTS: Record<FeatureFlag, boolean> = {
  "security-overlay": true,
};

const KNOWN_FLAGS = new Set<string>(Object.keys(DEFAULTS));

/**
 * Env overrides, referenced STATICALLY on purpose.
 *
 * Next.js inlines `NEXT_PUBLIC_*` at build time by textually substituting
 * `process.env.NEXT_PUBLIC_FOO`. A computed lookup (`process.env[key]`) is
 * therefore never substituted, and in the browser there is no `process` object
 * at all — so the previous dynamic version silently returned null on the client
 * and every `NEXT_PUBLIC_FF_*` override was a no-op there (verified in-browser:
 * `typeof process === "undefined"`). Server render saw the override, the client
 * did not, which also made the two disagree. Adding a flag means adding its line
 * here — the tradeoff that buys an override that actually works.
 */
function envValue(flag: FeatureFlag): string | undefined {
  switch (flag) {
    case "security-overlay":
      return process.env.NEXT_PUBLIC_FF_SECURITY_OVERLAY;
  }
}

function getEnvOverride(flag: FeatureFlag): boolean | null {
  // Read per call rather than caching at module load: in the browser these are
  // inlined literals so it makes no difference, but in Node (tests, SSR) it
  // keeps `vi.stubEnv` / runtime env changes working.
  const val = envValue(flag);
  if (val === "true") return true;
  if (val === "false") return false;
  return null;
}

function getLocalStorageOverride(flag: FeatureFlag): boolean | null {
  if (typeof localStorage === "undefined") return null;
  const val = localStorage.getItem(`ff:${flag}`);
  if (val === "true") return true;
  if (val === "false") return false;
  return null;
}

export function isFeatureEnabled(flag: string): boolean {
  if (!KNOWN_FLAGS.has(flag)) return false;
  const f = flag as FeatureFlag;
  const ls = getLocalStorageOverride(f);
  if (ls !== null) return ls;
  const env = getEnvOverride(f);
  if (env !== null) return env;
  return DEFAULTS[f];
}
