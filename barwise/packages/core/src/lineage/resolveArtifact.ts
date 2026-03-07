/**
 * Artifact resolution: given a generated file path, find its source ORM
 * model and the elements that produced it by reading the lineage manifest.
 *
 * Used by describe_domain to provide context for generated artifacts.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { readManifest } from "./manifest.js";
import type { ManifestExport, SourceReference } from "./types.js";

/**
 * Result of resolving an artifact through the lineage manifest.
 */
export interface ArtifactResolution {
  /** Directory containing the .barwise/lineage.yaml manifest. */
  readonly manifestDir: string;
  /** Path to the source ORM model (from manifest.sourceModel). */
  readonly sourceModel: string;
  /** The matching export entry from the manifest. */
  readonly exportEntry: ManifestExport;
  /** Source references from the manifest (ORM elements that produced this artifact). */
  readonly sources: readonly SourceReference[];
}

/**
 * Resolve a generated artifact path back to its source ORM model and
 * contributing elements by reading the lineage manifest.
 *
 * Walks up parent directories from the artifact path looking for a
 * `.barwise/lineage.yaml` manifest. When found, matches the artifact
 * path against manifest export entries (using absolute path comparison).
 *
 * @param artifactPath - Absolute or relative path to a generated file
 * @returns Resolution result, or undefined if no matching manifest/entry found
 */
export function resolveArtifact(
  artifactPath: string,
): ArtifactResolution | undefined {
  const absolutePath = path.resolve(artifactPath);

  // Walk up parent directories looking for a manifest.
  let currentDir = path.dirname(absolutePath);
  const root = path.parse(currentDir).root;

  while (currentDir !== root) {
    const manifest = readManifest(currentDir);

    if (manifest) {
      // Try to match the artifact path against manifest exports.
      const match = manifest.exports.find((exp) => {
        const expAbsolute = path.resolve(exp.artifact);
        return expAbsolute === absolutePath;
      });

      if (match) {
        return {
          manifestDir: currentDir,
          sourceModel: manifest.sourceModel,
          exportEntry: match,
          sources: match.sources,
        };
      }
    }

    // Move up one directory.
    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) break; // Reached filesystem root
    currentDir = parentDir;
  }

  return undefined;
}

/**
 * Find the ORM model file (.orm.yaml) in a directory by looking for
 * the source model path from the manifest, or by scanning for .orm.yaml files.
 *
 * @param dir - Directory to search in
 * @param manifestSourceModel - Optional source model path from manifest
 * @returns Absolute path to the ORM model file, or undefined
 */
export function findOrmModel(
  dir: string,
  manifestSourceModel?: string,
): string | undefined {
  // If manifest specifies a source model path, use it.
  if (manifestSourceModel) {
    const fullPath = path.isAbsolute(manifestSourceModel)
      ? manifestSourceModel
      : path.join(dir, manifestSourceModel);
    if (fs.existsSync(fullPath)) {
      return fullPath;
    }
  }

  // Fall back to scanning for .orm.yaml files.
  try {
    const entries = fs.readdirSync(dir);
    const ormFile = entries.find((e) => e.endsWith(".orm.yaml"));
    if (ormFile) {
      return path.join(dir, ormFile);
    }
  } catch {
    // Directory not readable -- ignore.
  }

  return undefined;
}
