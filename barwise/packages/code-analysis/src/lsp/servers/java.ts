/**
 * Java language server defaults and configuration.
 *
 * Uses Eclipse JDT Language Server (jdtls), the standard Java LSP
 * implementation used by VS Code's "Extension Pack for Java."
 * Requires a JDK (11+) and a workspace with a build file
 * (Maven pom.xml or Gradle build.gradle).
 */

import type { LspConfig } from "../../types.js";

/**
 * Default LspConfig for a Java project.
 *
 * Uses `jdtls` with stdio transport. Eclipse JDT LS provides full type
 * resolution, call hierarchy, and workspace symbol search for Java.
 *
 * Install: download from https://download.eclipse.org/jdtls/snapshots/
 * or use VS Code's Java Extension Pack.
 */
export function defaultJavaConfig(workspaceRoot: string): LspConfig {
  return {
    language: "java",
    workspaceRoot,
    command: "jdtls",
    args: [],
    initOptions: {
      settings: {
        java: {
          signatureHelp: { enabled: true },
          contentProvider: { preferred: "fernflower" },
        },
      },
    },
  };
}
