# Barwise Milestone 3: JSON Schema and YAML Serialization - Research Summary

## Overview

Milestone 3 (JSON Schema and YAML serialization with round-trip .orm.yaml files) is **substantially complete** with the serialization layer already implemented. The core infrastructure is in place and fully functional. This document provides a comprehensive technical reference for understanding and extending this system.

---

## Part 1: Architecture Specification

### 1.1 Design Rationale (from ARCHITECTURE.md Section 4.1)

**Why YAML over XML/JSON:**

- Readable and editable by humans in a text editor
- Diffable in version control (meaningful line-by-line diffs)
- Familiar to data engineers who work with dbt and Airflow configurations daily
- Comments are supported natively, allowing inline documentation

**JSON Schema as First-Class Artifact:**
The `.orm.yaml` file format is formally defined by a JSON Schema that serves multiple purposes:

1. **File validation** - Every `.orm.yaml` file is validated against the schema on load
2. **Editor intelligence** - YAML files include a `$schema` reference, enabling native validation and autocomplete in any editor (VS Code with Red Hat YAML extension)
3. **LLM output constraint** - The schema (or targeted subset) is provided to the LLM as a structured output specification during transcript extraction
4. **Contract for multi-file references** - The schema defines valid shapes for cross-domain references, mapping files, and project manifests

**Schema Versioning and Migration:**

- The schema is versioned. Every file begins with a schema version declaration
- When the schema evolves, the serialization layer includes forward migration functions
- Migration is applied transparently on load without rewriting the file on disk unless the user explicitly saves
- This prevents "my model stopped working after an extension update" situations

---

## Part 2: JSON Schema Definitions

### 2.1 Main Files

Located in `packages/core/schemas/`:

1. **orm-model.schema.json** - Schema for `.orm.yaml` domain model files
2. **orm-project.schema.json** - Schema for `.orm-project.yaml` project manifest files
3. **context-mapping.schema.json** - Schema for `.map.yaml` context mapping files

### 2.2 orm-model.schema.json Structure

```
Root Properties:
  orm_version: "1.0" (constant)
  model:
    name: string (required, minLength: 1)
    domain_context: string (optional, bounded context name)
    object_types: ObjectType[] (optional)
    fact_types: FactType[] (optional)
    subtype_facts: SubtypeFact[] (optional)
    definitions: Definition[] (optional)
```

#### ObjectType Definition

```
id: UUID string
name: string (required)
kind: "entity" | "value" (required)
reference_mode: string (required for entity types)
definition: string (optional, ubiquitous language)
source_context: string (optional, bounded context origin)
value_constraint: {
  values: string[] (required, minItems: 1)
}
```

**Validation Rule:** If kind == "entity", reference_mode is required.

#### FactType Definition

```
id: UUID string
name: string (required)
definition: string (optional)
roles: Role[] (required, minItems: 1)
readings: string[] (required, minItems: 1, placeholders: {0}, {1}, etc.)
constraints: Constraint[] (optional)
```

#### Role Definition

```
id: UUID string
player: string (ObjectType id reference)
role_name: string (required, used in verbalization)
```

#### Constraint Types (Discriminated Union via "type" field)

**Phase 1 (Core):**

- `internal_uniqueness`: roles: string[] (within same fact type)
- `mandatory`: role: string (single role id)
- `external_uniqueness`: roles: string[] (across fact types)
- `value_constraint`: role?: string (optional), values: string[] (enumeration or range)

**Phase 2 (Extended):**

- `disjunctive_mandatory`: roles: string[] (minItems: 2)
- `exclusion`: roles: string[] (minItems: 2)
- `exclusive_or`: roles: string[] (minItems: 2)
- `subset`: subset_roles: string[], superset_roles: string[]
- `equality`: roles_1: string[], roles_2: string[]
- `ring`: role_1: string, role_2: string, ring_type: enum[irreflexive|asymmetric|antisymmetric|intransitive|acyclic|symmetric|transitive|purely_reflexive]
- `frequency`: role: string, min: integer (minimum: 1), max: integer | "unbounded"

#### SubtypeFact Definition

```
id: UUID string
subtype: string (entity type id)
supertype: string (entity type id)
provides_identification: boolean (default: true)
```

#### Definition (Ubiquitous Language Entry)

```
term: string (required)
definition: string (required, minLength: 1)
context: string (optional, bounded context)
```

### 2.3 orm-project.schema.json Structure

