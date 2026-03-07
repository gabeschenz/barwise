# Milestone 3: JSON Schema and YAML Serialization - Quick Reference

## Files to Know

### Schema Files

- `/packages/core/schemas/orm-model.schema.json` - Domain model schema
- `/packages/core/schemas/orm-project.schema.json` - Project manifest schema
- `/packages/core/schemas/context-mapping.schema.json` - Context mapping schema

### Serializer Code

- `/packages/core/src/serialization/OrmYamlSerializer.ts` - Main serializer
- `/packages/core/src/serialization/SchemaValidator.ts` - Schema validation (ajv)
- `/packages/core/src/serialization/ProjectSerializer.ts` - Project manifest handling
- `/packages/core/src/serialization/MappingSerializer.ts` - Context mapping handling

### Example Files

- `/examples/transcripts/university-enrollment.orm.yaml` - University enrollment domain
- `/examples/output/order-management.orm.yaml` - Order management domain
- `/packages/core/tests/integration/fixtures/orderManagement.orm.yaml` - Test fixture

## Core Concepts

### YAML Structure (orm_version: "1.0")

```yaml
orm_version: "1.0"

model:
  name: "Model Name"
  domain_context: "optional-bounded-context"
  
  object_types:        # Entities and value types
  fact_types:         # Relationships and associations
  subtype_facts:      # Inheritance relationships
  definitions:        # Ubiquitous language glossary
```

### Schema Validation

- Uses **ajv** (Another JSON Schema Validator)
- **JSON Schema Draft 7** for all schemas
- Validates on deserialization before model construction
- Errors include JSON paths: `/model/object_types/0/name`

### Round-Trip Guarantee

1. Serialize OrmModel → YAML string
2. Deserialize YAML string → OrmModel
3. Result is identical to original (lossless)
4. All UUIDs, constraints, roles preserved

## Key Classes

### OrmYamlSerializer

```typescript
serialize(model: OrmModel): string
deserialize(yaml: string): OrmModel
  // throws DeserializationError if validation fails
```

### SchemaValidator

```typescript
validateModel(data: unknown): ValidationResult
  // Returns { valid: boolean, errors: SchemaError[] }
```

### ProjectSerializer

```typescript
serialize(project: OrmProject): string
deserialize(yaml: string): OrmProject
getMappingPaths(yaml: string): string[]
```

### MappingSerializer

```typescript
serialize(mapping: ContextMapping): string
deserialize(yaml: string, path: string): ContextMapping
```

## Constraint Types in YAML

### Phase 1 (Core)

```yaml
- type: internal_uniqueness
  roles: [role-id-1, role-id-2]

- type: mandatory
  role: role-id

- type: external_uniqueness
  roles: [role-id-1, role-id-2]

- type: value_constraint
  role: role-id  # optional
  values: [val1, val2, val3]
```

### Phase 2 (Extended)

```yaml
- type: disjunctive_mandatory
  roles: [role-id-1, role-id-2]

- type: exclusion
  roles: [role-id-1, role-id-2]

- type: exclusive_or
  roles: [role-id-1, role-id-2]

- type: subset
  subset_roles: [role-id-1]
  superset_roles: [role-id-2]

- type: equality
  roles_1: [role-id-1]
  roles_2: [role-id-2]

- type: ring
  role_1: role-id-1
  role_2: role-id-2
  ring_type: irreflexive  # or: asymmetric, antisymmetric, intransitive, acyclic, symmetric, transitive, purely_reflexive

- type: frequency
  role: role-id
  min: 1
  max: 10  # or: unbounded
```

## Dependencies

```json
{
  "ajv": "^8.18.0", // JSON Schema validation
  "yaml": "^2.8.2" // YAML parsing/stringification
}
```

## Usage Examples

### Basic Serialization

```typescript
import { OrmYamlSerializer } from "@barwise/core";

const serializer = new OrmYamlSerializer();
const yaml = serializer.serialize(model);
const restored = serializer.deserialize(yaml);
```

### Error Handling

```typescript
import { DeserializationError } from "@barwise/core";

try {
  const model = serializer.deserialize(yaml);
} catch (e) {
  if (e instanceof DeserializationError) {
    console.error("Validation errors:", e.validationResult?.errors);
  }
}
```

### Project Loading

```typescript
import { OrmYamlSerializer, ProjectSerializer } from "@barwise/core";

const projSerializer = new ProjectSerializer();
const modelSerializer = new OrmYamlSerializer();

const project = projSerializer.deserialize(projectYaml);
for (const domain of project.domains) {
  const model = modelSerializer.deserialize(domainYaml);
}
```

## Testing

- **Round-trip tests**: Verify serialize→deserialize preserves all data
- **Schema validation**: Tests for valid and invalid YAML structures
- **Multi-domain**: Tests for project manifests and context mappings
- **Coverage target**: 95%+ for serialization code

## Status

**Milestone 3 is COMPLETE** with:

- [x] JSON Schema definitions (3 files)
- [x] Full YAML serialization/deserialization
- [x] Schema validation with ajv
- [x] Round-trip fidelity verified
- [x] Error handling with structured errors
- [x] Multi-domain project support
- [x] Context mapping support
- [x] All constraint types supported

## Not Yet Implemented

- [ ] Schema versioning/migration (1.0 → 1.1+)
- [ ] NORMA XML import
- [ ] VS Code LSP integration (separate package)
- [ ] LLM integration (separate package: @barwise/llm)

## Read the Full Spec

See `MILESTONE3_RESEARCH.md` for:

- Complete schema documentation
- Architecture rationale
- Implementation details
- Integration points
- Testing strategy
- Design principles
