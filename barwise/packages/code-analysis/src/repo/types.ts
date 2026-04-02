/**
 * Types for repository analysis: cloning, profiling, and framework detection.
 */

// -- Repo management --------------------------------------------------

/** Reference to a GitHub repository. */
export interface RepoRef {
  /** GitHub org or owner. */
  readonly owner: string;
  /** Repository name. */
  readonly name: string;
}

export interface CloneOptions {
  /** Ref to checkout after cloning (default: default branch). */
  readonly ref?: string;
  /** Shallow clone depth (default: 1). Set to 0 for full clone. */
  readonly depth?: number;
}

/** Parse "owner/name" into a RepoRef. */
export function parseRepoRef(input: string): RepoRef {
  const parts = input.split("/");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error(
      `Invalid repo reference "${input}". Expected format: owner/name`,
    );
  }
  return { owner: parts[0], name: parts[1] };
}

/** Format a RepoRef as "owner/name". */
export function formatRepoRef(ref: RepoRef): string {
  return `${ref.owner}/${ref.name}`;
}

// -- Profiling --------------------------------------------------------

export interface RepoProfile {
  /** Detected primary language. */
  readonly language: DetectedLanguage;

  /** Detected application framework, if any. */
  readonly framework: FrameworkDetection | null;

  /** Build system detected, if any. */
  readonly buildSystem: BuildSystemDetection | null;

  /** Directories containing domain logic (absolute paths). */
  readonly domainPaths: readonly string[];

  /** Directories to exclude from analysis. */
  readonly excludePaths: readonly string[];

  /** Total source files in scope after filtering. */
  readonly sourceFileCount: number;

  /** Recommended barwise import format to use. */
  readonly importFormat: string | null;

  /** Human-readable summary for display. */
  readonly summary: string;
}

export type DetectedLanguage =
  | "typescript"
  | "java"
  | "kotlin"
  | "python"
  | "ruby"
  | "go"
  | "csharp"
  | "php"
  | "unknown";

export interface FrameworkDetection {
  /** Framework identifier (e.g., "Spring Boot", "Django"). */
  readonly name: string;
  /** Confidence based on number and weight of matching signals. */
  readonly confidence: "high" | "medium" | "low";
  /** Total score from signal matching. */
  readonly score: number;
  /** Which signals matched. */
  readonly signals: readonly FrameworkSignal[];
}

export interface FrameworkSignal {
  /** What was found (e.g., "application.yml", "@Entity annotations"). */
  readonly indicator: string;
  /** Where it was found (file path or description). */
  readonly location: string;
  /** How strong this signal is on its own. */
  readonly weight: SignalWeight;
}

export type SignalWeight = "strong" | "moderate" | "weak";

export interface BuildSystemDetection {
  /** Build system name (e.g., "Gradle (Kotlin)", "Maven", "npm"). */
  readonly name: string;
  /** Path to the primary build file. */
  readonly buildFile: string;
}

// -- Framework detector configuration ---------------------------------

export interface FrameworkDetectorConfig {
  /** Framework name (e.g., "Spring Boot"). */
  readonly name: string;
  /** Primary language for this framework. */
  readonly language: DetectedLanguage;
  /** Additional languages (e.g., Spring Boot supports Java and Kotlin). */
  readonly additionalLanguages?: readonly DetectedLanguage[];
  /** Signals to check for. */
  readonly signals: readonly SignalConfig[];
  /** Glob patterns for directories containing domain logic. */
  readonly domainPaths: readonly string[];
  /** Glob patterns for directories to exclude. */
  readonly excludePaths: readonly string[];
}

export type SignalConfig =
  | GlobSignal
  | SourcePatternSignal
  | BuildDependencySignal
  | FilePatternSignal;

export interface GlobSignal {
  readonly kind: "glob";
  /** Glob pattern to match files/directories. */
  readonly glob: string;
  readonly weight: SignalWeight;
}

export interface SourcePatternSignal {
  readonly kind: "sourcePattern";
  /** Regex to match in source file contents. */
  readonly pattern: RegExp;
  /** Glob to limit which files are scanned (optimization). */
  readonly fileGlob?: string;
  readonly weight: SignalWeight;
}

export interface BuildDependencySignal {
  readonly kind: "buildDependency";
  /** Dependency name to look for in build files. */
  readonly dependency: string;
  readonly weight: SignalWeight;
}

export interface FilePatternSignal {
  readonly kind: "filePattern";
  /** Glob pattern matching file names (not paths). */
  readonly pattern: string;
  readonly weight: SignalWeight;
}

// -- Profile caching --------------------------------------------------

export interface ProfileCacheKey {
  readonly repo: string;
  readonly commit: string;
  readonly barwiseVersion: string;
  readonly guidingModelHash: string | null;
  readonly scopePath: string | null;
}

export interface ProfileCacheEntry {
  readonly key: ProfileCacheKey;
  readonly profile: RepoProfile;
  readonly timestamp: string;
}

// -- Analysis metadata ------------------------------------------------

export interface AnalysisMetadata {
  readonly repo: string;
  readonly commit: string;
  readonly ref: string;
  readonly timestamp: string;
  readonly framework: string | null;
  readonly language: DetectedLanguage;
  readonly domainPaths: readonly string[];
  readonly sourceFiles: number;
  readonly extractedConstraints: number;
  readonly importFormat: string | null;
}
