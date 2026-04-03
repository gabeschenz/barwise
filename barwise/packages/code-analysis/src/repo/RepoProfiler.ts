/**
 * Profile a repository: detect language, build system, framework,
 * and identify domain logic directories.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { buildFileContains, detectBuildSystem } from "./BuildSystemDetector.js";
import { getDetectors } from "./detectors/index.js";
import { detectLanguage } from "./LanguageDetector.js";
import type {
  BuildSystemDetection,
  DetectedLanguage,
  FrameworkDetection,
  FrameworkSignal,
  RepoProfile,
  SignalConfig,
} from "./types.js";

/** Signal weight scores for framework detection. */
const WEIGHT_SCORES: Record<string, number> = {
  strong: 3,
  moderate: 2,
  weak: 1,
};

/** Confidence thresholds. */
const HIGH_THRESHOLD = 5;
const MEDIUM_THRESHOLD = 3;
const LOW_THRESHOLD = 2;

/** Map from language to the barwise import format name. */
const LANGUAGE_TO_FORMAT: Partial<Record<DetectedLanguage, string>> = {
  typescript: "typescript",
  java: "java",
  kotlin: "kotlin",
};

/** Default fallback domain paths per language. */
const FALLBACK_DOMAIN_PATHS: Partial<Record<DetectedLanguage, readonly string[]>> = {
  typescript: ["src"],
  java: ["src/main/java"],
  kotlin: ["src/main/kotlin"],
  python: ["."],
  go: ["."],
};

/** Default fallback exclude paths per language. */
const FALLBACK_EXCLUDE_PATHS: Partial<Record<DetectedLanguage, readonly string[]>> = {
  typescript: ["node_modules", "dist", "build", "test", "tests", "__tests__"],
  java: ["src/test", "target", "build"],
  kotlin: ["src/test", "target", "build"],
  python: ["__pycache__", ".venv", "venv", "tests", "test"],
  go: ["vendor"],
};

/**
 * Profile a repository directory. Returns a RepoProfile describing
 * the language, framework, build system, and domain paths.
 */
export function profileRepository(rootDir: string): RepoProfile {
  const language = detectLanguage(rootDir);
  const buildSystem = detectBuildSystem(rootDir);
  const framework = detectFramework(rootDir, language);

  let domainPaths: string[];
  let excludePaths: string[];

  if (framework) {
    // Use framework-specific paths
    const detector = getDetectors().find((d) => d.name === framework.name);
    domainPaths = detector
      ? resolveGlobs(rootDir, detector.domainPaths)
      : fallbackDomainPaths(rootDir, language);
    excludePaths = detector
      ? [...detector.excludePaths]
      : fallbackExcludePaths(language);
  } else {
    domainPaths = fallbackDomainPaths(rootDir, language);
    excludePaths = fallbackExcludePaths(language);
  }

  const sourceFileCount = countSourceFiles(rootDir, domainPaths, excludePaths);
  const importFormat = LANGUAGE_TO_FORMAT[language] ?? null;

  const summary = buildSummary(
    language,
    framework,
    buildSystem,
    domainPaths,
    rootDir,
    sourceFileCount,
    importFormat,
  );

  return {
    language,
    framework,
    buildSystem,
    domainPaths,
    excludePaths,
    sourceFileCount,
    importFormat,
    summary,
  };
}

/**
 * Run all registered framework detectors against a directory.
 * Returns the highest-scoring detection, or null if none meet
 * the minimum threshold.
 */
export function detectFramework(
  rootDir: string,
  language: DetectedLanguage,
): FrameworkDetection | null {
  const detectors = getDetectors();
  let best: FrameworkDetection | null = null;

  for (const detector of detectors) {
    // Only consider detectors matching the detected language
    const matchesLanguage = detector.language === language
      || detector.additionalLanguages?.includes(language);
    if (!matchesLanguage) continue;

    const signals = evaluateSignals(rootDir, detector.signals);
    const score = signals.reduce(
      (sum, s) => sum + (WEIGHT_SCORES[s.weight] ?? 0),
      0,
    );

    if (score < LOW_THRESHOLD) continue;

    const confidence = score >= HIGH_THRESHOLD
      ? "high"
      : score >= MEDIUM_THRESHOLD
      ? "medium"
      : "low";

    const detection: FrameworkDetection = {
      name: detector.name,
      confidence,
      score,
      signals,
    };

    if (!best || score > best.score) {
      best = detection;
    }
  }

  return best;
}

