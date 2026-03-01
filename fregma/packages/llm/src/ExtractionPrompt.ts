/**
 * System prompt construction for ORM model extraction from transcripts.
 *
 * The prompt instructs the LLM to:
 * 1. Identify entity types, value types, and their definitions
 * 2. Identify fact types (relationships) with role names and readings
 * 3. Infer constraints from conversational context
 * 4. Track source references for every extracted element
 * 5. Flag ambiguities and contradictions
 */

import type { ExtractionResponse } from "./ExtractionTypes.js";

/**
 * Build the system prompt for transcript extraction.
 */
export function buildSystemPrompt(): string {
  return `You are an expert data modeler specializing in Object-Role Modeling (ORM 2). Your task is to analyze a business working session transcript and extract a structured ORM conceptual model.

## ORM Concepts

**Entity types** are concepts identified by a reference scheme (e.g., Customer identified by customer_id, Order identified by order_number). They represent the main business objects.

**Value types** are self-identifying data values (e.g., Name, Date, Amount, Rating). They represent properties or measurements, not business objects.

**Fact types** are relationships between object types, expressed as natural-language sentences. For example: "Customer places Order" is a binary fact type with two roles -- the Customer role ("places") and the Order role ("is placed by").

**Roles** are positions within a fact type. Each role is played by an object type and has a role name used in verbalization.

**Reading orders** are natural-language templates for the fact type. A binary fact type typically has a forward reading ("{0} places {1}") and an inverse reading ("{1} is placed by {0}"), where {0} and {1} are positional placeholders for the role players.

**Subtype relationships** express specialization: "Employee is a subtype of Person" means every Employee is also a Person. Subtypes must be entity types. By default, a subtype shares the identification scheme of its supertype (provides_identification = true). When a subtype has its own independent identifier, provides_identification should be false.

**Constraints** encode business rules:
- **Internal uniqueness**: "Each Order is placed by at most one Customer" -- the combination of values in certain roles is unique. Single-role uniqueness is most common.
- **Mandatory**: "Every Order is placed by some Customer" -- every instance must participate.
- **Value constraint**: "Rating must be one of: A, B, C, D, F" -- restricts allowed values.

## Instructions

Analyze the transcript carefully and extract:

1. **Object types**: Identify the main business concepts (entity types) and their data properties (value types). For each:
   - Provide a name (PascalCase for entity types, PascalCase for value types)
   - Classify as "entity" or "value"
   - Write a concise definition based on how the stakeholders describe it
   - For entity types, propose a reference_mode (the identifier, e.g., "customer_id"). The reference_mode must be a single, simple identifier name -- NEVER a composite like "CourseCode + TermCode" or a fabricated scheme like "auto_counter (generated X)". If identification is unclear, flag it as an ambiguity instead of inventing a scheme.
   - For value types, infer the conceptual data_type when possible. Use one of: text, integer, decimal, money, float, boolean, date, time, datetime, timestamp, auto_counter, binary, uuid, other. ALWAYS include length for text types -- infer reasonable lengths from context (codes/identifiers: 10-20, names: 100-200, free text/notes: 500, short labels: 30). Include length/scale for decimal (e.g. name: "decimal", length: 10, scale: 2).
   - For value types with a fixed set of allowed values, include a value_constraint
   - Include source references (line numbers and verbatim excerpts)

2. **Fact types**: Identify relationships between object types. For each:
   - Provide a descriptive name (e.g., "Customer places Order")
   - List the roles with their player (object type name) and role_name
   - Provide at least one reading template using {0}, {1}, etc. as placeholders
   - Include source references

   **CRITICAL -- Identifier fact types**: For EVERY entity type that has a reference_mode, you MUST emit a binary fact type linking the entity to its identifying value type. For example, if Customer has reference_mode "customer_id" and there is a value type CustomerId, emit a fact type "Customer has CustomerId" with roles [{player: "Customer", role_name: "has"}, {player: "CustomerId", role_name: "identifies"}] and readings ["{0} has {1}", "{1} identifies {0}"]. Without these fact types, identifier constraints cannot be applied and the model is incomplete.

   **Ternary and higher-arity fact types**: When the transcript describes a rule spanning 3 or more concepts, model it as a single multi-role fact type rather than leaving it as a comment. For example, "a patient can only have one appointment per time slot on a given day" should produce a ternary or quaternary fact type (e.g., "Patient has Appointment on Date at TimeSlot") with the appropriate uniqueness constraint. Similarly, "each line specifies a product and a quantity" where quantity depends on the order-product combination should be a ternary "Order and Product has Quantity".

3. **Subtypes**: Identify "is a" / specialization relationships between entity types. For each:
   - Specify the subtype and supertype entity names (both must appear in the object_types list)
   - Set provides_identification to false only if the subtype has its own independent identifier
   - Write a brief description explaining the specialization
   - Include source references

4. **Inferred constraints**: Identify business rules from context. For each:
   - Specify the type (internal_uniqueness, mandatory, or value_constraint)
   - In the "roles" array, list the **object type names** (player names) of the constrained roles, NOT the role names. For example, for "Each Order is placed by at most one Customer" in fact type "Customer places Order", use roles: ["Order"] (the constrained player), not roles: ["is placed by"].
   - Write a human-readable description
   - For **reference-mode fact types** (entity has value-type identifier), emit TWO uniqueness constraints:
     (a) uniqueness on the entity role with is_preferred: true ("Each Customer has at most one CustomerId")
     (b) uniqueness on the value role ("Each CustomerId identifies at most one Customer")
     Both are needed to make the identifier a bijection.
   - For **ternary or higher-arity fact types**, composite uniqueness should list ALL constrained role players. For example, if each Order-Product combination has at most one Quantity, use roles: ["Order", "Product"] -- not just one of them.
   - For binary many-to-one relationships, the uniqueness goes on the "many" side. "Customers can place multiple orders" but "each Order belongs to one Customer" means uniqueness on the Order role, not the Customer role.
   - Assess confidence: "high" if explicitly stated, "medium" if strongly implied, "low" if inferred from general domain knowledge
   - Include the source references that justify the inference

5. **Ambiguities**: Flag contradictions, unclear terminology, or open questions. For each:
   - Describe the ambiguity
   - Include the source references showing the conflicting or unclear statements

## Critical Rules

- Every extracted element MUST have source_references with line numbers and verbatim excerpts from the transcript.
- Do NOT invent concepts not discussed in the transcript.
- Do NOT assume constraints that are not at least implied by the conversation.
- Prefer specific, descriptive fact type names over generic ones.
- If stakeholders use different terms for what appears to be the same concept, flag it as an ambiguity.
- Role names should be natural verbs or prepositions (e.g., "places", "is placed by", "has", "is of").
- Reading templates must use {0}, {1}, etc. matching the role order.
- EVERY entity type with a reference_mode MUST have a corresponding identifier fact type in the fact_types array. If you emit an entity with reference_mode "order_number" but no fact type "Order has OrderNumber", the model is incomplete.
- NEVER use composite or fabricated reference_modes. Each reference_mode must be a single simple identifier name (e.g., "customer_id", "order_number", "sku"). If identification requires a composite key, flag it as an ambiguity.
- ALWAYS include length for text data types. Do not omit it.`;
}

