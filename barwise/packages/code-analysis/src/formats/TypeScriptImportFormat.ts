/**
 * TypeScript format importer.
 *
 * Implements ImportFormat for TypeScript projects. Analyzes TypeScript
 * source code using LSP queries (when available) and regex-based
 * extraction to produce draft ORM models.
 *
 * The deterministic pass (parseAsync) extracts type definitions, enums,
 * validation functions, and state transition patterns. The LLM pass
 * (enrich) interprets the assembled context for semantic meaning.
 */

import { type ImportFormat, type ImportOptions, type ImportResult, OrmModel } from "@barwise/core";
import { assembleTypeScriptContext } from "../context/ContextAssembler.js";
import { LspManager } from "../lsp/LspManager.js";
import { defaultTypeScriptConfig } from "../lsp/servers/typescript.js";
import type { CodeContext, CodeImportOptions, LspSession, LspSessionProvider } from "../types.js";

/**
 * Import format for TypeScript projects.
 *
 * Given a workspace root, discovers TypeScript source files, optionally
 * connects to a TypeScript language server for type resolution, and
 * extracts ORM-relevant patterns from the code.
 */
export class TypeScriptImportFormat implements ImportFormat {
  readonly name = "typescript";
  readonly description = "TypeScript project (types, validations, state machines)";
  readonly inputKind = "directory" as const;

  private readonly sessionProvider?: LspSessionProvider;

  constructor(sessionProvider?: LspSessionProvider) {
    this.sessionProvider = sessionProvider;
  }

  /**
   * Async parse: analyze a TypeScript workspace.
   *
   * 1. Optionally start a TypeScript language server
   * 2. Discover and read source files
   * 3. Collect types, validations, state transitions
   * 4. Build a draft ORM model from deterministic analysis
   */
  async parseAsync(input: string, options?: ImportOptions): Promise<ImportResult> {
    const codeOptions = options as CodeImportOptions | undefined;
    const warnings: string[] = [];

    // Try to start LSP session (optional -- regex fallback works without it)
    let session: LspSession | null = null;
    const manager = new LspManager(this.sessionProvider);

    try {
      const config = codeOptions?.lspCommand
        ? {
          language: "typescript",
          workspaceRoot: input,
          command: codeOptions.lspCommand.split(" ")[0]!,
          args: codeOptions.lspCommand.split(" ").slice(1),
        }
        : defaultTypeScriptConfig(input);

      session = await manager.start(config);
    } catch (err) {
      warnings.push(
        `Could not start TypeScript language server: ${
          err instanceof Error ? err.message : String(err)
        }. Falling back to regex-based analysis.`,
      );
    }

    // Assemble context
    let context: CodeContext;
    try {
      context = await assembleTypeScriptContext(input, session, codeOptions);
    } finally {
      await manager.stopAll();
    }

    // Build ORM model from context
    const modelName = codeOptions?.modelName ?? "TypeScript Import";
    const model = buildModelFromContext(context, modelName, warnings);

    // Calculate confidence
    const totalPatterns = context.types.length + context.validations.length
      + context.stateTransitions.length;
    const confidence = totalPatterns > 10 ? "high" : totalPatterns > 0 ? "medium" : "low";

    return { model, warnings, confidence };
  }
}

/**
 * Build an ORM model from the assembled TypeScript context.
 *
 * This is the deterministic pass -- it extracts what can be determined
 * from code structure alone, without LLM interpretation.
 */