/** Evaluate signal configs against a directory, returning matched signals. */
function evaluateSignals(
  rootDir: string,
  configs: readonly SignalConfig[],
): FrameworkSignal[] {
  const signals: FrameworkSignal[] = [];

  for (const config of configs) {
    switch (config.kind) {
      case "glob": {
        const matches = simpleGlobMatch(rootDir, config.glob);
        if (matches.length > 0) {
          signals.push({
            indicator: config.glob,
            location: matches[0]!,
            weight: config.weight,
          });
        }
        break;
      }
      case "sourcePattern": {
        const match = findSourcePattern(
          rootDir,
          config.pattern,
          config.fileGlob,
        );
        if (match) {
          signals.push({
            indicator: config.pattern.source,
            location: match.location,
            weight: config.weight,
          });
        }
        break;
      }
      case "buildDependency": {
        const result = buildFileContains(rootDir, config.dependency);
        if (result.found && result.buildFile) {
          signals.push({
            indicator: config.dependency,
            location: result.buildFile,
            weight: config.weight,
          });
        }
        break;
      }
      case "filePattern": {
        const match = findFileByPattern(rootDir, config.pattern);
        if (match) {
          signals.push({
            indicator: config.pattern,
            location: match,
            weight: config.weight,
          });
        }
        break;
      }
    }
  }

  return signals;
}

/**
 * Simple glob matching: supports ** for recursive and * for single-level.
 * Returns matching file paths (limited to first match for efficiency).
 */
function simpleGlobMatch(rootDir: string, pattern: string): string[] {
  const parts = pattern.split("/");
  return matchGlobParts(rootDir, parts, 0);
}

function matchGlobParts(
  dir: string,
  parts: string[],
  partIndex: number,
): string[] {
  if (partIndex >= parts.length) return [dir];

  const part = parts[partIndex];
  const results: string[] = [];

  if (part === "**") {
    // Match zero or more directories
    results.push(...matchGlobParts(dir, parts, partIndex + 1));

    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return results;
    }

    for (const entry of entries) {
      if (entry.startsWith(".")) continue;
      const fullPath = join(dir, entry);
      try {
        if (statSync(fullPath).isDirectory()) {
          results.push(...matchGlobParts(fullPath, parts, partIndex));
        }
      } catch {
        continue;
      }
      if (results.length > 0) return results; // Early exit
    }
    return results;
  }

  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return results;
  }

  for (const entry of entries) {
    if (part !== undefined && matchWildcard(entry, part)) {
      const fullPath = join(dir, entry);
      if (partIndex === parts.length - 1) {
        // Last part -- this is a match
        results.push(fullPath);
      } else {
        try {
          if (statSync(fullPath).isDirectory()) {
            results.push(...matchGlobParts(fullPath, parts, partIndex + 1));
          }
        } catch {
          continue;
        }
      }
    }
    if (results.length > 0) return results; // Early exit
  }

  return results;
}

/** Match a filename against a pattern with * wildcards. */
function matchWildcard(name: string, pattern: string): boolean {
  if (pattern === "*") return true;
  if (!pattern.includes("*")) return name === pattern;

  const regex = new RegExp(
    "^" + pattern.replace(/\*/g, ".*").replace(/\?/g, ".") + "$",
  );
  return regex.test(name);
}

/** Search for a regex pattern in source files. */
function findSourcePattern(
  rootDir: string,
  pattern: RegExp,
  _fileGlob?: string,
): { location: string; } | null {
  // Walk source files looking for pattern match
  return walkForPattern(rootDir, pattern, 0);
}

function walkForPattern(
  dir: string,
  pattern: RegExp,
  depth: number,
): { location: string; } | null {
  if (depth > 10) return null;

  const SKIP = new Set([
    "node_modules",
    ".git",
    "dist",
    "build",
    "target",
    ".gradle",
    "vendor",
    "__pycache__",
    ".venv",
  ]);

  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return null;
  }

  for (const entry of entries) {
    if (SKIP.has(entry) || entry.startsWith(".")) continue;
    const fullPath = join(dir, entry);

    try {
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        const result = walkForPattern(fullPath, pattern, depth + 1);
        if (result) return result;
      } else if (stat.isFile() && stat.size < 500_000) {
        // Only read reasonably sized files
        const content = readFileSync(fullPath, "utf-8");
        if (pattern.test(content)) {
          return { location: fullPath };
        }
      }
    } catch {
      continue;
    }
  }

  return null;
}

/** Find a file matching a name pattern (e.g., "*Controller.java"). */
function findFileByPattern(rootDir: string, pattern: string): string | null {
  return walkForFile(rootDir, pattern, 0);
}

