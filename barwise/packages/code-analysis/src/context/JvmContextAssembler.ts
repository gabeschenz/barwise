/**
 * Context assembler for JVM languages (Java, Kotlin).
 *
 * Discovers source files, runs regex-based collectors for types,
 * validations, state transitions, and annotations. Produces a
 * CodeContext for model building.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import type { CodeContext, CodeImportOptions, LspSession } from "../types.js";
import { collectAnnotations } from "./AnnotationCollector.js";
import { filterByGuidingModel, loadGuidingEntityNames } from "./GuidingModelLoader.js";
import { collectStateTransitions } from "./StateTransitionCollector.js";
import { collectTypeDefinitions } from "./TypeCollector.js";
import { collectValidations } from "./ValidationCollector.js";

const DEFAULT_JAVA_EXCLUDE = [
  "**/build/**",
  "**/target/**",
  "**/node_modules/**",
  "**/.gradle/**",
  "**/.idea/**",
  "**/test/**",
  "**/tests/**",
  "**/*Test.java",
  "**/*Spec.kt",
  "**/*Test.kt",
];

const DEFAULT_MAX_FILES = 500;

/**
 * Assemble a CodeContext from a Java workspace.
 */
export async function assembleJavaContext(
  workspaceRoot: string,
  _session: LspSession | null,
  options?: CodeImportOptions,
): Promise<CodeContext> {
  return assembleJvmContext(workspaceRoot, "java", [".java"], _session, options);
}

/**
 * Assemble a CodeContext from a Kotlin workspace.
 */
export async function assembleKotlinContext(
  workspaceRoot: string,
  _session: LspSession | null,
  options?: CodeImportOptions,
): Promise<CodeContext> {
  return assembleJvmContext(workspaceRoot, "kotlin", [".kt", ".kts"], _session, options);
}

/**
 * Shared JVM context assembly logic.
 */
async function assembleJvmContext(
  workspaceRoot: string,
  language: string,
  extensions: string[],
  _session: LspSession | null,
  options?: CodeImportOptions,
): Promise<CodeContext> {
  const maxFiles = options?.maxFiles ?? DEFAULT_MAX_FILES;
  const excludePatterns = options?.exclude
    ? [...options.exclude as string[]]
    : [...DEFAULT_JAVA_EXCLUDE];

  const files = discoverFiles(workspaceRoot, extensions, excludePatterns, maxFiles);

  const allTypes = [];
  const allValidations = [];
  const allStateTransitions = [];
  const allAnnotations = [];

  for (const filePath of files) {
    try {
      const source = readFileSync(filePath, "utf8");
      const relPath = relative(workspaceRoot, filePath);

      // Collect type definitions (reuses TypeCollector regex patterns)
      const types = collectTypeDefinitions(source, relPath);
      allTypes.push(...types);

      // Collect validation functions
      const validations = collectValidations(source, relPath);
      allValidations.push(...validations);

      // Collect state transitions
      const stateTransitions = collectStateTransitions(source, relPath);
      allStateTransitions.push(...stateTransitions);

      // Collect annotations (Java/Kotlin specific)
      const annotations = collectAnnotations(source, relPath);
      allAnnotations.push(...annotations);
    } catch {
      // Skip files we cannot read
    }
  }

  // Apply guiding model filter if provided
  const guidingNames = options?.guidingModel
    ? loadGuidingEntityNames(options.guidingModel)
    : new Set<string>();
  const filteredTypes = filterByGuidingModel(allTypes, guidingNames);

  // Also filter annotations to classes that match the guiding model
  let filteredAnnotations = allAnnotations;
  if (guidingNames.size > 0) {
    const lowerNames = new Set<string>();
    for (const name of guidingNames) {
      lowerNames.add(name.toLowerCase());
    }
    filteredAnnotations = allAnnotations.filter(
      (a) => lowerNames.has(a.className.toLowerCase()),
    );
  }

  return {
    root: workspaceRoot,
    language,
    types: filteredTypes,
    validations: allValidations,
    stateTransitions: allStateTransitions,
    annotations: filteredAnnotations,
    filesAnalyzed: files.map((f) => relative(workspaceRoot, f)),
  };
}

/**
 * Discover source files in a workspace.
 */
function discoverFiles(
  root: string,
  extensions: string[],
  excludePatterns: readonly string[],
  maxFiles: number,
): string[] {
  const files: string[] = [];
  walkDirectory(root, root, extensions, excludePatterns, files, maxFiles);
  return files;
}

/**
 * Recursively walk a directory, collecting matching files.
 */
function walkDirectory(
  dir: string,
  root: string,
  extensions: string[],
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

    if (shouldExclude(relPath, entry.name, excludePatterns)) continue;

    if (entry.isDirectory()) {
      walkDirectory(fullPath, root, extensions, excludePatterns, results, maxFiles);
    } else if (entry.isFile() && extensions.some((ext) => entry.name.endsWith(ext))) {
      results.push(fullPath);
    }
  }
}

/**
 * Check if a file or directory should be excluded.
 */
function shouldExclude(relPath: string, name: string, patterns: readonly string[]): boolean {
  if (
    name === "node_modules" || name === "build" || name === "target" || name === ".git"
    || name === ".gradle" || name === ".idea"
  ) {
    return true;
  }

  for (const pattern of patterns) {
    if (pattern.includes("build") && relPath.includes("build")) return true;
    if (pattern.includes("target") && relPath.includes("target")) return true;
    if (pattern.includes("node_modules") && relPath.includes("node_modules")) return true;
    if (pattern.includes(".gradle") && relPath.includes(".gradle")) return true;
    if (pattern.includes(".idea") && relPath.includes(".idea")) return true;
    if (pattern.includes("test") && (relPath.includes("/test/") || relPath.includes("/tests/"))) {
      return true;
    }
    if (pattern.includes("Test.java") && relPath.endsWith("Test.java")) return true;
    if (pattern.includes("Test.kt") && relPath.endsWith("Test.kt")) return true;
    if (pattern.includes("Spec.kt") && relPath.endsWith("Spec.kt")) return true;
  }

  return false;
}