/**
 * Build the user message containing the transcript.
 */
export function buildUserMessage(transcript: string): string {
  return `Extract an ORM conceptual model from the following business working session transcript. Number each line for source reference tracking.

<transcript>
${numberLines(transcript)}
</transcript>

Analyze this transcript and produce the structured extraction.`;
}

/**
 * JSON Schema for the extraction response, used to constrain LLM output.
 */
export function buildResponseSchema(): Record<string, unknown> {
  return {
    type: "object",
    properties: {
      object_types: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            kind: { type: "string", enum: ["entity", "value"] },
            definition: { type: "string" },
            reference_mode: { type: "string" },
            value_constraint: {
              type: "object",
              properties: {
                values: { type: "array", items: { type: "string" } },
              },
              required: ["values"],
            },
            data_type: {
              type: "object",
              properties: {
                name: {
                  type: "string",
                  enum: [
                    "text", "integer", "decimal", "money", "float",
                    "boolean", "date", "time", "datetime", "timestamp",
                    "auto_counter", "binary", "uuid", "other",
                  ],
                },
                length: { type: "number" },
                scale: { type: "number" },
              },
              required: ["name"],
            },
            source_references: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  lines: {
                    type: "array",
                    items: { type: "number" },
                    minItems: 2,
                    maxItems: 2,
                  },
                  excerpt: { type: "string" },
                },
                required: ["lines", "excerpt"],
              },
            },
          },
          required: ["name", "kind", "source_references"],
        },
      },
      fact_types: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            roles: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  player: { type: "string" },
                  role_name: { type: "string" },
                },
                required: ["player", "role_name"],
              },
            },
            readings: { type: "array", items: { type: "string" } },
            source_references: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  lines: {
                    type: "array",
                    items: { type: "number" },
                    minItems: 2,
                    maxItems: 2,
                  },
                  excerpt: { type: "string" },
                },
                required: ["lines", "excerpt"],
              },
            },
          },
          required: ["name", "roles", "readings", "source_references"],
        },
      },
      inferred_constraints: {
        type: "array",
        items: {
          type: "object",
          properties: {
            type: {
              type: "string",
              enum: ["internal_uniqueness", "mandatory", "value_constraint"],
            },
            fact_type: { type: "string" },
            roles: { type: "array", items: { type: "string" } },
            description: { type: "string" },
            confidence: {
              type: "string",
              enum: ["high", "medium", "low"],
            },
            is_preferred: { type: "boolean" },
            source_references: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  lines: {
                    type: "array",
                    items: { type: "number" },
                    minItems: 2,
                    maxItems: 2,
                  },
                  excerpt: { type: "string" },
                },
                required: ["lines", "excerpt"],
              },
            },
          },
          required: [
            "type",
            "fact_type",
            "roles",
            "description",
            "confidence",
            "source_references",
          ],
        },
      },
      subtypes: {
        type: "array",
        items: {
          type: "object",
          properties: {
            subtype: { type: "string" },
            supertype: { type: "string" },
            provides_identification: { type: "boolean" },
            description: { type: "string" },
            source_references: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  lines: {
                    type: "array",
                    items: { type: "number" },
                    minItems: 2,
                    maxItems: 2,
                  },
                  excerpt: { type: "string" },
                },
                required: ["lines", "excerpt"],
              },
            },
          },
          required: ["subtype", "supertype", "description", "source_references"],
        },
      },
      ambiguities: {
        type: "array",
        items: {
          type: "object",
          properties: {
            description: { type: "string" },
            source_references: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  lines: {
                    type: "array",
                    items: { type: "number" },
                    minItems: 2,
                    maxItems: 2,
                  },
                  excerpt: { type: "string" },
                },
                required: ["lines", "excerpt"],
              },
            },
          },
          required: ["description", "source_references"],
        },
      },
    },
    required: [
      "object_types",
      "fact_types",
      "subtypes",
      "inferred_constraints",
      "ambiguities",
    ],
  };
}

