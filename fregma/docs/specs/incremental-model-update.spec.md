# FREGMA-mq9: Incremental Model Update Workflow for Breaking Changes

## Problem

When importing a second conversation transcript against an existing ORM model,
the new information may conflict with or override existing domain knowledge.
The current diff/merge infrastructure (`diffModels`, `mergeModels`,
`reviewDeltas` in `ImportTranscriptCommand`) handles additive changes but has
gaps around breaking change scenarios:

- Entity renames appear as unrelated remove + add, losing identity continuity
- Constraint comparison uses `JSON.stringify` which includes role IDs,
  producing false-positive diffs across LLM re-extractions
- All deltas are presented identically -- a harmless definition update looks
  the same as an arity change or entity removal
- No mechanism for recording that two terms are synonyms for the same concept
- No post-merge validation to catch broken references before writing to disk

## Design principles

- **No workflow prescription**: The tool handles whatever the user throws at
  it. There is no "update mode" vs "import mode" -- the diff always runs
  against the full existing model. Removals are presented clearly and
  unchecked by default. The user decides.
- **Synonyms are ambiguities**: When a removed + added pair looks like a
  rename, it is flagged as a potential synonym for human resolution, not
  automatically linked. The business is messy -- "Customer" and "Client"
  might be the same concept, different concepts, or a refinement.
- **Aliases capture domain reality**: Object types can carry alternative
  names, reflecting that different stakeholders or bounded contexts use
  different terms for the same concept. This aligns with the semantic
  modeling guidance (section 4.4: handling cross-domain conflicts).
- **Classification aids decision-making**: Breaking change levels (safe,
  caution, breaking) help the user scan deltas efficiently, not constrain
  their choices.

## Scope -- Stage 1 (this PR)

Stage 1 adds `aliases` to `ObjectType` and threads it through the full
stack: model, serialization, JSON Schema, diff, and merge.

### ObjectType aliases

- Optional `aliases?: readonly string[]` on `ObjectTypeConfig` and
  `ObjectType`
- Stored as a frozen array; `undefined` when not present
- Represents alternative names for the same concept (synonyms from
  different stakeholders, bounded contexts, or source systems)

### Serialization

- Round-trips through `.orm.yaml` as an `aliases` array under each
  object type
- Omitted from YAML when empty or undefined (clean output)

### JSON Schema

- `aliases` added to the object type schema as `type: array, items: string`

### Diff

- `diffObjectType()` compares aliases (order-insensitive)
- Reports change as `"aliases changed"` when sets differ
- Same aliases in different order is NOT a change

### Merge

- Modified object types: aliases are unioned (existing + incoming,
  deduplicated) when the modification is accepted
- Added/removed/unchanged: standard behavior

### ModelBuilder

- `withEntityType()` and `withValueType()` accept optional `aliases`

## Future stages (not in this PR)

### Stage 2: Constraint comparison fix

Replace `JSON.stringify(c)` in `constraintKey()` with a normalized
comparison that strips role IDs and compares by type + structural shape.

### Stage 3: Potential-synonym detection

After the initial diff pass, scan for removed/added pairs of the same
element type with structural similarity. Produce `SynonymCandidate`
items on `ModelDiffResult` for human resolution.

### Stage 4: Breaking change classification

Add `breakingLevel: "safe" | "caution" | "breaking"` to each
`ModelDelta` based on the nature of the change.

### Stage 5: Post-merge validation

Run structural validation on the merged model before writing to disk.
Flag dangling player references, orphaned constraints, etc.

### Stage 6: Enhanced review UI

Group deltas by breaking level in the QuickPick. Present synonym
candidates as single items with resolution options (same concept vs
unrelated). Warn on post-merge validation errors.

## Deferred

- **Cross-context `SemanticEquivalence`**: Project-level synonym
  documentation across bounded contexts (extends the existing
  `SemanticConflict` / `ContextMapping` infrastructure).
- **LLM-assisted contradiction detection**: Passing the existing model
  into the extraction pipeline so the LLM can flag explicit contradictions.
- **Entity split/merge**: Manual modeling decision, too complex for
  automated handling.
- **Cross-FT constraint remapping**: `remapConstraintIds()` stub stays
  until cross-fact-type constraints are implemented.

## Files (Stage 1)

### Modified files
- `packages/core/src/model/ObjectType.ts` -- add aliases field
- `packages/core/src/serialization/OrmYamlSerializer.ts` -- serialize/deserialize aliases
- `packages/core/schemas/orm-model.schema.json` -- add aliases to schema
- `packages/core/src/diff/ModelDiff.ts` -- compare aliases in diffObjectType
- `packages/core/src/diff/ModelMerge.ts` -- union aliases on modified elements
- `packages/core/tests/helpers/ModelBuilder.ts` -- accept aliases option
- `packages/core/tests/model/ObjectType.test.ts` -- alias construction tests
- `packages/core/tests/diff/ModelDiff.test.ts` -- alias diff tests
- `packages/core/tests/diff/ModelMerge.test.ts` -- alias merge tests

### New files
- `packages/core/tests/serialization/AliasesSerialization.test.ts` -- round-trip tests
- `docs/specs/incremental-model-update.spec.md` -- this file
