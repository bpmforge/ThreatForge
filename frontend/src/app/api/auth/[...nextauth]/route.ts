/**
 * Auth.js API Route Handler
 */
export const runtime = "nodejs";

import { handlers } from "@/lib/auth";

export const { GET, POST } = handlers;
