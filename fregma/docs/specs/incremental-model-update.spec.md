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

#### Problem

`constraintKey()` uses `JSON.stringify(c)` to produce comparison keys,
but the serialized form includes role IDs. Since each LLM extraction
generates fresh UUIDs for roles, two semantically identical constraints
produce different keys. This causes every re-extraction to report
spurious "constraints added" + "constraints removed" pairs for
constraints that haven't actually changed.

#### Approach

Replace `JSON.stringify(c)` with a normalized key function that
resolves role IDs to positional indices within the parent fact type.
Since `diffConstraints` is called from `diffFactType` (which already
matches fact types by name and compares roles by position), positional
indices are the stable identity.

The new `constraintKey(c, roles)` accepts the fact type's roles array
and maps each role ID to its 0-based index. The key is then built per
constraint type using only semantic properties:

| Constraint type | Key components |
|---|---|
| `internal_uniqueness` | type, sorted role indices, isPreferred |
| `mandatory` | type, role index |
| `external_uniqueness` | type, sorted role indices |
| `value_constraint` | type, role index (if present), sorted values |
| `disjunctive_mandatory` | type, sorted role indices |
| `exclusion` | type, sorted role indices |
| `exclusive_or` | type, sorted role indices |
| `subset` | type, subset indices, superset indices (order preserved) |
| `equality` | type, indices1, indices2 (order preserved) |
| `ring` | type, index1, index2, ringType |
| `frequency` | type, role index, min, max |

For role IDs not found in the fact type's roles (cross-fact-type
constraints like external uniqueness), the raw ID is kept as-is.
Cross-FT constraint normalization is deferred until those constraints
are fully supported in the merge engine.

`diffConstraints` gains a `roles` parameter (the fact type's roles
array) that it forwards to `constraintKey`.

#### Tests

1. **False-positive elimination**: Two models with identical
   constraints but different role UUIDs produce no diff (the core bug).
2. **Real changes still detected**: Uniqueness moved from role 0 to
   role 1 is reported as a change.
3. **isPreferred flip detected**: Same uniqueness constraint but
   `isPreferred` toggled is reported.
4. **Phase 2 constraints with fresh IDs**: Subset, ring, and frequency
   constraints with different UUIDs produce no false positive.
5. **Phase 2 semantic change detected**: Ring constraint with changed
   `ringType` is reported.
6. **Existing tests unaffected**: All current diff tests continue to
   pass without modification.

#### Files

##### Modified files
- `packages/core/src/diff/ModelDiff.ts` -- rewrite `constraintKey()`,
  update `diffConstraints()` signature to accept roles
- `packages/core/tests/diff/ModelDiff.test.ts` -- add constraint
  normalization tests

### Stage 3: Potential-synonym detection

#### Problem

When a concept is renamed between transcripts (e.g. one stakeholder
says "Customer", another says "Client"), the diff reports an unrelated
remove + add pair. The modeler must manually recognize the rename,
reject the removal, accept the addition, and remember to add an alias.
This is error-prone and tedious, especially with multiple renames in a
single import.

#### Approach

After the initial `diffModels` pass, scan for removed/added pairs of
the same element type and compute a structural similarity score. Pairs
that exceed a threshold are reported as `SynonymCandidate` items on
`ModelDiffResult` for human resolution.

The detection is deliberately conservative: it flags plausible matches
for the user to confirm, never auto-links. Per the design principles,
"synonyms are ambiguities" -- "Customer" and "Client" might be the
same concept, different concepts, or a refinement. Only the modeler
knows.

#### New types

```typescript
export interface SynonymCandidate {
  /** The element type being compared. */
  readonly elementType: "object_type" | "fact_type";
  /** Name of the removed element. */
  readonly removedName: string;
  /** Name of the added element. */
  readonly addedName: string;
  /** Index of the removed delta in the deltas array. */
  readonly removedIndex: number;
  /** Index of the added delta in the deltas array. */
  readonly addedIndex: number;
  /** Why the pair was flagged (human-readable reasons). */
  readonly reasons: readonly string[];
}
```