```
Root Properties:
  project:
    name: string (required)
    domains: DomainReference[] (optional)
    mappings: MappingReference[] (optional)
    products: ProductReference[] (optional)

DomainReference:
  path: string (file path, required)
  context: string (bounded context name, required)

MappingReference:
  path: string (file path, required)

ProductReference:
  path: string (file path, required)
  context: string (bounded context name, required)
  depends_on: {
    domains?: string[] (context names)
    mappings?: string[] (mapping file names)
  }
```

### 2.4 context-mapping.schema.json Structure

```
Root Properties:
  mapping:
    source_context: string (required)
    target_context: string (required)
    pattern: "shared_kernel" | "published_language" | "anticorruption_layer" (required)
    entity_mappings: EntityMapping[] (optional)
    semantic_conflicts: SemanticConflict[] (optional)

EntityMapping:
  source_object_type: string (entity name, required)
  target_object_type: string (entity name, required)
  description: string (optional)

SemanticConflict:
  term: string (required)
  source_meaning: string (required)
  target_meaning: string (required)
  resolution: string (required)
```

---

## Part 3: Serialization Implementation

### 3.1 File Structure

Located in `packages/core/src/serialization/`:

1. **OrmYamlSerializer.ts** - Handles `.orm.yaml` round-trip serialization
2. **SchemaValidator.ts** - JSON Schema validation using ajv
3. **ProjectSerializer.ts** - Handles `.orm-project.yaml` serialization
4. **MappingSerializer.ts** - Handles `.map.yaml` serialization

### 3.2 OrmYamlSerializer Implementation

**Key Methods:**

```typescript
serialize(model: OrmModel): string
  - Converts OrmModel instance to YAML string
  - Output conforms to orm-model.schema.json
  - Uses yaml.stringify() with lineWidth: 0 (no line wrapping)

deserialize(yaml: string): OrmModel
  - Parses YAML string
  - Validates against JSON Schema via SchemaValidator
  - Throws DeserializationError if validation fails
  - Constructs OrmModel from validated document
```

**Internal Structure:**

The serializer uses an intermediate representation (`OrmYamlDocument`) that mirrors the JSON Schema:

```typescript
interface OrmYamlDocument {
  orm_version: string;
  model: {
    name: string;
    domain_context?: string;
    object_types?: OrmYamlObjectType[];
    fact_types?: OrmYamlFactType[];
    subtype_facts?: OrmYamlSubtypeFact[];
    definitions?: OrmYamlDefinition[];
  };
}
```

**Error Handling:**

```typescript
export class DeserializationError extends Error {
  constructor(
    message: string,
    readonly validationResult?: ValidationResult,
  ) { ... }
}
```

Returns structured validation errors with paths and messages.

### 3.3 SchemaValidator Implementation

Uses `ajv` (Another JSON Schema Validator) for schema compliance checking:

```typescript
export class SchemaValidator {
  private readonly validate;

  constructor() {
    const ajv = new Ajv({ allErrors: true });
    this.validate = ajv.compile(ormModelSchema);
  }

  validateModel(data: unknown): ValidationResult {
    // Returns { valid: boolean, errors: SchemaError[] }
  }
}

export interface SchemaError {
  readonly path: string; // JSON path to error location
  readonly message: string; // Human-readable error message
}
```

**Key Features:**

- Compiled schema for efficient reuse across validation calls
- `allErrors: true` - collects all validation errors, not just the first
- Error paths use instancePath notation (e.g., "/model/object_types/0")

### 3.4 ProjectSerializer Implementation

Handles multi-domain project manifest files:

```typescript
serialize(project: OrmProject): string
deserialize(yaml: string): OrmProject
getMappingPaths(yaml: string): string[]  // Extract mapping file paths
```

**Key Points:**

- Stores domain and product references as file paths
- ContextMapping objects are loaded separately via MappingSerializer
- The manifest declares the set of domains, mappings, and products

### 3.5 MappingSerializer Implementation

Handles cross-domain context mapping files:

```typescript
serialize(mapping: ContextMapping): string
deserialize(yaml: string, path: string): ContextMapping
```

**Key Points:**

- Takes file path as parameter (for ContextMapping.path field)
- Converts between camelCase (TypeScript) and snake_case (YAML)
- Supports entity mappings and semantic conflicts

---

## Part 4: Example .orm.yaml Files

### 4.1 Simple Domain Model Example

**File:** `examples/transcripts/university-enrollment.orm.yaml`

