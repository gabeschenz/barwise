/**
 * Detect the build system used by a repository by checking for
 * known build files.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import type { BuildSystemDetection } from "./types.js";

interface BuildFileConfig {
  /** File name to look for. */
  readonly fileName: string;
  /** Build system name. */
  readonly name: string;
  /** Priority (higher wins when multiple build files found). */
  readonly priority: number;
}

/**
 * Build files to check, ordered by priority.
 * When multiple build files exist (e.g., both pom.xml and build.gradle.kts),
 * the higher-priority one is reported as the primary build system.
 */
const BUILD_FILES: readonly BuildFileConfig[] = [
  { fileName: "build.gradle.kts", name: "Gradle (Kotlin)", priority: 10 },
  { fileName: "build.gradle", name: "Gradle (Groovy)", priority: 9 },
  { fileName: "pom.xml", name: "Maven", priority: 8 },
  { fileName: "package.json", name: "npm", priority: 7 },
  { fileName: "pyproject.toml", name: "pyproject", priority: 6 },
  { fileName: "Cargo.toml", name: "Cargo", priority: 5 },
  { fileName: "go.mod", name: "Go modules", priority: 5 },
  { fileName: "Gemfile", name: "Bundler", priority: 4 },
  { fileName: "composer.json", name: "Composer", priority: 4 },
  { fileName: "requirements.txt", name: "pip", priority: 3 },
];

/**
 * Detect the build system by checking for known build files in
 * the project root.
 */
export function detectBuildSystem(
  rootDir: string,
): BuildSystemDetection | null {
  let best: { name: string; buildFile: string; priority: number; } | null = null;

  for (const config of BUILD_FILES) {
    const buildFile = join(rootDir, config.fileName);
    if (existsSync(buildFile)) {
      if (!best || config.priority > best.priority) {
        best = {
          name: config.name,
          buildFile,
          priority: config.priority,
        };
      }
    }
  }

  if (!best) return null;
  return { name: best.name, buildFile: best.buildFile };
}

/**
 * Check if a build file contains a specific dependency string.
 * Works across build systems: searches the raw file content for
 * the dependency name.
 */
export function buildFileContains(
  rootDir: string,
  dependency: string,
): { found: boolean; buildFile: string | null; } {
  for (const config of BUILD_FILES) {
    const buildFile = join(rootDir, config.fileName);
    if (!existsSync(buildFile)) continue;

    try {
      const content = readFileSync(buildFile, "utf-8");
      if (content.includes(dependency)) {
        return { found: true, buildFile };
      }
    } catch {
      continue;
    }
  }

  return { found: false, buildFile: null };
}
