/**
 * Annotation constraint collector for Java and Kotlin.
 *
 * Extracts Bean Validation, JPA/Hibernate, and common framework annotations
 * from source code. These annotations are declarative constraints that map
 * directly to ORM constraints:
 *
 * - @NotNull -> mandatory role
 * - @Column(unique = true) -> internal uniqueness
 * - @Size(min = 1, max = 100) -> value constraint (range)
 * - @Pattern(regexp = "...") -> value constraint (pattern)
 * - @Enumerated + enum -> value constraint (enum values)
 * - @ManyToOne -> binary fact type
 * - @OneToMany -> binary fact type (inverse)
 * - @Entity, @Table -> entity type declaration
 */

import type { AnnotationConstraintContext } from "../types.js";

/**
 * ORM-relevant annotation patterns.
 *
 * These are the annotations we look for when analyzing Java/Kotlin source code.
 * Each pattern has a name and maps to a specific ORM concept.
 */
const ORM_ANNOTATIONS = new Set([
  // Bean Validation
  "NotNull",
  "NotBlank",
  "NotEmpty",
  "Size",
  "Min",
  "Max",
  "Pattern",
  "Email",
  "Positive",
  "PositiveOrZero",
  "Negative",
  "NegativeOrZero",
  "Past",
  "PastOrPresent",
  "Future",
  "FutureOrPresent",
  "DecimalMin",
  "DecimalMax",
  "Digits",
  "Valid",

  // JPA / Hibernate
  "Entity",
  "Table",
  "Column",
  "Id",
  "GeneratedValue",
  "Enumerated",
  "ManyToOne",
  "OneToMany",
  "ManyToMany",
  "OneToOne",
  "JoinColumn",
  "JoinTable",
  "Embeddable",
  "Embedded",
  // Kotlin-specific
  // (sealed class/interface is structural, not annotation-based)
]);

/**
 * Regex to match Java/Kotlin annotation usage.
 *
 * Matches: @AnnotationName or @AnnotationName(params)
 * Captures: annotation name, optional parameters string
 */
const ANNOTATION_REGEX = /^\s*@(\w+)(?:\(([^)]*)\))?\s*$/gm;

/**
 * Regex to match class declarations in Java/Kotlin.
 * Used to determine the enclosing class for field annotations.
 */
const JAVA_CLASS_REGEX =
  /^\s*(?:public\s+|private\s+|protected\s+|abstract\s+|final\s+|open\s+|data\s+|sealed\s+)*(?:class|interface|enum)\s+(\w+)/gm;

/**
 * Regex to match field declarations that follow annotations.
 * Java: private String name;
 * Kotlin: val name: String or var name: String
 */
const FIELD_REGEX =
  /^\s*(?:private\s+|protected\s+|public\s+|internal\s+)?(?:val|var|final\s+)?(?:\w+\s+)*(\w+)\s*[:;=]/gm;

/**
 * Extract annotation-based constraints from Java or Kotlin source code.
 *
 * This is a regex-based extraction that identifies ORM-relevant annotations
 * and their parameters without requiring a language server.
 */
export function collectAnnotations(
  sourceText: string,
  filePath: string,
): AnnotationConstraintContext[] {
  const results: AnnotationConstraintContext[] = [];
  const lines = sourceText.split("\n");

  // Track current class context
  let currentClass = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;

    // Update class context
    const classMatch =
      /(?:public\s+|private\s+|protected\s+|abstract\s+|final\s+|open\s+|data\s+|sealed\s+)*(?:class|interface|enum)\s+(\w+)/
        .exec(line);
    if (classMatch) {
      currentClass = classMatch[1]!;

      // Check if this line also has an @Entity annotation on previous lines
      // (handled below when we look for annotations)
    }

    // Look for annotations
    const annotationMatches = line.matchAll(/@(\w+)(?:\(([^)]*)\))?/g);
    for (const match of annotationMatches) {
      const annotationName = match[1]!;

      // Only collect ORM-relevant annotations
      if (!ORM_ANNOTATIONS.has(annotationName)) continue;

      // Parse parameters
      const paramsStr = match[2] ?? "";
      const parameters = parseAnnotationParams(paramsStr);

      // Determine target: look at the next non-annotation, non-blank line
      const { targetName, targetKind } = findAnnotationTarget(lines, i);

      results.push({
        targetName,
        targetKind,
        className: currentClass || targetName,
        annotation: annotationName,
        parameters,
        filePath,
        line: i + 1,
        sourceText: line.trim(),
      });
    }
  }

  // Reset regex lastIndex (safety)
  ANNOTATION_REGEX.lastIndex = 0;
  JAVA_CLASS_REGEX.lastIndex = 0;
  FIELD_REGEX.lastIndex = 0;

  return results;
}

