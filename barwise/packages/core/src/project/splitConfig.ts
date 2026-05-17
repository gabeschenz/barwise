/**
 * Reading and scaffolding the YAML config that drives `splitModel`.
 */

import { parse } from "yaml";
import { ModelSplitError, type SplitConfig } from "./splitModel.js";

/**
 * Parse and validate a split config document.
 *
 * The document has a `projectName` string and a `domains` mapping of
 * context name to a list of object type names.
 *
 * @throws {ModelSplitError} if the document is malformed.
 */
export function parseSplitConfig(yamlText: string): SplitConfig {
  let parsed: unknown;
  try {
    parsed = parse(yamlText);
  } catch (err) {
    throw new ModelSplitError(
      `Invalid split config YAML: ${(err as Error).message}`,
    );
  }
  if (parsed === null || typeof parsed !== "object") {
    throw new ModelSplitError("Split config must be a YAML mapping.");
  }

  const obj = parsed as Record<string, unknown>;
  const projectName = obj["projectName"];
  if (typeof projectName !== "string" || projectName.trim().length === 0) {
    throw new ModelSplitError(
      'Split config must have a non-empty string "projectName".',
    );
  }

  const domainsRaw = obj["domains"];
  if (domainsRaw === null || typeof domainsRaw !== "object") {
    throw new ModelSplitError(
      'Split config must have a "domains" mapping of context to object types.',
    );
  }

  const domains: Record<string, string[]> = {};
  for (
    const [context, names] of Object.entries(
      domainsRaw as Record<string, unknown>,
    )
  ) {
    if (names === null || names === undefined) {
      domains[context] = [];
      continue;
    }
    if (
      !Array.isArray(names)
      || names.some((n) => typeof n !== "string")
    ) {
      throw new ModelSplitError(
        `Domain "${context}" must be a list of object type names.`,
      );
    }
    domains[context] = names as string[];
  }

  return { projectName, domains };
}

interface ScaffoldDoc {
  model?: {
    name?: string;
    object_types?: Array<{ name?: string; kind?: string; }>;
  };
}

/**
 * Produce a starter split config for a model: every entity object type
 * listed under the first context, ready for the user to redistribute.
 * Value types are omitted -- `splitModel` infers their home.
 *
 * @throws {ModelSplitError} if no contexts are given or the model
 * cannot be parsed.
 */
export function scaffoldSplitConfig(
  modelYaml: string,
  contexts: readonly string[],
): string {
  if (contexts.length < 2) {
    throw new ModelSplitError(
      "A split needs at least two domains; pass --domains a,b,...",
    );
  }

  let doc: ScaffoldDoc;
  try {
    doc = parse(modelYaml) as ScaffoldDoc;
  } catch (err) {
    throw new ModelSplitError(
      `Could not parse the source model: ${(err as Error).message}`,
    );
  }

  const entities = (doc.model?.object_types ?? [])
    .filter((o) => o.kind === "entity" && typeof o.name === "string")
    .map((o) => o.name as string);

  const lines: string[] = [
    "# Split config scaffold. Move each object type under the domain that",
    "# owns it, then run:",
    "#   barwise project split <model> --config <this file>",
    "# Value types are not listed -- splitModel infers their home from the",
    "# fact types that use them.",
    "",
    `projectName: "${(doc.model?.name ?? "project").trim()} project"`,
    "",
    "domains:",
  ];
  contexts.forEach((context, index) => {
    if (index === 0 && entities.length > 0) {
      lines.push(`  ${context}:`);
      for (const name of entities) lines.push(`    - ${name}`);
    } else {
      lines.push(`  ${context}: []`);
    }
  });
  return lines.join("\n") + "\n";
}
