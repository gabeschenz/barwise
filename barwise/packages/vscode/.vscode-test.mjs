import { defineConfig } from "@vscode/test-cli";

export default defineConfig({
  files: "dist/tests/integration/**/*.test.js",
  workspaceFolder: "tests/fixtures",
  mocha: {
    timeout: 20000,
  },
});
