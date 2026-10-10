/**
 * Headers that tell the backend which browser made a request. The backend
 * only sees this Next server, so without them every user shares one
 * rate-limit bucket. nginx appends the real peer address as the LAST
 * x-forwarded-for entry; earlier entries are client-supplied and ignored.
 */
export function clientIpHeaders(
  get: (name: string) => string | null | undefined,
): Record<string, string> {
  const last = get("x-forwarded-for")?.split(",").pop()?.trim();
  const ip = last || get("x-real-ip")?.trim();
  return ip ? { "x-forwarded-for": ip } : {};
}
