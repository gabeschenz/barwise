/**
 * Detect the primary language of a repository by counting source files
 * by extension.
 */

import { readdirSync, statSync } from "node:fs";
import { extname, join } from "node:path";

import type { DetectedLanguage } from "./types.js";

/** Directories to skip during file counting. */
const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  "out",
  "target",
  ".gradle",
  ".idea",
  ".vscode",
  "__pycache__",
  ".mypy_cache",
  ".pytest_cache",
  "vendor",
  "bin",
  "obj",
  ".next",
  ".nuxt",
  "coverage",
]);

/** Map file extensions to languages. */
const EXT_TO_LANGUAGE: Record<string, DetectedLanguage> = {
  ".ts": "typescript",
  ".tsx": "typescript",
  ".js": "typescript", // Close enough for framework detection
  ".jsx": "typescript",
  ".java": "java",
  ".kt": "kotlin",
  ".kts": "kotlin",
  ".py": "python",
  ".rb": "ruby",
  ".go": "go",
  ".cs": "csharp",
  ".php": "php",
};

export interface LanguageCount {
  readonly language: DetectedLanguage;
  readonly count: number;
}

/**
 * Detect the primary language by counting source files.
 * Returns the language with the most files, or "unknown" if
 * no recognized source files are found.
 */
export function detectLanguage(rootDir: string): DetectedLanguage {
  const counts = countLanguages(rootDir);
  if (counts.length === 0) return "unknown";
  return counts[0]!.language;
}

/**
 * Count source files by language, sorted by count descending.
 */
export function countLanguages(rootDir: string): LanguageCount[] {
  const counts = new Map<DetectedLanguage, number>();

  walkDirectory(rootDir, (filePath) => {
    const ext = extname(filePath).toLowerCase();
    const lang = EXT_TO_LANGUAGE[ext];
    if (lang) {
      counts.set(lang, (counts.get(lang) ?? 0) + 1);
    }
  });

  return [...counts.entries()]
    .map(([language, count]) => ({ language, count }))
    .sort((a, b) => b.count - a.count);
}

/** Recursively walk a directory, calling fn for each file. */
function walkDirectory(
  dir: string,
  fn: (filePath: string) => void,
  depth = 0,
): void {
  // Guard against excessively deep trees
  if (depth > 20) return;

  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return; // Skip unreadable directories
  }

  for (const entry of entries) {
    if (SKIP_DIRS.has(entry)) continue;
    if (entry.startsWith(".") && entry !== ".") continue;

    const fullPath = join(dir, entry);
    let stat;
    try {
      stat = statSync(fullPath);
    } catch {
      continue; // Skip unreadable files
    }

    if (stat.isDirectory()) {
      walkDirectory(fullPath, fn, depth + 1);
    } else if (stat.isFile()) {
      fn(fullPath);
    }
  }
}