`ModelDiffResult` gains an optional field:
```typescript
export interface ModelDiffResult {
  readonly deltas: readonly ModelDelta[];
  readonly hasChanges: boolean;
  readonly synonymCandidates: readonly SynonymCandidate[];
}
```

Definitions are excluded from synonym detection. Definition renames
are rare and the term itself is the identity -- if the term changes,
the definition is genuinely different.

#### Similarity heuristics

Synonym detection uses simple, deterministic heuristics. No string
distance algorithms or fuzzy matching -- those add complexity and
false positives. Instead, we look for structural overlap that is
hard to explain by coincidence.

##### Object type pairing

A removed + added object type pair is flagged when **all** of these
hold:

1. **Same kind** -- both entity or both value (required gate)
2. **At least one structural signal** from:
   - **Alias match**: the removed name appears in the added type's
     aliases, or vice versa (strongest signal)
   - **Matching reference mode pattern**: both entities have reference
     modes with the same suffix after stripping the type name prefix
     (e.g. "customer_id" and "client_id" both end in "_id")
   - **Overlapping value constraint**: for value types, the sets of
     allowed values overlap by >= 50%
   - **Same data type**: both have the same `dataType.name` (weak
     signal, only counts alongside another signal)

Each matching signal is recorded in `reasons` so the user understands
why the pair was flagged.

When multiple added types could match a single removed type (or vice
versa), all valid pairs are reported. The user resolves which (if any)
is the actual synonym. No greedy 1:1 matching -- the real world is
messy and the modeler should see all plausible options.

##### Fact type pairing

A removed + added fact type pair is flagged when **all** of these
hold:

1. **Same arity** (required gate)
2. **Role player correspondence**: for each role position, the player
   names match, or the player pair is itself a synonym candidate
   (from the object type pass above). All positions must correspond.

This is intentionally strict. Fact type renames without a
corresponding entity rename are rare in practice -- they usually
co-occur with entity renames (e.g. "Customer places Order" becomes
"Client submits Order" when Customer is renamed to Client).

#### Algorithm

```
1. Collect removed object type deltas (with indices).
2. Collect added object type deltas (with indices).
3. For each (removed, added) pair where kind matches:
     Compute structural signals.
     If at least one signal matches, emit SynonymCandidate.
4. Collect removed fact type deltas (with indices).
5. Collect added fact type deltas (with indices).
6. For each (removed, added) pair where arity matches:
     Check role player correspondence (using OT synonym
     candidates from step 3 to allow transitive matching).
     If all positions correspond, emit SynonymCandidate.
```

This is O(R*A) for each element type, where R = removed count and
A = added count. In practice both are small (< 20 elements in a
typical transcript diff), so performance is not a concern.

#### Integration with downstream stages

- **Stage 4 (breaking change classification)**: Synonym candidates
  imply a potential rename, which is a "caution"-level change.
- **Stage 6 (enhanced review UI)**: Synonym candidates are presented
  as grouped items in the QuickPick with resolution options: "same
  concept (add alias)" vs "unrelated (keep as separate add/remove)".
  When the user picks "same concept", the merge should keep the
  existing element, add the new name as an alias, and take any
  updated properties from the incoming element.

The merge engine (`mergeModels`) does not change in this stage. It
already handles aliases via `unionAliases`. Synonym resolution is a
UI concern (Stage 6) that translates the user's choice into the
appropriate `accepted` set and alias additions.

#### Tests

1. **Object type alias match**: removed "Customer" + added "Client"
   where "Client" has `aliases: ["Customer"]` -- flagged.
2. **Object type reference mode match**: removed entity with
   "customer_id" + added entity with "client_id" -- flagged with
   "matching reference mode" reason.
3. **Object type value constraint overlap**: removed value type with
   values ["A","B","C"] + added value type with values ["A","B","D"]
   -- flagged (>= 50% overlap).
