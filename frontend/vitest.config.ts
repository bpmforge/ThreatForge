import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    // @antv/x6 ships `type: module` but its CJS `main` keeps `exports` refs;
    // inline it so Vite resolves the ESM `module` entry (BM-1 converter tests).
    // x6-react-shape (BM-3) is inlined too so its bare `import '@antv/x6'`
    // hits the ESM alias below instead of Node's CJS `main` resolution.
    server: { deps: { inline: [/@antv\/x6/, /@antv\/x6-react-shape/] } },
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.d.ts",
        "src/**/*.test.{ts,tsx}",
        "src/**/*.spec.{ts,tsx}",
        "src/test/**",
        "src/components/ui/**", // shadcn components
      ],
    },
  },
  resolve: {
    alias: [
      { find: "@", replacement: path.resolve(__dirname, "./src") },
      // @antv/x6's CJS `main` is broken under `type: module`; force the ESM build.
      {
        find: /^@antv\/x6$/,
        replacement: path.resolve(
          __dirname,
          "node_modules/@antv/x6/es/index.js",
        ),
      },
      // x6-react-shape (BM-3) ships the same broken CJS `main`; force its ESM
      // build so its bare `import '@antv/x6'` re-resolves through the alias above.
      {
        find: /^@antv\/x6-react-shape$/,
        replacement: path.resolve(
          __dirname,
          "node_modules/@antv/x6-react-shape/es/index.js",
        ),
      },
    ],
  },
});