function walkForFile(
  dir: string,
  pattern: string,
  depth: number,
): string | null {
  if (depth > 10) return null;

  const SKIP = new Set([
    "node_modules",
    ".git",
    "dist",
    "build",
    "target",
    ".gradle",
    "vendor",
    "__pycache__",
  ]);

  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return null;
  }

  for (const entry of entries) {
    if (SKIP.has(entry) || entry.startsWith(".")) continue;
    const fullPath = join(dir, entry);

    try {
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        const result = walkForFile(fullPath, pattern, depth + 1);
        if (result) return result;
      } else if (stat.isFile() && matchWildcard(entry, pattern)) {
        return fullPath;
      }
    } catch {
      continue;
    }
  }

  return null;
}

/** Resolve glob patterns to actual existing directories. */
function resolveGlobs(rootDir: string, patterns: readonly string[]): string[] {
  const resolved: string[] = [];
  const seen = new Set<string>();

  for (const pattern of patterns) {
    const matches = simpleGlobMatch(rootDir, pattern);
    for (const match of matches) {
      if (!seen.has(match)) {
        seen.add(match);
        resolved.push(match);
      }
    }
  }

  return resolved;
}

/** Fallback domain paths when no framework is detected. */
function fallbackDomainPaths(
  rootDir: string,
  language: DetectedLanguage,
): string[] {
  const patterns = FALLBACK_DOMAIN_PATHS[language] ?? ["."];
  return patterns
    .map((p) => join(rootDir, p))
    .filter((p) => {
      try {
        return statSync(p).isDirectory();
      } catch {
        return false;
      }
    });
}

/** Fallback exclude paths when no framework is detected. */
function fallbackExcludePaths(language: DetectedLanguage): string[] {
  return [...(FALLBACK_EXCLUDE_PATHS[language] ?? [])];
}

/** Count source files in the given domain paths, excluding exclude paths. */
function countSourceFiles(
  _rootDir: string,
  domainPaths: readonly string[],
  excludePaths: readonly string[],
): number {
  const excludeSet = new Set(excludePaths);
  let count = 0;

  function walk(dir: string, depth: number): void {
    if (depth > 20) return;

    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }

    for (const entry of entries) {
      if (entry.startsWith(".") || excludeSet.has(entry)) continue;
      const fullPath = join(dir, entry);

      try {
        const stat = statSync(fullPath);
        if (stat.isDirectory()) {
          walk(fullPath, depth + 1);
        } else if (stat.isFile()) {
          const ext = entry.split(".").pop()?.toLowerCase();
          if (
            ext
            && ["ts", "tsx", "js", "jsx", "java", "kt", "kts", "py", "rb", "go", "cs", "php"]
              .includes(ext)
          ) {
            count++;
          }
        }
      } catch {
        continue;
      }
    }
  }

  for (const domainPath of domainPaths) {
    walk(domainPath, 0);
  }

  return count;
}

/** Build a human-readable profile summary. */
function buildSummary(
  language: DetectedLanguage,
  framework: FrameworkDetection | null,
  buildSystem: BuildSystemDetection | null,
  domainPaths: readonly string[],
  rootDir: string,
  sourceFileCount: number,
  importFormat: string | null,
): string {
  const lines: string[] = [];

  if (framework) {
    const langLabel = language === "unknown" ? "" : ` / ${capitalize(language)}`;
    lines.push(
      `${framework.name}${langLabel} project (${framework.confidence} confidence)`,
    );
  } else {
    lines.push(`${capitalize(language)} project (no framework detected)`);
  }

  if (buildSystem) {
    lines.push(
      `Build system: ${buildSystem.name} (${
        relative(rootDir, buildSystem.buildFile) || buildSystem.buildFile
      })`,
    );
  }

  if (domainPaths.length > 0) {
    const relativePaths = domainPaths.map((p) => relative(rootDir, p) || ".");
    lines.push(`Domain logic: ${sourceFileCount} files in ${relativePaths.join(", ")}`);
  } else {
    lines.push(`Domain logic: ${sourceFileCount} source files`);
  }

  if (framework?.signals && framework.signals.length > 0) {
    const indicators = framework.signals
      .map((s) => s.indicator)
      .slice(0, 5)
      .join(", ");
    lines.push(`Signals: ${indicators}`);
  }

  if (importFormat) {
    lines.push(`Recommended import format: ${importFormat}`);
  } else {
    lines.push("No dedicated importer available (will use LLM fallback)");
  }

  return lines.join("\n");
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
