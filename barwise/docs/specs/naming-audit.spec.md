# Spec: Internal Naming Audit (BARWISE-93q)

## Goal

Improve semantic precision of exported type names, field names, and
function names across the @barwise/core public API surface. A project
that models business domains using ubiquitous language should hold
itself to the same standard internally.

## Renames

| # | Current | Proposed | Rationale | Blast Radius |
|---|---------|----------|-----------|--------------|
| 1 | `ValidationResult` (SchemaValidator) | `SchemaValidationResult` | Generic; collides conceptually with MergeValidationResult | 5 files (core) |
| 2 | `validateMergeResult()` | `getStructuralErrors()` | Hides that it filters to error-severity only | 4 files (core + mcp) |
| 3 | `MergeValidationResult.errors` | `.diagnostics` | Typed as Diagnostic[] which supports all severities | 3 files (core + vscode) |
| 4 | `ModelDelta.changes` | `.changeDescriptions` | Human-readable strings, not structured objects | 6 files (core + cli + mcp) |
| 5 | `FactInstance.values` | `.roleValues` | "values" is generic; it maps role IDs to data values | ~20 files (core + llm) |

## Not Renaming

- `Column.dataType` -- context-appropriate, 25+ file blast radius
- `Verbalization.text` -- reads naturally, 22 files
- `Role.playerId` -- standard ORM 2 terminology
- `expandReading` -- accurate template expansion name
- `SegmentKind` / `DeltaKind` -- style preference, not precision
- `Population.instances` -- clear in class context
- `OrmModel.domainContext` -- matches DDD terminology

## YAML Schema Impact

None. All renames are runtime API names. The .orm.yaml file format is
unchanged.

## Stages

### Stage 1: Core-internal renames (smallest blast radius)
- ValidationResult -> SchemaValidationResult
- validateMergeResult -> getStructuralErrors
- Build + test core and mcp
- Status: Not Started

### Stage 2: Cross-package field renames
- MergeValidationResult.errors -> .diagnostics
- ModelDelta.changes -> .changeDescriptions (all 3 delta interfaces)
- Build + test core, cli, mcp, vscode
- Status: Not Started

### Stage 3: FactInstance.values (largest blast radius)
- FactInstance.values -> .roleValues
- FactInstanceConfig.values -> .roleValues
- Update serialization bridge (YAML key stays `values:` on disk)
- Build + lint + test full monorepo
- Status: Not Started

### Stage 4: Verify and ship
- Full monorepo build, lint, test
- Single commit, push, PR
- Status: Not Started
