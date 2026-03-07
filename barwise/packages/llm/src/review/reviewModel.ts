/**
 * Model review: LLM-powered semantic quality assessment of ORM models.
 *
 * Unlike validation (deterministic structural rules), review provides
 * subjective suggestions about modeling quality: missing definitions,
 * potential subtype relationships, unconstrained fact types, vague
 * descriptions, edge cases worth testing with populations.
 */

import type { OrmModel } from "@barwise/core";
import type { LlmClient } from "../LlmClient.js";

export interface ReviewOptions {
  readonly focus?: string; // Focus on specific entity/fact type, or undefined for full review
}

export interface ReviewSuggestion {
  readonly category: "naming" | "completeness" | "normalization" | "constraint" | "definition";
  readonly severity: "info" | "suggestion" | "warning";
  readonly element?: string; // Which model element this applies to
  readonly description: string; // Human-readable description
  readonly rationale: string; // Why this is a potential issue
}

export interface ReviewResult {
  readonly suggestions: readonly ReviewSuggestion[];
  readonly summary: string; // Brief overall assessment
}

/**
 * Build the system prompt for model review.
 */
function buildReviewSystemPrompt(): string {
  return `You are an expert ORM 2 (Object-Role Modeling) consultant reviewing a conceptual model for semantic quality. Your task is to provide constructive suggestions that go beyond structural validation.

## What to review

**Naming**: Are entity/value type names clear and consistent?
- Flag inconsistent casing or naming patterns (e.g., "UserID" vs "UserId")
- Suggest clearer names when abbreviations or acronyms are unclear
- Flag overly generic names ("Data", "Info", "Thing")

**Completeness**: Are there gaps in the model?
- Entity types with no constraints
- Fact types with no readings or with unclear role names
- Missing definitions for key concepts
- Entity types that appear unconnected to other parts of the model

**Normalization**: Are there potential modeling anti-patterns?
- Attributes that should be entity types (e.g., a complex value type that has structure)
- Potential redundancy (two fact types expressing similar relationships)
- Missing subtype relationships (concepts that look like specializations)

**Constraints**: Are there obvious missing constraints?
- A "quantity" or "age" value with no value constraint
- Fact types that likely need uniqueness constraints but don't have them
- Missing mandatory constraints where the domain suggests they're required

**Definitions**: Are descriptions/definitions missing or vague?
- Entity types without definitions
- Definitions that are too generic ("A Customer is a customer")
- Definitions that don't help a domain expert understand the concept

## Instructions

1. Analyze the provided ORM model
2. Generate suggestions in the specified categories
3. Each suggestion should include:
   - category: one of "naming", "completeness", "normalization", "constraint", "definition"
   - severity: "info" (minor), "suggestion" (recommended), "warning" (significant gap)
   - element: the entity/fact type/constraint name this applies to (if specific)
   - description: clear statement of the issue
   - rationale: why this matters or what could go wrong

4. Provide a brief summary (2-3 sentences) assessing overall model quality

## Important

- Be constructive and specific. "Add more definitions" is not helpful. "Patient entity lacks a definition explaining what qualifies as a patient (admitted? registered? any contact?)" is helpful.
- Consider domain context. A model about hospital operations likely needs different rigor than a simple todo app.
- Don't flag issues that are genuinely ambiguous without domain knowledge. If you can't tell whether something is wrong, don't suggest it.
- Prefer practical suggestions over theoretical purity.`;
}

/**
 * Build the user message containing the model to review.
 */
function buildReviewUserMessage(model: OrmModel, focus?: string): string {
  const modelSummary = serializeModelForReview(model, focus);

  if (focus) {
    return `Review the following ORM model, focusing on: ${focus}

${modelSummary}

Provide suggestions focused on the specified area.`;
  }

  return `Review the following ORM model for semantic quality:

${modelSummary}

Provide suggestions across all categories.`;
}

/**
 * Serialize the model (or focused subset) for LLM review.
 */
