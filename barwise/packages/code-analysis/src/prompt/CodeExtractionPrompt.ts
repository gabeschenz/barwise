/**
 * Code extraction prompt for LLM enrichment.
 *
 * Builds a system prompt and user message from a CodeContext for LLM
 * interpretation. The LLM adds semantic understanding to the
 * deterministic extraction results.
 *
 * Key differences from the transcript extraction prompt:
 * - Source references point to file paths and line numbers
 * - Confidence calibration is code-specific (enums = high, guard clauses = medium)
 * - Ambiguity categories include dead code, inconsistency, scope uncertainty
 */

import type { CodeContext } from "../types.js";

/**
 * Build a code extraction prompt from a CodeContext.
 *
 * Returns a { system, user } pair suitable for passing to any LLM.
 */
export function buildCodeExtractionPrompt(
  context: CodeContext,
  modelName: string,
): { system: string; user: string; } {
  const system = buildSystemPrompt();
  const user = buildUserMessage(context, modelName);
  return { system, user };
}

function buildSystemPrompt(): string {
  return `You are an expert data modeler specializing in Object-Role Modeling (ORM 2).
Your task is to analyze application source code and extract business rules
that encode ORM constraints: entity types, value types, fact types,
mandatory constraints, uniqueness constraints, value constraints, and
subtype relationships.

Guidelines for code-to-ORM extraction:

1. ENTITY TYPES: Classes annotated with @Entity, interfaces with business
   identity (id fields), or domain model classes. Not utility classes,
   controllers, services, or DTOs.

2. VALUE TYPES: Enums, string literal unions, and types constrained to a
   fixed set of values. These become ORM value types with value constraints.

3. FACT TYPES: Relationships between entities. Look for @ManyToOne,
   @OneToMany annotations, foreign key fields, or interface members that
   reference other entity types.

4. MANDATORY CONSTRAINTS: @NotNull, @NotBlank annotations, or required
   constructor parameters. These indicate mandatory roles.

5. UNIQUENESS CONSTRAINTS: @Column(unique = true), unique indexes, or
   validation logic that enforces uniqueness.

6. VALUE CONSTRAINTS: @Size, @Min, @Max, @Pattern annotations, or
   validation functions that check value ranges or patterns.

7. SUBTYPE HIERARCHIES: Sealed classes/interfaces, class inheritance with
   @Entity on subtypes, or discriminator columns.

Confidence levels:
- HIGH: Enum types, explicit annotations (@Entity, @NotNull, @ManyToOne)
- MEDIUM: Guard clauses, validation functions, type structure inference
- LOW: Comments, naming conventions, conditional enforcement

For each extracted element, provide:
- A source_reference with filePath and line numbers
- A confidence level (high, medium, low)
- A category (explicit, structural, annotated, inferred, ambiguous)

Respond in the ExtractionResponse JSON format.`;
}

function buildUserMessage(context: CodeContext, modelName: string): string {
  const parts: string[] = [];

  parts.push(`# Code Analysis: ${modelName}`);
  parts.push(`Language: ${context.language}`);
  parts.push(`Files analyzed: ${context.filesAnalyzed.length}`);
  parts.push("");

  // Type definitions
  if (context.types.length > 0) {
    parts.push("## Type Definitions");
    for (const type of context.types) {
      parts.push(`### ${type.kind}: ${type.name} (${type.filePath}:${type.startLine})`);
      if (type.members && type.members.length > 0) {
        parts.push(`Members: ${type.members.join(", ")}`);
      }
      parts.push("```");
      parts.push(type.sourceText);
      parts.push("```");
      parts.push("");
    }
  }

  // Annotations
  if (context.annotations.length > 0) {
    parts.push("## Annotations");
    for (const ann of context.annotations) {
      const params = Object.entries(ann.parameters)
        .map(([k, v]) => `${k}=${String(v)}`)
        .join(", ");
      const paramStr = params ? `(${params})` : "";
      parts.push(
        `- @${ann.annotation}${paramStr} on ${ann.className}.${ann.targetName} `
          + `[${ann.targetKind}] (${ann.filePath}:${ann.line})`,
      );
    }
    parts.push("");
  }

  // Validation functions
  if (context.validations.length > 0) {
    parts.push("## Validation Functions");
    for (const val of context.validations) {
      parts.push(`### ${val.functionName} (${val.filePath}:${val.startLine})`);
      if (val.targetType) {
        parts.push(`Target type: ${val.targetType}`);
      }
      parts.push("```");
      parts.push(val.sourceText);
      parts.push("```");
      parts.push("");
    }
  }

  // State transitions
  if (context.stateTransitions.length > 0) {
    parts.push("## State Transitions");
    for (const st of context.stateTransitions) {
      parts.push(`### ${st.stateField} (${st.filePath}:${st.startLine})`);
      if (st.transitions && st.transitions.length > 0) {
        for (const t of st.transitions) {
          parts.push(`  ${t.from} -> ${t.to}`);
        }
      }
      parts.push("```");
      parts.push(st.sourceText);
      parts.push("```");
      parts.push("");
    }
  }

  parts.push("Extract all ORM-relevant business rules from this code analysis.");

  return parts.join("\n");
}
