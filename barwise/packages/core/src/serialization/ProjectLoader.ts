/**
 * Loads a complete multi-file ORM project from a .orm-project.yaml
 * manifest, resolving and attaching every referenced domain model and
 * context mapping from disk.
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { ContextMapping, ContextMappingConfig } from "../model/ContextMapping.js";
import { OrmProject } from "../model/OrmProject.js";
import { MappingSerializer } from "./MappingSerializer.js";
import { OrmYamlSerializer } from "./OrmYamlSerializer.js";
import { ProjectSerializer } from "./ProjectSerializer.js";

/**
 * The result of loading a project manifest and its referenced files.
 */
export interface LoadedProject {
  /**
   * The project, with an OrmModel attached to every domain that
   * resolved and a ContextMapping added for every mapping that
   * resolved.
   */
  readonly project: OrmProject;
  /**
   * Human-readable descriptions of referenced files that could not be
   * read or parsed. The project is still returned with whatever
   * resolved successfully; callers decide whether to treat these as
   * fatal.
   */
  readonly problems: readonly string[];
}

/**
 * Error thrown when the project manifest itself cannot be loaded.
 *
 * Failures resolving individual referenced files are not fatal and are
 * reported via {@link LoadedProject.problems} instead.
 */
export class ProjectLoadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProjectLoadError";
  }
}

/**
 * Load a `.orm-project.yaml` manifest and every file it references.
 *
 * Domain model paths and mapping paths in the manifest are resolved
 * relative to the manifest's own directory. Each domain's OrmModel is
 * loaded and attached via `DomainModel.setModel`; each context mapping
 * is loaded and added to the project via `OrmProject.addMapping`.
 *
 * Product model files are not loaded: a `ProductDependency` carries
 * only a path/context reference, and `projectRules` validates products
 * by dependency name.
 *
 * @throws {ProjectLoadError} if the manifest cannot be read or parsed.
 */
export function loadProject(manifestPath: string): LoadedProject {
  let manifestYaml: string;
  try {
    manifestYaml = readFileSync(manifestPath, "utf-8");
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      throw new ProjectLoadError(`Project manifest not found: ${manifestPath}`);
    }
    throw new ProjectLoadError(
      `Cannot read project manifest ${manifestPath}: ${(err as Error).message}`,
    );
  }

  const projectSerializer = new ProjectSerializer();
  let project: OrmProject;
  try {
    project = projectSerializer.deserialize(manifestYaml);
  } catch (err) {
    throw new ProjectLoadError(
      `Failed to parse project manifest ${manifestPath}: ${(err as Error).message}`,
    );
  }

  const baseDir = dirname(manifestPath);
  const problems: string[] = [];
  const modelSerializer = new OrmYamlSerializer();
  const mappingSerializer = new MappingSerializer();

  // Resolve and attach each domain model.
  for (const domain of project.domains) {
    try {
      const yaml = readFileSync(resolve(baseDir, domain.path), "utf-8");
      domain.setModel(modelSerializer.deserialize(yaml));
    } catch (err) {
      problems.push(
        `Domain "${domain.context}" (${domain.path}): ${(err as Error).message}`,
      );
    }
  }

  // Resolve and add each context mapping.
  for (const mappingPath of projectSerializer.getMappingPaths(manifestYaml)) {
    try {
      const yaml = readFileSync(resolve(baseDir, mappingPath), "utf-8");
      const mapping = mappingSerializer.deserialize(yaml, mappingPath);
      project.addMapping(toMappingConfig(mapping));
    } catch (err) {
      problems.push(`Mapping (${mappingPath}): ${(err as Error).message}`);
    }
  }

  return { project, problems };
}

/**
 * Rebuild a ContextMappingConfig from a deserialized ContextMapping so
 * it can be added to the project.
 */
function toMappingConfig(mapping: ContextMapping): ContextMappingConfig {
  return {
    path: mapping.path,
    sourceContext: mapping.sourceContext,
    targetContext: mapping.targetContext,
    pattern: mapping.pattern,
    entityMappings: mapping.entityMappings.map((em) => ({
      sourceObjectType: em.sourceObjectType,
      targetObjectType: em.targetObjectType,
      description: em.description,
    })),
    semanticConflicts: mapping.semanticConflicts.map((sc) => ({
      term: sc.term,
      sourceMeaning: sc.sourceMeaning,
      targetMeaning: sc.targetMeaning,
      resolution: sc.resolution,
    })),
  };
}