function serializeModelForReview(model: OrmModel, focus?: string): string {
  const lines: string[] = [];

  lines.push(`Model: ${model.name}`);
  lines.push("");

  // Filter elements if focus is provided
  const focusLower = focus?.toLowerCase();
  const objectTypes = focusLower
    ? model.objectTypes.filter(ot => ot.name.toLowerCase().includes(focusLower))
    : model.objectTypes;
  const factTypes = focusLower
    ? model.factTypes.filter(ft => ft.name.toLowerCase().includes(focusLower))
    : model.factTypes;

  // Object types
  if (objectTypes.length > 0) {
    lines.push("## Object Types");
    for (const ot of objectTypes) {
      lines.push(`- ${ot.name} (${ot.kind})`);
      if (ot.definition) {
        lines.push(`  Definition: ${ot.definition}`);
      } else {
        lines.push(`  Definition: (none)`);
      }
      if (ot.kind === "entity" && ot.referenceMode) {
        lines.push(`  Reference mode: ${ot.referenceMode}`);
      }
      if (ot.dataType) {
        lines.push(
          `  Data type: ${ot.dataType.name}${
            ot.dataType.length ? ` (length: ${ot.dataType.length})` : ""
          }`,
        );
      }
      if (ot.valueConstraint) {
        lines.push(`  Value constraint: ${ot.valueConstraint.values.join(", ")}`);
      }
    }
    lines.push("");
  }

  // Fact types
  if (factTypes.length > 0) {
    lines.push("## Fact Types");
    for (const ft of factTypes) {
      lines.push(`- ${ft.name}`);
      const roleNames = ft.roles.map(r => {
        const playerName = model.getObjectType(r.playerId)?.name || "Unknown";
        return `${playerName} (${r.name})`;
      }).join(", ");
      lines.push(`  Roles: ${roleNames}`);
      if (ft.readings.length > 0) {
        lines.push(`  Readings: ${ft.readings.map(ro => ro.template).join(" / ")}`);
      } else {
        lines.push(`  Readings: (none)`);
      }
    }
    lines.push("");
  }

  // Constraints summary
  // Collect all constraints from fact types
  const allConstraints: Array<{ type: string; }> = [];
  for (const ft of model.factTypes) {
    for (const c of ft.constraints) {
      allConstraints.push({ type: c.type });
    }
  }

  if (allConstraints.length > 0) {
    lines.push("## Constraints");
    lines.push(`Total constraints: ${allConstraints.length}`);

    // Count by type
    const counts = new Map<string, number>();
    for (const c of allConstraints) {
      const count = counts.get(c.type) || 0;
      counts.set(c.type, count + 1);
    }
    for (const [type, count] of counts.entries()) {
      lines.push(`- ${type}: ${count}`);
    }
    lines.push("");
  }

  // Subtype relationships
  const subtypeFacts = model.subtypeFacts || [];
  if (subtypeFacts.length > 0) {
    lines.push("## Subtypes");
    for (const st of subtypeFacts) {
      const subName = model.getObjectType(st.subtypeId)?.name || "Unknown";
      const superName = model.getObjectType(st.supertypeId)?.name || "Unknown";
      lines.push(`- ${subName} is a ${superName}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * Response schema for LLM review output.
 */
function buildReviewResponseSchema(): Record<string, unknown> {
  return {
    type: "object",
    properties: {
      suggestions: {
        type: "array",
        items: {
          type: "object",
          properties: {
            category: {
              type: "string",
              enum: ["naming", "completeness", "normalization", "constraint", "definition"],
            },
            severity: {
              type: "string",
              enum: ["info", "suggestion", "warning"],
            },
            element: { type: "string" },
            description: { type: "string" },
            rationale: { type: "string" },
          },
          required: ["category", "severity", "description", "rationale"],
        },
      },
      summary: { type: "string" },
    },
    required: ["suggestions", "summary"],
  };
}

/**
 * Parse the LLM response into a ReviewResult.
 */
function parseReviewResponse(responseContent: string): ReviewResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(responseContent);
  } catch (e) {
    throw new Error(
      `Failed to parse LLM response as JSON: ${e instanceof Error ? e.message : String(e)}`,
      { cause: e },
    );
  }

  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("LLM response is not a JSON object");
  }

  const obj = parsed as Record<string, unknown>;

  if (!Array.isArray(obj.suggestions)) {
    throw new Error("LLM response missing 'suggestions' array");
  }

  if (typeof obj.summary !== "string") {
    throw new Error("LLM response missing 'summary' string");
  }

  return {
    suggestions: obj.suggestions as ReviewSuggestion[],
    summary: obj.summary,
  };
}

/**
 * Review an ORM model for semantic quality using an LLM.
 *
 * This is distinct from validation (which checks structural rules).
 * Review provides subjective suggestions about modeling quality.
 *
 * @param model The ORM model to review
 * @param llmClient The LLM client to use for review
 * @param options Optional focus parameter to limit review scope
 * @returns A ReviewResult with suggestions and a summary
 */
export async function reviewModel(
  model: OrmModel,
  llmClient: LlmClient,
  options?: ReviewOptions,
): Promise<ReviewResult> {
  const systemPrompt = buildReviewSystemPrompt();
  const userMessage = buildReviewUserMessage(model, options?.focus);
  const responseSchema = buildReviewResponseSchema();

  const response = await llmClient.complete({
    systemPrompt,
    userMessage,
    responseSchema,
  });

  return parseReviewResponse(response.content);
}
