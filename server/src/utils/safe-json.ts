/**
 * Safe JSON parsing utilities.
 * Wraps bare JSON.parse calls with fallback values so callers
 * don't need try/catch everywhere.
 */

/** Parse a JSON string, returning `fallback` on any error. */
function safeParseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    // parse fallback — intentionally silent
    return fallback;
  }
}

/** Parse a JSON string-array column; malformed or non-array input reads as empty, non-string items are dropped. */
export function parseStringArray(value: unknown): string[] {
  const v = safeParseJson<unknown>(
    typeof value === "string" ? value : null,
    [],
  );
  return Array.isArray(v)
    ? v.filter((x): x is string => typeof x === "string")
    : [];
}
