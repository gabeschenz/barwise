/**
 * Lineage manifest read/write utilities.
 *
 * Manifests are stored in .fregma/lineage.yaml adjacent to the source model.
 */

import * as YAML from "yaml";
import * as fs from "node:fs";
import * as path from "node:path";
import { createHash } from "node:crypto";
import type { OrmModel } from "../model/OrmModel.js";
import { OrmYamlSerializer } from "../serialization/OrmYamlSerializer.js";
import type { LineageManifest, ManifestExport } from "./types.js";

const MANIFEST_DIR = ".fregma";
const MANIFEST_FILE = "lineage.yaml";

/**
 * Write a lineage manifest to .fregma/lineage.yaml in the specified directory.
 */
export function writeManifest(dir: string, manifest: LineageManifest): void {
  const manifestPath = path.join(dir, MANIFEST_DIR);

  // Create .fregma directory if it doesn't exist
  if (!fs.existsSync(manifestPath)) {
    fs.mkdirSync(manifestPath, { recursive: true });
  }

  const filePath = path.join(manifestPath, MANIFEST_FILE);
  const yamlContent = YAML.stringify(manifest, { lineWidth: 0 });
  fs.writeFileSync(filePath, yamlContent, "utf-8");
}

/**
 * Read a lineage manifest from .fregma/lineage.yaml in the specified directory.
 * Returns undefined if the manifest file does not exist.
 */
export function readManifest(dir: string): LineageManifest | undefined {
  const filePath = path.join(dir, MANIFEST_DIR, MANIFEST_FILE);

  if (!fs.existsSync(filePath)) {
    return undefined;
  }

  const yamlContent = fs.readFileSync(filePath, "utf-8");
  return YAML.parse(yamlContent) as LineageManifest;
}

/**
 * Update a manifest with a new export entry.
 *
 * If the entry's artifact matches an existing export, that export is replaced.
 * Otherwise, the entry is appended to the exports array.
 *
 * The updated manifest is written to disk and returned.
 */
export function updateManifest(
  dir: string,
  entry: ManifestExport,
  existingManifest?: LineageManifest,
): LineageManifest {
  const manifest = existingManifest ?? readManifest(dir);

  let updatedManifest: LineageManifest;

  if (!manifest) {
    // Create a new manifest with default values
    updatedManifest = {
      version: 1,
      sourceModel: "",
      sourceModelHash: entry.modelHash,
      exports: [entry],
    };
  } else {
    // Find if an export with the same artifact already exists
    const existingIndex = manifest.exports.findIndex(
      (exp) => exp.artifact === entry.artifact,
    );

    let newExports: readonly ManifestExport[];
    if (existingIndex >= 0) {
      // Replace existing export
      newExports = [
        ...manifest.exports.slice(0, existingIndex),
        entry,
        ...manifest.exports.slice(existingIndex + 1),
      ];
    } else {
      // Append new export
      newExports = [...manifest.exports, entry];
    }

    updatedManifest = {
      ...manifest,
      sourceModelHash: entry.modelHash,
      exports: newExports,
    };
  }

  writeManifest(dir, updatedManifest);
  return updatedManifest;
}

/**
 * Hash an ORM model to detect staleness.
 *
 * The model is serialized to YAML and then hashed with SHA-256.
 * Returns the hex digest of the hash.
 */
export function hashModel(model: OrmModel): string {
  const serializer = new OrmYamlSerializer();
  const yamlContent = serializer.serialize(model);

  const hash = createHash("sha256");
  hash.update(yamlContent);
  return hash.digest("hex");
}