```yaml
orm_version: "1.0"
model:
  name: university-enrollment
  object_types:
    - id: c4887900-c1e4-46a6-8e79-a65664fa1a74
      name: Student
      kind: entity
      reference_mode: student_number
      definition: A person admitted to the university...
    
    - id: 3c85f69a-8ac1-4bfa-9480-23912678a9c5
      name: Title
      kind: value
      definition: The free-text name of a course.
  
  fact_types:
    - id: 0c2d97bc-c24e-4254-b104-1e706cb6415d
      name: Student enrolls in CourseOffering
      roles:
        - id: 1e1c3cbb-cd55-406a-8ef7-a147fac4b847
          player: c4887900-c1e4-46a6-8e79-a65664fa1a74
          role_name: enrolls in
        - id: 162bd39e-7a59-4997-a091-d37021e62ea9
          player: eef9a705-c8db-4c3d-865c-a6517a7483ff
          role_name: is enrolled in by
      readings:
        - "{0} enrolls in {1}"
        - "{1} is enrolled in by {0}"
      constraints:
        - type: internal_uniqueness
          roles:
            - 1e1c3cbb-cd55-406a-8ef7-a147fac4b847
  
  definitions:
    - term: Backorder
      definition: An order that cannot be fulfilled...
      context: fulfillment
```

### 4.2 Key Files in Examples

- `examples/output/order-management.orm.yaml` - Complete order management domain
- `examples/output/university-enrollment.orm.yaml` - Complete university enrollment domain
- `examples/output/employee-hierarchy.orm.yaml` - Employee hierarchy domain
- `examples/output/clinic-appointments.orm.yaml` - Clinic appointments domain
- `packages/core/tests/integration/fixtures/orderManagement.orm.yaml` - Test fixture with complex constraints

### 4.3 Multi-Domain Example

**File:** `packages/core/tests/integration/fixtures/multi-domain/domains/crm.orm.yaml`
**File:** `packages/core/tests/integration/fixtures/multi-domain/domains/billing.orm.yaml`

These demonstrate separate domain models that can be composed via project manifests.

---

## Part 5: Round-Trip Serialization

### 5.1 What "Round-Trip" Means

A round-trip serialization test verifies that:

1. Start with an OrmModel instance (constructed in code)
2. Serialize it to YAML using `OrmYamlSerializer.serialize()`
3. Deserialize the YAML back to OrmModel using `OrmYamlSerializer.deserialize()`
4. The resulting model is identical to the original (all fields, IDs, constraints preserved)

This ensures **zero data loss** during the serialize-deserialize cycle.

### 5.2 Round-Trip Guarantees

The implementation guarantees:

- All UUIDs are preserved exactly
- All constraint types and their parameters are preserved
- All roles, role names, and player references are preserved
- All definitions and domain context information is preserved
- All readings are preserved in order
- All optional fields are only included when present (compact YAML output)

### 5.3 Testing Round-Trip Fidelity

Key integration test: `packages/core/tests/integration/roundTrip.test.ts`

Example test pattern:

```typescript
const model = new ModelBuilder()
  .withEntityType("Customer", ...)
  .withFactType("Customer places Order", ...)
  .build();

const yaml = new OrmYamlSerializer().serialize(model);
const restored = new OrmYamlSerializer().deserialize(yaml);

// All properties of model and restored are identical
expect(restored).toEqual(model);
```

---

## Part 6: Dependencies

### 6.1 Runtime Dependencies (in package.json)

```json
{
  "dependencies": {
    "ajv": "^8.18.0", // JSON Schema validation
    "yaml": "^2.8.2" // YAML parsing and stringification
  }
}
```

**Why these libraries:**

- **ajv** - Industry-standard, high-performance JSON Schema validator
- **yaml** - Native YAML support without external build tools; maintains comments and formatting better than alternatives

### 6.2 No Additional Dependencies

Per project guidelines:

- UUID generation uses native `node:crypto.randomUUID()` (no uuid package)
- File I/O is handled by the extension/CLI layer (not in core)
- Type validation uses TypeScript's type system + discriminated unions

---

## Part 7: File Format Examples from Architecture Spec

### 7.1 Domain Model File Format

