/**
 * Forwards /api/auth/forgot-password to the Fastify backend. Without this file the
 * NextAuth catch-all ([...nextauth]) claims the path and answers 400.
 */
export { GET, POST } from "../../[...proxy]/route";