/**
 * Find what the annotation applies to by looking at subsequent lines.
 */
function findAnnotationTarget(
  lines: string[],
  annotationLine: number,
): { targetName: string; targetKind: "class" | "field" | "method" | "parameter"; } {
  // Look forward from the annotation line for the target declaration
  for (let j = annotationLine + 1; j < Math.min(annotationLine + 5, lines.length); j++) {
    const line = lines[j]!.trim();
    if (!line || line.startsWith("@") || line.startsWith("//") || line.startsWith("*")) {
      continue;
    }

    // Class/interface/enum declaration
    const classMatch = /(?:class|interface|enum)\s+(\w+)/.exec(line);
    if (classMatch) {
      return { targetName: classMatch[1]!, targetKind: "class" };
    }

    // Method declaration (Java: return_type name(...), Kotlin: fun name(...))
    const methodMatch = /(?:fun\s+|(?:\w+\s+)+)(\w+)\s*\(/.exec(line);
    if (methodMatch && !line.includes(";") && !line.includes("=")) {
      return { targetName: methodMatch[1]!, targetKind: "method" };
    }

    // Field declaration
    const fieldMatch =
      /(?:val|var|private|protected|public|internal|final)\s+(?:\w+\s+)*(\w+)\s*[:;=]/.exec(line);
    if (fieldMatch) {
      return { targetName: fieldMatch[1]!, targetKind: "field" };
    }

    // Fallback: first word that looks like an identifier
    const identMatch = /(\w+)/.exec(line);
    if (identMatch) {
      return { targetName: identMatch[1]!, targetKind: "field" };
    }
  }

  return { targetName: "unknown", targetKind: "field" };
}

/**
 * Parse annotation parameter string into key-value pairs.
 *
 * Handles:
 * - @Size(min = 1, max = 100) -> { min: 1, max: 100 }
 * - @Column(nullable = false) -> { nullable: false }
 * - @Pattern(regexp = "\\d+") -> { regexp: "\\d+" }
 * - @NotNull -> {}
 * - @Min(0) -> { value: 0 }
 */
function parseAnnotationParams(paramsStr: string): Record<string, unknown> {
  if (!paramsStr.trim()) return {};

  const params: Record<string, unknown> = {};

  // Check for simple value (e.g., @Min(0))
  const simpleMatch = paramsStr.trim().match(/^(\d+|"[^"]*"|true|false)$/);
  if (simpleMatch) {
    params["value"] = parseParamValue(simpleMatch[1]!);
    return params;
  }

  // Parse key = value pairs
  const pairRegex = /(\w+)\s*=\s*("[^"]*"|\d+(?:\.\d+)?|true|false|\{[^}]*\}|\w+)/g;
  let match;
  while ((match = pairRegex.exec(paramsStr)) !== null) {
    params[match[1]!] = parseParamValue(match[2]!);
  }

  return params;
}

/**
 * Parse a single annotation parameter value.
 */
function parseParamValue(value: string): unknown {
  // Number
  if (/^\d+(\.\d+)?$/.test(value)) {
    return Number(value);
  }
  // Boolean
  if (value === "true") return true;
  if (value === "false") return false;
  // String (strip quotes)
  if (value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1);
  }
  // Everything else as string
  return value;
}
