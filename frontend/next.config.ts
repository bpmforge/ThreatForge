import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Force Turbopack to transpile yjs/lib0 — their binary codec (decoding.js)
  // crashes Turbopack's module evaluator with "Unexpected end of array" otherwise.
  transpilePackages: ["yjs", "y-websocket", "lib0"],

  // Include these packages as external (not bundled - resolved at runtime)
  // Required for Prisma 7 driver adapters and native modules
  serverExternalPackages: [
    "@prisma/client",
    ".prisma/client",
    "@prisma/adapter-pg",
    "@prisma/adapter-better-sqlite3",
    "pg",
    "better-sqlite3",
    "bcryptjs",
  ],

  // Turbopack configuration - mark Prisma as external
  turbopack: {
    resolveAlias: {
      // Ensure Prisma client is resolved from node_modules, not bundled
      "@prisma/client": "@prisma/client",
      ".prisma/client": ".prisma/client",
    },
  },
};

export default nextConfig;
