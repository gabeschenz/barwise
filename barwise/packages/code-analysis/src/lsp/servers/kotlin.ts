/**
 * Kotlin language server defaults and configuration.
 *
 * Uses kotlin-language-server, the community Kotlin LSP implementation.
 * It understands Gradle/Maven projects and resolves Kotlin types,
 * including interop with Java types in the same project.
 */

import type { LspConfig } from "../../types.js";

/**
 * Default LspConfig for a Kotlin project.
 *
 * Uses `kotlin-language-server` with stdio transport. Requires a JDK
 * and a Gradle or Maven project structure.
 *
 * Install: https://github.com/fwcd/kotlin-language-server
 */
export function defaultKotlinConfig(workspaceRoot: string): LspConfig {
  return {
    language: "kotlin",
    workspaceRoot,
    command: "kotlin-language-server",
    args: [],
    initOptions: {},
  };
}