4. **No match when kinds differ**: removed entity + added value type
   -- not flagged even if reference modes look similar.
5. **No match when no structural signal**: removed entity "Foo" +
   added entity "Bar" with no overlapping signals -- not flagged.
6. **Multiple candidates**: removed "Customer" matches both added
   "Client" and added "Account" -- both pairs reported.
7. **Fact type rename via entity synonym**: removed "Customer places
   Order" + added "Client places Order" where Customer/Client are OT
   synonym candidates -- fact type pair flagged.
8. **Fact type no match on arity change**: removed binary + added
   ternary -- not flagged.
9. **No synonym candidates when diff has no removes or no adds**:
   empty `synonymCandidates` array.
10. **Existing diff behavior unchanged**: `deltas` array is identical
    regardless of synonym detection.

#### Files

##### Modified files
- `packages/core/src/diff/ModelDiff.ts` -- add `SynonymCandidate`
  type, extend `ModelDiffResult`, add `detectSynonymCandidates()`
  called at the end of `diffModels()`
- `packages/core/tests/diff/ModelDiff.test.ts` -- add synonym
  detection tests

### Stage 4: Breaking change classification

#### Problem

All deltas are presented identically in the review UI. A harmless
definition update looks the same as an arity change or entity removal.
The modeler must mentally classify each change to decide how much
scrutiny it deserves. With many deltas (common when re-extracting a
large domain), this is tedious and error-prone.

#### Approach

Add `breakingLevel: BreakingLevel` to each `ModelDelta`, computed
from the delta's `kind` and `changes` array. The level helps the UI
(Stage 6) sort and group deltas so the modeler can triage efficiently.

```typescript
export type BreakingLevel = "safe" | "caution" | "breaking";
```

The field is always present (not optional) so consumers don't need
null checks. `unchanged` deltas are always `"safe"`.

#### Classification rules

The level is determined by the **most severe** change in a delta's
`changes` array. If any single change is breaking, the whole delta is
breaking. If any is caution (and none is breaking), the delta is
caution.

##### Delta kind rules

| Kind | Default level | Notes |
|---|---|---|
| `unchanged` | safe | Nothing changed |
| `added` | safe | New elements are additive |
| `removed` | breaking | Removing an element can break references |
| `modified` | (per change) | Depends on what changed |

##### Modification change rules

| Change pattern | Level | Rationale |
|---|---|---|
| `definition changed` | safe | Documentation only |
| `aliases changed` | safe | Metadata only |
| `source context:` | safe | Metadata only |
| `data type:` / `data type added` / `data type removed` | caution | May affect downstream mappings |
| `reference mode:` | caution | Changes identification scheme |
| `value constraint changed` | caution | Changes allowed values |
| `readings changed` | safe | Verbalization only |
| `role N: name` | safe | Verbalization only |
| `role N: player` | breaking | Changes the relationship structure |
| `kind:` | breaking | Entity/value switch changes semantics |
| `arity:` | breaking | Structural change to fact type |
| `constraints added` | caution | New rules on existing data |
| `constraints removed` | caution | Relaxed rules, may indicate misunderstanding |

Changes not matching any pattern default to `caution` (unknown changes
deserve attention).

#### Implementation

A pure function `classifyBreakingLevel(delta)` computes the level
from the delta's `kind` and `changes` array. It is called for each
delta inside `diffModels()` before returning the result.

The function is not exported -- it is an implementation detail of the
diff engine. The result is stored on the delta itself.

#### Tests

1. **Unchanged delta**: level is `"safe"`.
2. **Added delta**: level is `"safe"`.
3. **Removed delta**: level is `"breaking"`.
4. **Definition-only change**: level is `"safe"`.
5. **Alias-only change**: level is `"safe"`.
6. **Reference mode change**: level is `"caution"`.
7. **Kind change (entity -> value)**: level is `"breaking"`.
8. **Arity change**: level is `"breaking"`.
9. **Role player change**: level is `"breaking"`.
10. **Constraint added**: level is `"caution"`.
11. **Mixed changes (safe + breaking)**: level is `"breaking"` (most
    severe wins).
