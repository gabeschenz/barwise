/**
 * Format registration for code-analysis importers.
 *
 * Registers TypeScript (and in Phase 4, Java/Kotlin) format importers
 * with the unified format registry from @barwise/core.
 */

import { type FormatDescriptor, formatRegistry, registerFormat } from "@barwise/core";
import type { LspSessionProvider } from "../types.js";
import { TypeScriptImportFormat } from "./TypeScriptImportFormat.js";

/**
 * TypeScript format descriptor.
 */
export function createTypeScriptFormat(sessionProvider?: LspSessionProvider): FormatDescriptor {
  return {
    name: "typescript",
    description: "TypeScript project (types, validations, state machines)",
    importer: new TypeScriptImportFormat(sessionProvider),
  };
}

/**
 * Register all code-analysis format importers with the unified registry.
 *
 * Call this at tool startup (CLI main, MCP server init, etc.) after
 * registerBuiltinFormats(). Safe to call multiple times -- skips
 * formats that are already registered.
 */
export function registerCodeFormats(sessionProvider?: LspSessionProvider): void {
  const formats: readonly FormatDescriptor[] = [
    createTypeScriptFormat(sessionProvider),
    // Phase 4 will add: createJavaFormat(), createKotlinFormat()
  ];

  for (const descriptor of formats) {
    if (!formatRegistry.get(descriptor.name)) {
      registerFormat(descriptor);
    }
  }
}
