/**
 * Shared model builder for JVM languages (Java, Kotlin).
 *
 * Builds an ORM model from a CodeContext, handling annotation-based
 * constraints and JVM-specific patterns in addition to the common
 * type/validation/state transition extraction.
 */

import { OrmModel } from "@barwise/core";
import type { AnnotationConstraintContext, CodeContext } from "../types.js";

/**
 * Build an ORM model from a JVM CodeContext.
 *
 * Handles:
 * 1. @Entity annotations -> entity types
 * 2. Enums -> value types with value constraints
 * 3. Interfaces and classes without @Entity -> entity types (heuristic)
 * 4. @ManyToOne/@OneToMany -> fact types
 * 5. @NotNull -> mandatory notes (tracked in warnings for now)
 * 6. @Size, @Min, @Max -> value constraint notes
 * 7. State transitions from switch/if patterns
 */
export function buildModelFromJvmContext(
  context: CodeContext,
  modelName: string,
  warnings: string[],
): OrmModel {
  const model = new OrmModel({ name: modelName });

  // Track which classes are annotated with @Entity
  const entityAnnotatedClasses = new Set<string>();
  for (const ann of context.annotations) {
    if (ann.annotation === "Entity" && ann.targetKind === "class") {
      entityAnnotatedClasses.add(ann.targetName);
    }
  }

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

  // 2. @Entity-annotated classes become entity types
  for (const className of entityAnnotatedClasses) {
    const existing = model.getObjectTypeByName(className);
    if (existing) continue;

    const typeDef = context.types.find((t) => t.name === className);
    model.addObjectType({
      name: className,
      kind: "entity",
      referenceMode: inferReferenceMode(className, typeDef?.members, context.annotations),
    });
  }

  // 3. Interfaces and classes (non-entity, non-utility) become entity types
  for (const type of context.types) {
    if (type.kind === "interface" || type.kind === "class") {
      if (isUtilityType(type.name)) continue;
      if (model.getObjectTypeByName(type.name)) continue;

      model.addObjectType({
        name: type.name,
        kind: "entity",
        referenceMode: inferReferenceMode(type.name, type.members, context.annotations),
      });
    }
  }

  // 4. Type aliases with string literal unions become value types
  for (const type of context.types) {
    if (type.kind === "type_alias" && type.members && type.members.length > 0) {
      if (model.getObjectTypeByName(type.name)) continue;

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

  // 5. @ManyToOne/@OneToMany annotations -> fact types
  for (const ann of context.annotations) {
    if (ann.annotation === "ManyToOne" || ann.annotation === "OneToOne") {
      const sourceEntity = model.getObjectTypeByName(ann.className);
      // Try to infer target entity from field name (PascalCase)
      const targetName = toPascalCase(ann.targetName);
      const targetEntity = model.getObjectTypeByName(targetName);

      if (sourceEntity && targetEntity && sourceEntity.id !== targetEntity.id) {
        try {
          const factName = `${ann.className} has ${targetName}`;
          model.addFactType({
            name: factName,
            roles: [
              { name: ann.className, playerId: sourceEntity.id },
              { name: targetName, playerId: targetEntity.id },
            ],
            readings: [`{0} has {1}`],
          });
        } catch {
          // May fail if fact type already exists
        }
      }
    }
  }

  // 6. Track annotation constraints in warnings for review
  const constraintAnnotations = context.annotations.filter((a) =>
    ["NotNull", "NotBlank", "NotEmpty", "Size", "Min", "Max", "Pattern", "Column"].includes(
      a.annotation,
    )
  );

  for (const ann of constraintAnnotations) {
    const paramStr = Object.entries(ann.parameters)
      .map(([k, v]) => `${k}=${String(v)}`)
      .join(", ");
    const detail = paramStr ? `(${paramStr})` : "";
    warnings.push(
      `Annotation @${ann.annotation}${detail} on ${ann.className}.${ann.targetName} -- `
        + `review for ORM constraint mapping (${ann.filePath}:${ann.line})`,
    );
  }

  // 7. State transitions suggest value constraints
  for (const transition of context.stateTransitions) {
    if (transition.transitions && transition.transitions.length > 0) {
      const allValues = new Set<string>();
      for (const t of transition.transitions) {
        allValues.add(t.from);
        allValues.add(t.to);
      }

      const typeName = toPascalCase(transition.stateField);
      if (!model.getObjectTypeByName(typeName)) {
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

  if (context.types.length === 0 && context.annotations.length === 0) {
    warnings.push("No types or annotations found in scope");
  }

  return model;
}

/**
 * Infer a reference mode for an entity type.
 *
 * For JVM entities, check for @Id-annotated fields first,
 * then fall back to member-based inference.
 */
function inferReferenceMode(
  typeName: string,
  members: readonly string[] | undefined,
  annotations: readonly AnnotationConstraintContext[],
): string {
  // Check for @Id annotation on a field in this class
  const idAnnotation = annotations.find(
    (a) => a.annotation === "Id" && a.className === typeName,
  );
  if (idAnnotation) {
    return idAnnotation.targetName;
  }

  // Check member names
  if (members) {
    if (members.includes("id")) return "id";

    const camelId = typeName.charAt(0).toLowerCase() + typeName.slice(1) + "Id";
    if (members.includes(camelId)) return camelId;
  }

  return `${toSnakeCase(typeName)}_id`;
}

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
  "Controller",
  "Service",
  "Repository",
  "Dto",
  "DTO",
  "Mapper",
  "Builder",
  "Factory",
  "Exception",
  "Application",
]);

function isUtilityType(name: string): boolean {
  return UTILITY_TYPES.has(name)
    || name.endsWith("Props")
    || name.endsWith("Config")
    || name.endsWith("Controller")
    || name.endsWith("Service")
    || name.endsWith("Repository")
    || name.endsWith("Dto")
    || name.endsWith("DTO")
    || name.endsWith("Mapper")
    || name.endsWith("Exception");
}

function toPascalCase(name: string): string {
  return name
    .replace(/[-_](\w)/g, (_, c: string) => c.toUpperCase())
    .replace(/^(\w)/, (_, c: string) => c.toUpperCase());
}

function toSnakeCase(name: string): string {
  return name
    .replace(/([A-Z])/g, "_$1")
    .toLowerCase()
    .replace(/^_/, "");
}