```yaml
# yaml-language-server: $schema=https://orm-modeler.dev/schemas/v1/orm-model.schema.json
orm_version: "1.0"

model:
  name: "Order Management"
  domain_context: "ecommerce"

  object_types:
    - id: "ot-001"
      name: "Customer"
      kind: "entity"
      reference_mode: "customer_id"
      definition: "A person or organization that has placed at least one order."
      source_context: "crm"

    - id: "ot-002"
      name: "Order"
      kind: "entity"
      reference_mode: "order_number"
      definition: "A confirmed request by a customer for one or more products."

    - id: "ot-003"
      name: "Rating"
      kind: "value"
      value_constraint:
        values: ["A", "B", "C", "D", "F"]

  fact_types:
    - id: "ft-001"
      name: "Customer places Order"
      roles:
        - id: "r-001"
          player: "ot-001"
          role_name: "places"
        - id: "r-002"
          player: "ot-002"
          role_name: "is placed by"
      readings:
        - "{0} places {1}"
        - "{1} is placed by {0}"
      constraints:
        - type: "internal_uniqueness"
          roles: ["r-002"]      # each Order is placed by at most one Customer
        - type: "mandatory"
          role: "r-002"         # every Order is placed by some Customer

  definitions:
    - term: "Backorder"
      definition: "An order that cannot be fulfilled from current inventory."
      context: "fulfillment"
```

### 7.2 Context Mapping File Format

```yaml
# yaml-language-server: $schema=https://orm-modeler.dev/schemas/v1/orm-mapping.schema.json
orm_version: "1.0"

mapping:
  source_context: "crm"
  target_context: "billing"
  pattern: "anticorruption_layer"

  entity_mappings:
    - source_object_type: "Customer"
      target_object_type: "Account"
      description: "CRM Customer maps to Billing Account for active customers only."

  semantic_conflicts:
    - term: "Customer"
      source_meaning: "Any person or org the sales team is tracking, including leads."
      target_meaning: "An entity with an active or historical payment relationship."
      resolution: "In the analytical model, Customer refers to the billing definition."
```

### 7.3 Project Manifest File Format

```yaml
# yaml-language-server: $schema=https://orm-modeler.dev/schemas/v1/orm-project.schema.json
orm_version: "1.0"

project:
  name: "Data Warehouse Semantic Model"

  domains:
    - path: "./domains/crm.orm.yaml"
      context: "crm"
    - path: "./domains/billing.orm.yaml"
      context: "billing"
    - path: "./domains/fulfillment.orm.yaml"
      context: "fulfillment"

  mappings:
    - path: "./mappings/crm-billing.map.yaml"
    - path: "./mappings/crm-fulfillment.map.yaml"

  products:
    - path: "./products/customer-lifetime-value.orm.yaml"
      context: "clv"
      depends_on:
        domains: ["crm", "billing"]
        mappings: ["crm-billing"]
```

---

## Part 8: Schema Language and Validation

### 8.1 JSON Schema Version

All schemas use **JSON Schema Draft 7** (`http://json-schema.org/draft-07/schema#`):

- Mature, stable specification
- Supported by tooling and editors
- Allows conditional validation (if/then for entity type rules)
- Full support in ajv validator

### 8.2 Conditional Validation Example

From orm-model.schema.json, object_type definition:

```json
"if": {
  "properties": { "kind": { "const": "entity" } }
},
"then": {
  "required": ["reference_mode"]
}
```

This ensures: if kind == "entity", reference_mode is required.

### 8.3 oneOf Discriminated Unions

Constraints use `oneOf` with discriminated `type` field:

```json
"constraints": {
  "oneOf": [
    {
      "properties": {
        "type": { "const": "internal_uniqueness" },
        "roles": { ... }
      },
      "required": ["type", "roles"],
      "additionalProperties": false
    },
    {
      "properties": {
        "type": { "const": "mandatory" },
        "role": { ... }
      },
      "required": ["type", "role"],
      "additionalProperties": false
    },
    // ... more constraint types
  ]
}
```

Each constraint type is validated independently with strict `additionalProperties: false`.

---

## Part 9: Current Implementation Status

### 9.1 What's Implemented

- [x] OrmYamlSerializer with full serialize/deserialize cycle
- [x] SchemaValidator with ajv integration
- [x] ProjectSerializer for .orm-project.yaml
- [x] MappingSerializer for .map.yaml
- [x] JSON Schema definitions (orm-model, orm-project, context-mapping)
- [x] Round-trip serialization (lossless)
- [x] Error handling with structured validation errors
- [x] Support for all Phase 1 and Phase 2 constraints
- [x] Support for subtype facts
- [x] Multi-domain project loading
- [x] Context mapping with entity mappings and semantic conflicts

### 9.2 What's Not Yet Implemented (Future Phases)

- [ ] Schema migration framework (version 1.0 -> 1.1+)
- [ ] NORMA XML import (low priority)
- [ ] Analytical model derivation metadata
- [ ] LLM prompt integration (separate package: @barwise/llm)
- [ ] VS Code LSP integration (uses serializers)
- [ ] VS Code extension commands (uses serializers)

