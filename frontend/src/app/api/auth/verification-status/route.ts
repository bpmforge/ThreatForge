/**
 * Forwards /api/auth/verification-status to the Fastify backend. Without this file the
 * NextAuth catch-all ([...nextauth]) claims the path and answers 400.
 */
export { GET, POST } from "../../[...proxy]/route";
