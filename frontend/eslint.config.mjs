import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // useEffect(() => setMounted(true), []) is the canonical SSR hydration
      // safety pattern in Next.js. The single-render cost is intentional.
      "react-hooks/set-state-in-effect": "off",
      // react-hooks v5 React Compiler rules — flag established patterns
      // (callbackRef.current in hook body, ref access in render, manual
      // memoization). Downgrade to warn until a React Compiler migration
      // is planned; these are not functional bugs.
      "react-hooks/purity": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
      "react-hooks/static-components": "warn",
      "react-hooks/immutability": "warn",
      // A leading underscore is this codebase's established convention
      // for an intentionally-unused binding (e.g. `_req` in Next.js route
      // handlers that must match a fixed signature). Recognize it instead of
      // warning on every one of them.
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          args: "after-used",
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
  {
    // UI code talks to the API through lib/api-client (credentials, { data }
    // unwrapping, ApiError). Raw fetch is allowed only in the API client itself,
    // Next.js route handlers, tests, and the files listed below.
    files: ["src/**/*.ts", "src/**/*.tsx"],
    ignores: [
      "src/lib/api-client.ts",
      "src/app/api/**",
      "src/**/*.test.ts",
      "src/**/*.test.tsx",
      // NextAuth CSRF + credentials callback
      "src/app/(auth)/login/LoginForm.tsx",
      // server-side sign-in check against the backend
      "src/lib/credentials-authorize.ts",
      "src/lib/auth-callbacks.ts",
      // reads a server-sent event stream
      "src/features/ai/hooks/useAIStreaming.ts",
      // external APIs: api.github.com, Microsoft login + Graph
      "src/features/integrations/components/useGitHubSetupWizard.ts",
      "src/features/integrations/sharepoint/services/api.ts",
    ],
    rules: {
      "no-restricted-globals": [
        "error",
        {
          name: "fetch",
          message: "Use apiGet/apiPost/... from @/lib/api-client.",
        },
      ],
    },
  },
  {
    // Playwright fixtures use test.use() which ESLint mistakes for React's use() hook
    files: ["e2e/**/*.ts", "e2e/**/*.spec.ts"],
    rules: {
      "react-hooks/rules-of-hooks": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Playwright generated artifacts (minified bundles trigger false positives)
    "playwright-report/**",
    "test-results/**",
  ]),
]);

export default eslintConfig;