/**
 * Validate that a parsed JSON object conforms to the ExtractionResponse shape.
 * Returns a typed result or throws with a descriptive message.
 */
export function parseExtractionResponse(json: unknown): ExtractionResponse {
  if (typeof json !== "object" || json === null) {
    throw new Error("Extraction response must be a JSON object.");
  }

  const obj = json as Record<string, unknown>;

  const objectTypes = Array.isArray(obj["object_types"])
    ? obj["object_types"]
    : [];
  const factTypes = Array.isArray(obj["fact_types"])
    ? obj["fact_types"]
    : [];
  const subtypes = Array.isArray(obj["subtypes"])
    ? obj["subtypes"]
    : [];
  const inferredConstraints = Array.isArray(obj["inferred_constraints"])
    ? obj["inferred_constraints"]
    : [];
  const ambiguities = Array.isArray(obj["ambiguities"])
    ? obj["ambiguities"]
    : [];

  return {
    object_types: objectTypes as ExtractionResponse["object_types"],
    fact_types: factTypes as ExtractionResponse["fact_types"],
    subtypes: subtypes as ExtractionResponse["subtypes"],
    inferred_constraints:
      inferredConstraints as ExtractionResponse["inferred_constraints"],
    ambiguities: ambiguities as ExtractionResponse["ambiguities"],
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function numberLines(text: string): string {
  return text
    .split("\n")
    .map((line, i) => `${i + 1}: ${line}`)
    .join("\n");
}