function buildModelFromContext(
  context: CodeContext,
  modelName: string,
  warnings: string[],
): OrmModel {
  const model = new OrmModel({ name: modelName });

  // 1. Enums become value types with value constraints
  for (const type of context.types) {
    if (type.kind === "enum" && type.members && type.members.length > 0) {
      model.addObjectType({
        name: type.name,
        kind: "value",
        dataType: { name: "text" },
        valueConstraint: {
          values: [...type.members],
        },
      });
    }
  }

  // 2. Interfaces and classes become entity types
  for (const type of context.types) {
    if (type.kind === "interface" || type.kind === "class") {
      // Skip common non-entity types
      if (isUtilityType(type.name)) continue;

      const existing = model.getObjectTypeByName(type.name);
      if (existing) continue;

      model.addObjectType({
        name: type.name,
        kind: "entity",
        referenceMode: inferReferenceMode(type.name, type.members),
      });
    }
  }

  // 3. Type aliases with string literal unions become value types
  for (const type of context.types) {
    if (type.kind === "type_alias" && type.members && type.members.length > 0) {
      const existing = model.getObjectTypeByName(type.name);
      if (existing) continue;

      model.addObjectType({
        name: type.name,
        kind: "value",
        dataType: { name: "text" },
        valueConstraint: {
          values: [...type.members],
        },
      });
    }
  }

  // 4. Interface/class members that reference other types become fact types
  for (const type of context.types) {
    if ((type.kind === "interface" || type.kind === "class") && type.members) {
      const entityType = model.getObjectTypeByName(type.name);
      if (!entityType) continue;

      for (const member of type.members) {
        // Check if member name matches a known entity type
        const pascalMember = toPascalCase(member);
        const referencedType = model.getObjectTypeByName(pascalMember);
        if (referencedType && referencedType.id !== entityType.id) {
          // Create a binary fact type: Type has ReferencedType
          try {
            const factName = `${type.name} has ${pascalMember}`;
            model.addFactType({
              name: factName,
              roles: [
                { name: type.name, playerId: entityType.id },
                { name: pascalMember, playerId: referencedType.id },
              ],
              readings: [`{0} has {1}`],
            });
          } catch {
            // May fail if fact type already exists -- fine
          }
        }
      }
    }
  }

  // 5. State transitions suggest value constraints on state fields
  for (const transition of context.stateTransitions) {
    if (transition.transitions && transition.transitions.length > 0) {
      const allValues = new Set<string>();
      for (const t of transition.transitions) {
        allValues.add(t.from);
        allValues.add(t.to);
      }

      const typeName = toPascalCase(transition.stateField);
      const existing = model.getObjectTypeByName(typeName);
      if (!existing) {
        model.addObjectType({
          name: typeName,
          kind: "value",
          dataType: { name: "text" },
          valueConstraint: {
            values: [...allValues],
          },
        });
      }
    }
  }

  if (context.types.length === 0 && context.validations.length === 0) {
    warnings.push("No TypeScript types or validation functions found in scope");
  }

  return model;
}

/**
 * Infer a reference mode for an entity type from its members.
 *
 * Follows the same strategy as the OpenAPI importer:
 * 1. Look for an "id" member
 * 2. Look for a "{name}Id" member (e.g. "orderId" for "Order")
 * 3. Fall back to "{name_lower}_id"
 */
function inferReferenceMode(
  typeName: string,
  members: readonly string[] | undefined,
): string {
  if (members) {
    if (members.includes("id")) return "id";

    const camelId = typeName.charAt(0).toLowerCase() + typeName.slice(1) + "Id";
    if (members.includes(camelId)) return camelId;
  }

  return `${toSnakeCase(typeName)}_id`;
}

function toSnakeCase(name: string): string {
  return name
    .replace(/([A-Z])/g, "_$1")
    .toLowerCase()
    .replace(/^_/, "");
}

/**
 * Common utility type names that should not become entity types.
 */
const UTILITY_TYPES = new Set([
  "Props",
  "State",
  "Config",
  "Options",
  "Params",
  "Args",
  "Result",
  "Response",
  "Request",
  "Error",
  "Event",
  "Handler",
  "Callback",
  "Listener",
  "Logger",
  "Context",
  "Middleware",
]);

function isUtilityType(name: string): boolean {
  return UTILITY_TYPES.has(name) || name.endsWith("Props") || name.endsWith("Config");
}

function toPascalCase(name: string): string {
  return name
    .replace(/[-_](\w)/g, (_, c: string) => c.toUpperCase())
    .replace(/^(\w)/, (_, c: string) => c.toUpperCase());
}
