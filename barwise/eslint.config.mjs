import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["packages/*/src/**/*.ts", "packages/*/tests/**/*.ts"],
    rules: {
      // Align with existing TypeScript strict-mode conventions.
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
      "no-console": ["error", { allow: ["warn", "error"] }],
    },
  },
  {
    // Test files can use console for debugging.
    files: ["packages/*/tests/**/*.ts"],
    rules: {
      "no-console": "off",
    },
  },
  {
    // The VS Code extension legitimately uses require() and has
    // vscode as an external. Relax rules that conflict with this.
    files: ["packages/vscode/src/**/*.ts"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "**/coverage/**",
      "**/*.js",
      "**/*.mjs",
      "**/*.cjs",
    ],
  },
);