---

## Part 10: Code Examples

### 10.1 Basic Serialization

```typescript
import { OrmYamlSerializer } from "@barwise/core";

// Serialize a model to YAML
const serializer = new OrmYamlSerializer();
const yamlString = serializer.serialize(model);
console.log(yamlString);

// Deserialize YAML back to model
try {
  const restored = serializer.deserialize(yamlString);
} catch (e) {
  if (e instanceof DeserializationError) {
    console.error("Schema validation failed:", e.validationResult?.errors);
  }
}
```

### 10.2 Project Loading

```typescript
import { MappingSerializer, ProjectSerializer } from "@barwise/core";
import { readFileSync } from "fs";

// Load project manifest
const projectYaml = readFileSync("project.orm-project.yaml", "utf-8");
const project = new ProjectSerializer().deserialize(projectYaml);

// Load domain models
for (const domain of project.domains) {
  const domainYaml = readFileSync(domain.path, "utf-8");
  const model = new OrmYamlSerializer().deserialize(domainYaml);
  // Use model...
}

// Load context mappings
const mappingPaths = new ProjectSerializer().getMappingPaths(projectYaml);
for (const path of mappingPaths) {
  const mappingYaml = readFileSync(path, "utf-8");
  const mapping = new MappingSerializer().deserialize(mappingYaml, path);
  // Use mapping...
}
```

---

## Part 11: Integration Points

### 11.1 Serialization in the Architecture

From ARCHITECTURE.md Section 4:

```
Platform-Independent Core
├── ORM Metamodel
├── Model Services
│   ├── Validation Engine
│   ├── Verbalization Engine
│   ├── OIAL Mapper
│   └── Relational Mapper (Rmap)
└── Import / Export
    ├── Transcript Processor (LLM)
    ├── Serialization (.orm.yaml)  <-- This milestone
    ├── NORMA XML Import
    └── Schema Export (DDL)
```

### 11.2 VS Code Extension Integration

- **ShowDiagramCommand.ts** - Loads .orm.yaml using OrmYamlSerializer
- **ImportTranscriptCommand.ts** - Processes LLM output, saves via OrmYamlSerializer
- **OrmLanguageServer.ts** - Validates files against schema

### 11.3 LLM Integration (@barwise/llm)

The serialization layer provides:

- JSON Schema as structured output constraint for LLM prompts
- Deserialization of LLM-generated JSON into OrmModel instances
- Validation errors with source references for human review

---

## Part 12: Testing Coverage

### 12.1 Test Files

- `packages/core/tests/serialization/OrmYamlSerializer.test.ts` - Comprehensive serialization tests
- `packages/core/tests/integration/roundTrip.test.ts` - Round-trip fidelity
- `packages/core/tests/integration/multiFileProject.test.ts` - Multi-domain project loading
- `packages/core/tests/integration/fixtures/` - Example .orm.yaml files used in tests

### 12.2 Coverage Targets

- Serialization: **95%+** coverage (data loss is unacceptable)
- All constraint types must serialize and deserialize identically
- Round-trip tests verify lossless conversion

---

## Part 13: Key Design Principles

1. **Schema as Contract** - The JSON Schema is the authoritative specification; serializers must conform to it exactly
2. **Lossless Round-Trip** - No data loss during serialize-deserialize cycles
3. **Human-Readable YAML** - Prefer compact, readable output (no line wrapping, logical organization)
4. **Validation on Load** - Every deserialized file is validated against the schema before model construction
5. **Clear Error Messages** - Validation errors include JSON paths and human-readable messages
6. **No External State** - Serialization is pure; no file system or network calls in the serializer itself

---

## Summary

Milestone 3 is **functionally complete** with all core serialization infrastructure in place:

- **OrmYamlSerializer** - Full round-trip YAML serialization for domain models
- **ProjectSerializer** - Project manifest loading and serialization
- **MappingSerializer** - Context mapping file serialization
- **SchemaValidator** - JSON Schema validation using ajv
- **JSON Schemas** - Three authoritative schema files (orm-model, orm-project, context-mapping)
- **Example Files** - Multiple complete .orm.yaml examples demonstrating the format
- **Error Handling** - Structured validation errors with paths and messages
- **Round-Trip Fidelity** - Lossless serialization verified by integration tests

The implementation is production-ready and used throughout the system by the validation engine, VS Code extension, and LLM integration. Future work includes schema migration support (for version evolution) and NORMA XML import (low priority).
