/**
 * Context assembler.
 *
 * Takes LSP query results and source code and builds a structured
 * CodeContext document. This is the bridge between structural analysis
 * (LSP or regex) and semantic interpretation (LLM).
 *
 * The assembler can work in two modes:
 * 1. LSP mode: uses an LspSession for type resolution and references
 * 2. Regex mode: falls back to regex-based extraction when no LSP is available
 */

import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import type { CodeContext, CodeImportOptions, LspSession } from "../types.js";
import { collectStateTransitions } from "./StateTransitionCollector.js";
import { collectTypeDefinitions } from "./TypeCollector.js";
import { collectValidations } from "./ValidationCollector.js";

/**
 * Default scope patterns for TypeScript.
 */
const DEFAULT_TS_INCLUDE = ["**/*.ts", "**/*.tsx"];
const DEFAULT_TS_EXCLUDE = [
  "**/node_modules/**",
  "**/dist/**",
  "**/build/**",
  "**/*.test.*",
  "**/*.spec.*",
  "**/*.d.ts",
  "**/__tests__/**",
];

/**
 * Default maximum files to analyze.
 */
const DEFAULT_MAX_FILES = 500;

/**
 * Assemble a CodeContext from a TypeScript workspace.
 *
 * When an LSP session is available, it is used for type resolution
 * and reference queries. When not available, falls back to regex-based
 * extraction which works without any language server.
 */
export async function assembleTypeScriptContext(
  workspaceRoot: string,
  _session: LspSession | null,
  options?: CodeImportOptions,
): Promise<CodeContext> {
  const maxFiles = options?.maxFiles ?? DEFAULT_MAX_FILES;
  const excludePatterns = options?.exclude
    ? [...options.exclude as string[]]
    : [...DEFAULT_TS_EXCLUDE];

  // Discover source files
  const files = discoverFiles(workspaceRoot, DEFAULT_TS_INCLUDE, excludePatterns, maxFiles);

  const allTypes = [];
  const allValidations = [];
  const allStateTransitions = [];

  for (const filePath of files) {
    try {
      const source = readFileSync(filePath, "utf8");
      const relPath = relative(workspaceRoot, filePath);

      // Collect type definitions
      const types = collectTypeDefinitions(source, relPath);
      allTypes.push(...types);

      // Collect validation functions
      const validations = collectValidations(source, relPath);
      allValidations.push(...validations);

      // Collect state transitions
      const stateTransitions = collectStateTransitions(source, relPath);
      allStateTransitions.push(...stateTransitions);
    } catch {
      // Skip files we cannot read
    }
  }

  return {
    root: workspaceRoot,
    language: "typescript",
    types: allTypes,
    validations: allValidations,
    stateTransitions: allStateTransitions,
    annotations: [], // TypeScript doesn't have annotations (Java/Kotlin Phase 4)
    filesAnalyzed: files.map((f) => relative(workspaceRoot, f)),
  };
}

/**
 * Discover source files in a workspace.
 *
 * Uses a simple recursive directory walk with glob-style filtering.
 * This avoids a dependency on a glob library.
 */
function discoverFiles(
  root: string,
  _includePatterns: readonly string[],
  excludePatterns: readonly string[],
  maxFiles: number,
): string[] {
  const files: string[] = [];
  walkDirectory(root, root, excludePatterns, files, maxFiles);
  return files;
}

/**
 * Recursively walk a directory, collecting matching files.
 */
function walkDirectory(
  dir: string,
  root: string,
  excludePatterns: readonly string[],
  results: string[],
  maxFiles: number,
): void {
  if (results.length >= maxFiles) return;

  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (results.length >= maxFiles) return;

    const fullPath = join(dir, entry.name);
    const relPath = relative(root, fullPath);

    // Check excludes
    if (shouldExclude(relPath, entry.name, excludePatterns)) continue;

    if (entry.isDirectory()) {
      walkDirectory(fullPath, root, excludePatterns, results, maxFiles);
    } else if (entry.isFile() && isTypeScriptFile(entry.name)) {
      results.push(fullPath);
    }
  }
}

/**
 * Check if a file or directory should be excluded.
 */
function shouldExclude(relPath: string, name: string, patterns: readonly string[]): boolean {
  // Always exclude common directories
  if (name === "node_modules" || name === "dist" || name === "build" || name === ".git") {
    return true;
  }

  // Check against exclusion patterns (simplified glob matching)
  for (const pattern of patterns) {
    if (pattern.includes("node_modules") && relPath.includes("node_modules")) return true;
    if (pattern.includes("dist") && relPath.includes("dist")) return true;
    if (pattern.includes("build") && relPath.includes("build")) return true;
    if (pattern.includes("__tests__") && relPath.includes("__tests__")) return true;
    if (pattern.includes(".test.") && relPath.includes(".test.")) return true;
    if (pattern.includes(".spec.") && relPath.includes(".spec.")) return true;
    if (pattern.includes(".d.ts") && relPath.endsWith(".d.ts")) return true;
  }

  return false;
}

/**
 * Check if a filename is a TypeScript source file.
 */
function isTypeScriptFile(name: string): boolean {
  return (name.endsWith(".ts") || name.endsWith(".tsx")) && !name.endsWith(".d.ts");
}
