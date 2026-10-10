import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.eslint.json",
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/explicit-module-boundary-types": "off",
      "@typescript-eslint/no-non-null-assertion": "warn",
      // Enforce structured logger — no console.* in production code
      "no-restricted-syntax": [
        "error",
        {
          selector: "CallExpression[callee.object.name='console']",
          message:
            "Use logger from utils/logger.js instead of console.* in production code.",
        },
      ],
    },
  },
  {
    // Test files and utilities — relax strictness for mocks/helpers
    files: [
      "src/**/__tests__/**/*.ts",
      "src/**/*.test.ts",
      "src/**/*.spec.ts",
      "src/test-utils/**/*.ts",
      "src/scripts/**/*.ts",
    ],
    rules: {
      "@typescript-eslint/no-unused-vars": "warn",
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
  {
    // Scripts are CLI tools — console.* is intentional there
    files: ["src/scripts/**/*.ts"],
    rules: {
      "no-restricted-syntax": "off",
    },
  },
  {
    ignores: ["dist/", "node_modules/", "*.js", "vitest.config.ts"],
  },
);