12. **Role name change only**: level is `"safe"`.
13. **Readings-only change**: level is `"safe"`.
14. **Existing diff behavior unchanged**: deltas and synonymCandidates
    are identical regardless of classification.

#### Files

##### Modified files
- `packages/core/src/diff/ModelDiff.ts` -- add `BreakingLevel` type,
  `breakingLevel` field to delta interfaces,
  `classifyBreakingLevel()` function
- `packages/core/src/index.ts` -- export `BreakingLevel` type
- `packages/core/tests/diff/ModelDiff.test.ts` -- add classification
  tests

### Stage 5: Post-merge validation

#### Problem

`mergeModels()` is purely constructive -- it builds a new model from
the user's accepted deltas but does not validate the result. The
caller (`ImportTranscriptCommand`) writes the merged model to disk
immediately. If the user accepts a removal of an entity type that is
still referenced by a kept fact type, the merged model contains
dangling role player references. This corrupts the `.orm.yaml` file
silently.

Structural validation rules already cover every post-merge concern:
dangling role references, duplicate names, broken subtype references,
subtype cycles, and broken objectification references. The gap is
that nobody calls them between merge and write.

#### Approach

Add a `validateMergeResult()` function in the core package that runs
the existing `structuralRules` against a merged model and returns
only the errors. This keeps `mergeModels()` pure (no side effects,
no validation coupling) and gives consumers full control over how to
handle errors.

The function is deliberately narrow: it runs structural rules only,
not completeness warnings or constraint consistency checks. Those are
useful for general model health but not merge-specific. A merged
model that is structurally valid (no dangling refs, no duplicates) is
safe to write to disk even if it has completeness gaps.

```typescript
export interface MergeValidationResult {
  /** The merged model (always present, even if invalid). */
  readonly model: OrmModel;
  /** Structural errors found in the merged model. Empty if valid. */
  readonly errors: readonly Diagnostic[];
  /** True when the merged model has no structural errors. */
  readonly isValid: boolean;
}
```

A convenience wrapper `mergeAndValidate()` combines `mergeModels()`
and `validateMergeResult()` into a single call. This is the
recommended API for consumers who want both operations:

```typescript
export function mergeAndValidate(
  existing: OrmModel,
  incoming: OrmModel,
  deltas: readonly ModelDelta[],
  accepted: ReadonlySet<number>,
): MergeValidationResult;
```

`mergeModels()` remains unchanged and is still exported for consumers
who want merge without validation (tests, programmatic use).

#### Tests

1. **Valid merge produces no errors**: Accept an addition, merged
   model passes validation.
2. **Dangling role reference detected**: Accept removal of entity
   type "Customer" while keeping fact type "Customer places Order".
   Validation reports an error for the dangling player reference.
3. **validateMergeResult on valid model**: Calling
   `validateMergeResult()` on a structurally valid model returns
   an empty errors array.
4. **Valid merge returns isValid true**: `isValid` is true when
   `errors` is empty.
5. **Invalid merge returns isValid false**: `isValid` is false when
   `errors` is non-empty.
6. **mergeModels behavior unchanged**: `mergeModels()` still returns
   `OrmModel` directly (not wrapped in `MergeValidationResult`).
7. **Model is null when merge throws**: When `mergeModels()` throws
   (e.g. `addFactType` rejects dangling player), `mergeAndValidate`
   captures the error as a diagnostic with `model: null`.
8. **Existing merge tests pass**: All 23 existing merge tests
   continue to pass without modification.

#### Files

##### Modified files
- `packages/core/src/diff/ModelMerge.ts` -- add
  `validateMergeResult()`, `mergeAndValidate()`,
  `MergeValidationResult` type
- `packages/core/src/index.ts` -- export new types and functions
- `packages/core/tests/diff/ModelMerge.test.ts` -- add post-merge
  validation tests

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
