# Milestone 3 Documentation Index

Welcome to the comprehensive Milestone 3 (JSON Schema and YAML Serialization) documentation.

## Three Documentation Levels

### 1. Start Here: MILESTONE3_FINDINGS.md
**For:** Quick understanding of what Milestone 3 is and its current status
**Contains:**
- Executive summary
- 10 key findings
- Implementation status checklist
- Code statistics
- Next steps for extension
**Read time:** 10 minutes

**Location:** `docs/MILESTONE3_FINDINGS.md`

---

### 2. For Development: MILESTONE3_QUICK_REFERENCE.md
**For:** Developers working with serialization code
**Contains:**
- File locations (schemas, serializers, examples)
- Core YAML structure template
- All constraint types (Phase 1 and Phase 2)
- Key class interfaces
- Usage code examples
- Status checklist
**Read time:** 5 minutes (lookup reference)

**Location:** `docs/MILESTONE3_QUICK_REFERENCE.md`

---

### 3. For Deep Understanding: MILESTONE3_RESEARCH.md
**For:** Complete technical reference and design decisions
**Contains:**
- 13 detailed sections
- Architecture specification
- Complete JSON Schema documentation
- Serialization implementation details
- Round-trip guarantees
- Design principles
- Testing strategy
- Integration points
- Code examples
**Read time:** 30 minutes (comprehensive reference)

**Location:** `docs/MILESTONE3_RESEARCH.md`

---

## Quick Facts

| Aspect | Details |
|--------|---------|
| **Status** | Complete and production-ready |
| **Schema Version** | 1.0 |
| **Implementation** | 788 lines TypeScript + 612 lines JSON Schema |
| **Dependencies** | ajv (validation), yaml (parsing) |
| **Round-Trip** | Guaranteed lossless serialization |
| **Constraint Types** | 12 total (4 Phase 1, 8 Phase 2) |
| **Example Files** | 10+ complete models provided |
| **Test Coverage** | 95%+ for serialization code |

---

## Core Files

### Serialization Code
- `OrmYamlSerializer.ts` - Main round-trip serialization (390 lines)
- `SchemaValidator.ts` - JSON Schema validation (55 lines)
- `ProjectSerializer.ts` - Project manifest handling (184 lines)
- `MappingSerializer.ts` - Context mapping handling (159 lines)

**Location:** `/packages/core/src/serialization/`

### JSON Schemas
- `orm-model.schema.json` - Domain model definition (407 lines)
- `orm-project.schema.json` - Project manifest definition (109 lines)
- `context-mapping.schema.json` - Context mapping definition (96 lines)

**Location:** `/packages/core/schemas/`

### Example Files
- `university-enrollment.orm.yaml` - University domain
- `order-management.orm.yaml` - E-commerce domain
- `clinic-appointments.orm.yaml` - Healthcare domain
- `employee-hierarchy.orm.yaml` - HR domain

**Location:** `/examples/` and `/packages/core/tests/integration/fixtures/`

---

## What Milestone 3 Provides

### Completed Features
- JSON Schema definitions for all file types
- Full YAML round-trip serialization
- Schema validation before model construction
- Multi-domain project support
- Context mapping with semantic conflict tracking
- All Phase 1 constraints (4 types)
- All Phase 2 constraints (8 types)
- Subtype fact serialization
- Error handling with structured diagnostics
- Example models demonstrating all features

### Not Yet Implemented
- Schema versioning and migration (1.0 → 1.1+)
- NORMA XML import (low priority)
- Analytical model derivation metadata
- LLM integration (separate package)
- VS Code LSP integration (separate package)

---

## Understanding the Architecture

### Why YAML?
- Human-readable text format
- Meaningful diffs in version control
- Familiar to data engineers (dbt, Airflow)
- Supports inline comments

### JSON Schema Purpose
- File validation on load
- VS Code autocomplete support (with Red Hat YAML extension)
- LLM output constraint specification
- Multi-file reference contract definition

### Round-Trip Guarantee
```
OrmModel (in memory)
    ↓
serialize() → YAML string
    ↓
deserialize() → OrmModel
    ↓
Result is identical to original
(all UUIDs, constraints, roles preserved)
```

---

## Key Design Decisions

