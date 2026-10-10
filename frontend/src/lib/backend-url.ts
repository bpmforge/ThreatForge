/**
 * Resolves the internal backend URL for server-side fetches.
 *
 * Read at call-time (not at module load) so Next.js doesn't inline an empty
 * string during build. `NEXT_PUBLIC_API_URL` is intentionally blank at build
 * so the client bundle uses relative `/api/` paths via nginx; the server side
 * needs an absolute URL to reach the backend container directly.
 */
export function internalBackendUrl(): string {
  return (
    process.env.INTERNAL_API_URL ||
    (process.env.NEXT_PUBLIC_API_URL || "").trim() ||
    "http://server:3001"
  );
}
