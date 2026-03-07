/**
 * Impact analysis: determine which artifacts depend on a changed model element.
 */

import { readManifest } from "./manifest.js";

/**
 * Information about an artifact affected by a change.
 */
export interface AffectedArtifact {
  readonly artifact: string;
  readonly format: string;
  readonly relationship: string;
}

/**
 * Impact report showing which artifacts depend on a changed element.
 */
export interface ImpactReport {
  readonly changedElement: string;
  readonly affectedArtifacts: readonly AffectedArtifact[];
}

/**
 * Analyze impact of changing a model element.
 *
 * Given a model element ID, find all exported artifacts that depend on it
 * by reading the lineage manifest and checking which artifacts reference
 * this element in their sources.
 *
 * @param dir - Directory containing the .fregma/lineage.yaml manifest
 * @param elementId - ID of the changed element (entity, fact type, constraint, etc.)
 * @returns Impact report with affected artifacts
 */
export function analyzeImpact(
  dir: string,
  elementId: string,
): ImpactReport {
  const manifest = readManifest(dir);

  if (!manifest) {
    return {
      changedElement: elementId,
      affectedArtifacts: [],
    };
  }

  const affectedArtifacts: AffectedArtifact[] = [];

  // Check each export to see if it references the changed element
  for (const exp of manifest.exports) {
    const sourceRef = exp.sources.find(src => src.elementId === elementId);

    if (sourceRef) {
      affectedArtifacts.push({
        artifact: exp.artifact,
        format: exp.format,
        relationship: buildRelationshipDescription(sourceRef),
      });
    }
  }

  return {
    changedElement: elementId,
    affectedArtifacts,
  };
}

/**
 * Build a human-readable description of the relationship between
 * an artifact and a source element.
 */
function buildRelationshipDescription(sourceRef: {
  elementType: string;
  elementName: string;
}): string {
  switch (sourceRef.elementType) {
    case "EntityType":
      return `derived from entity type ${sourceRef.elementName}`;
    case "ValueType":
      return `uses value type ${sourceRef.elementName}`;
    case "FactType":
      return `derived from fact type ${sourceRef.elementName}`;
    case "Constraint":
      return `enforces constraint ${sourceRef.elementName}`;
    case "SubtypeFact":
      return `involves subtype relationship ${sourceRef.elementName}`;
    case "Role":
      return `includes role ${sourceRef.elementName}`;
    default:
      return `references ${sourceRef.elementName}`;
  }
}
