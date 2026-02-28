# FREGMA-5ln: Annotate .orm.yaml from transcript import with actionable TODOs

## Problem

When importing a transcript, the generated .orm.yaml file is opaque -- the
modeler has no visibility into what the LLM was uncertain about, what
constraints were skipped, or what structural gaps remain. The modeler must
review the entire model and manually cross-reference the output channel
report to identify what needs attention.

## Solution

Inject `# TODO(fregma):` and `# NOTE(fregma):` comments directly into the
.orm.yaml file, placed immediately after the `name:` line of the relevant
object type or fact type. This makes ambiguities and low-confidence inferences
visible inline where the modeler works.

## Design decisions

### Package boundary

The annotator lives in `@fregma/core` (not `@fregma/llm`) to avoid creating
a dependency from core to llm. Instead, a structural `TranscriptProvenance`
interface mirrors the shape of `DraftModelResult` from `@fregma/llm`. The
VS Code command passes `DraftModelResult` directly, which satisfies the
interface structurally.

### Shared annotation helpers

`stripFregmaComments()`, `formatFregmaComment()`, and `truncate()` were
extracted from `DbtYamlAnnotator` and `DbtExportAnnotator` into a shared
`annotation/helpers.ts`. Both existing annotators were refactored to use
the shared helpers. The YAML injection logic (regex scanning, insertion
points) stays separate per annotator since the YAML structures differ.

### Preferred identifier detection

The annotator checks for a formally declared preferred identifier (an
`internal_uniqueness` constraint with `isPreferred: true`), not just the
presence of a `referenceMode`. A reference mode is a naming hint; the
preferred identifier constraint is the formal ORM2 mechanism.

## Annotation categories

| Source | Severity | Message pattern |
|--------|----------|-----------------|
| `ambiguities[]` | TODO | `Ask: <description> (lines N-M)` |
| `constraintProvenance` where `applied=false` | TODO | `Skipped constraint: "<desc>" -- <reason> (lines N-M)` |
| `constraintProvenance` where `confidence="low"` | TODO | `Verify constraint: "<desc>" -- low confidence (lines N-M)` |
| `constraintProvenance` where `confidence="medium"` | NOTE | `Applied with medium confidence: "<desc>" (lines N-M)` |
| `subtypeProvenance` where `applied=false` | TODO | `Skipped subtype: X is a Y -- <reason> (lines N-M)` |
| `warnings[]` | NOTE | `<warning text>` (model-level) |
| Entity missing preferred identifier | TODO | `Ask: How do you uniquely identify a <Name>?` |
| Object type missing definition | NOTE | `No definition captured for <Name> -- consider adding one.` |

## Element matching

- Ambiguities: matched to fact type or object type by scanning the
  description for element names (case-insensitive). Fact types checked
  first (more specific). Falls back to model-level.
- Constraint provenance: matched to fact type by scanning the description
  for fact type names.
- Subtype provenance: matched to the subtype object type by name.
- Warnings: always model-level.
- Structural gaps: directly matched by object type name.

## YAML injection

Comments are injected after the `name:` line of the matching element
within the `object_types:` or `fact_types:` section. The annotator tracks
which section it's in using simple regex matching on section headers.

Two name patterns are supported:
- `      name: <value>` (6-space indent, continuation of `- id:` list item)
- `    - name: <value>` (4-space indent, combined list item)

Model-level annotations are injected after the `  name:` line under `model:`.

## Idempotency

`stripFregmaComments()` removes all existing fregma annotations before
re-injecting. Annotating an already-annotated file produces the same
result.

## Files

### New files
- `packages/core/src/annotation/helpers.ts` -- shared helpers
- `packages/core/src/annotation/OrmYamlAnnotator.ts` -- annotator + collection logic
- `packages/core/tests/annotation/helpers.test.ts` -- 9 tests
- `packages/core/tests/annotation/OrmYamlAnnotator.test.ts` -- 25 tests

### Modified files
- `packages/core/src/import/DbtYamlAnnotator.ts` -- refactored to use shared helpers
- `packages/core/src/mapping/renderers/DbtExportAnnotator.ts` -- refactored to use shared helpers
- `packages/core/src/index.ts` -- exports new types and functions
- `packages/vscode/src/commands/ImportTranscriptCommand.ts` -- calls annotator after serialization

## Test coverage

34 new tests covering:
- `collectAnnotations()` for each annotation category (ambiguities, skipped/low/medium/high constraints, skipped subtypes, warnings, structural gaps)
- Element matching (fact type, object type, model-level fallback)
- Options (disable structural gaps, disable medium confidence)
- YAML injection (correct placement, indentation)
- Idempotency (annotate twice = same result)
- Round-trip (annotate then strip = original)
- Edge cases (empty model, no fact types, multiple annotations per element)

## Public API

```typescript
// Main entry point
function annotateOrmYaml(
  yamlContent: string,
  provenance: TranscriptProvenance,
  options?: OrmAnnotationOptions,
): OrmAnnotationResult;

// For testing / advanced use
function collectAnnotations(
  provenance: TranscriptProvenance,
  options?: OrmAnnotationOptions,
): OrmAnnotation[];
```

## Integration

In `ImportTranscriptCommand.execute()`, after `serializer.serialize(finalModel)`
and before writing to disk, the command calls `annotateOrmYaml(rawYaml, result)`.
The annotation counts (TODO/NOTE) are included in the summary notification.
