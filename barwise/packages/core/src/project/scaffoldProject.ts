/**
 * Produces the YAML for a new, empty `.orm-project.yaml` manifest.
 */

import { OrmProject } from "../model/OrmProject.js";
import { ProjectSerializer } from "../serialization/ProjectSerializer.js";

/**
 * Build the manifest text for a fresh, empty multi-domain project.
 *
 * The result is a schema-valid `.orm-project.yaml` document with just a
 * project name and no domains, mappings, or products. A caller writing
 * a project skeleton supplies the surrounding directory layout.
 *
 * @throws {Error} if the name is empty or whitespace.
 */
export function scaffoldProject(name: string): string {
  const trimmed = (name ?? "").trim();
  if (trimmed.length === 0) {
    throw new Error("Project name must be a non-empty string.");
  }
  return new ProjectSerializer().serialize(new OrmProject({ name: trimmed }));
}