1. **YAML over XML/JSON** - Readability and version control
2. **JSON Schema as first-class artifact** - Used for validation and editor intelligence
3. **Discriminated unions** - Constraints use type field with oneOf validation
4. **Conditional validation** - Entity types must have reference_mode (if/then rule)
5. **Lossless round-trip** - All data preserved, including optional fields
6. **Layered validation** - Schema validation on load, then model construction validation

---

## Usage Quick Start

### Basic Serialization
```typescript
import { OrmYamlSerializer } from '@barwise/core';

const serializer = new OrmYamlSerializer();

// Serialize
const yaml = serializer.serialize(model);

// Deserialize
try {
  const restored = serializer.deserialize(yaml);
} catch (e) {
  if (e instanceof DeserializationError) {
    console.error("Validation errors:", e.validationResult?.errors);
  }
}
```

### Project Loading
```typescript
import { ProjectSerializer, OrmYamlSerializer } from '@barwise/core';

const projSerializer = new ProjectSerializer();
const modelSerializer = new OrmYamlSerializer();

// Load project
const project = projSerializer.deserialize(projectYaml);

// Load domains
for (const domain of project.domains) {
  const model = modelSerializer.deserialize(domainYaml);
  // Use model...
}
```

---

## Dependencies

**Runtime:**
- `ajv@^8.18.0` - JSON Schema validation
- `yaml@^2.8.2` - YAML parsing and stringification

**No additional dependencies allowed per project guidelines:**
- UUID generation uses native `node:crypto.randomUUID()`
- File I/O handled by extension/CLI layer (not in core)

---

## Testing

### What's Tested
- All serializer classes (unit tests)
- Round-trip fidelity (serialize → deserialize → identical)
- Schema validation (valid and invalid YAML)
- Multi-domain project loading
- All constraint types
- Error handling and messages

### Coverage Target
- Serialization: **95%+** (data loss is unacceptable)
- Integration tests verify lossless conversion

### Test Files
- `packages/core/tests/serialization/` - Unit tests
- `packages/core/tests/integration/roundTrip.test.ts` - Round-trip verification
- `packages/core/tests/integration/fixtures/` - Example files and test data

---

## Next Steps for Extension

To extend or enhance Milestone 3:

1. **Schema Migration** - Implement version upgrade (1.0 → 1.1+)
   - Create migration runners in `/serialization/migration/`
   - Write version-specific migration functions
   - Update SchemaValidator to detect and apply migrations

2. **NORMA Import** - Add NORMA XML support (low priority)
   - Create NormaXmlImporter in `/import/`
   - Map NORMA elements to OrmModel

3. **LLM Integration** - Use schemas in @barwise/llm package
   - Provide schema as structured output constraint
   - Validate LLM responses against schema

4. **VS Code Integration** - Use serializers in extension
   - Load .orm.yaml files in ShowDiagramCommand
   - Validate on save in OrmLanguageServer
   - Process transcripts with ProjectSerializer

5. **Diagram Export** - Serialize layout metadata
   - Extend schema to store diagram position overrides
   - Save and restore layout state

---

## Related Documentation

- **ARCHITECTURE.md** (Section 4: Import/Export) - Original specification
- **CLAUDE.md** (/packages/core/CLAUDE.md) - Core package guidelines
- **ARCHITECTURE.md** (Section 9: Implementation Phasing) - Phase description

---

## Questions?

Refer to the appropriate documentation:

- **"What is Milestone 3?"** → MILESTONE3_FINDINGS.md
- **"Where is the code?"** → MILESTONE3_QUICK_REFERENCE.md
- **"How does it work?"** → MILESTONE3_RESEARCH.md
- **"How do I use it?"** → MILESTONE3_QUICK_REFERENCE.md (Usage Examples)
- **"What constraints are supported?"** → MILESTONE3_QUICK_REFERENCE.md (Constraint Types)
- **"What's the schema structure?"** → MILESTONE3_RESEARCH.md (Part 2)
- **"How is error handling done?"** → MILESTONE3_RESEARCH.md (Part 3.2)
- **"Why YAML?"** → MILESTONE3_RESEARCH.md (Part 1.1)

---

**Last Updated:** February 2026
**Status:** Milestone 3 Complete and Production-Ready
