# Phase 2 constraint extraction from transcripts

## Problem

The LLM extraction pipeline only supports 3 of 11 constraint types:
internal_uniqueness, mandatory, and value_constraint. The 8 Phase 2
constraint types already exist in the core model but are not extracted
from transcripts: external_uniqueness, disjunctive_mandatory,
exclusion, exclusive_or, subset, equality, ring, and frequency.

## Solution

Extend the LLM extraction pipeline to support all 11 constraint types
across 4 files:

### 1. ExtractionTypes.ts

Expand `InferredConstraintType` to include all 11 types. Add optional
fields to `InferredConstraint` for type-specific data:

- `ring_type?: string` -- for ring constraints
- `min?: number`, `max?: number | string` -- for frequency constraints
- `subset_roles?: string[]`, `superset_roles?: string[]` -- for
  subset/equality (reuse roles for one side, add second field)

### 2. ExtractionPrompt.ts

- Add Phase 2 constraint descriptions to the system prompt
- Add all 8 new types to the response schema enum
- Add type-specific optional fields to the schema

### 3. DraftModelParser.ts

For each new type, add a handler branch in Pass 3 that:

1. Resolves role hints to role IDs
2. Validates arity requirements
3. Checks for duplicates
4. Creates the constraint and records provenance

Grouping by resolution pattern:

**Multi-role, single fact type** (similar to internal_uniqueness):

- external_uniqueness -- multi-role, cross-fact-type allowed
- disjunctive_mandatory -- multi-role, cross-fact-type allowed
- exclusion -- multi-role, cross-fact-type allowed
- exclusive_or -- multi-role, cross-fact-type allowed

**Dual role sequences** (need two sets of roles):

- subset -- subset_roles -> fact_type_1, superset_roles -> fact_type_2
- equality -- same pattern as subset

**Paired roles, same fact type**:

- ring -- exactly 2 roles, same player, same fact type, plus ring_type

**Single role with numeric bounds**:

- frequency -- 1 role, min/max values

### 4. Cross-fact-type constraints

Some Phase 2 constraints (external_uniqueness, disjunctive_mandatory,
exclusion, exclusive_or) can span multiple fact types. Since the LLM
response schema ties each constraint to a single `fact_type`, we
handle this by:

- Resolving roles within the specified fact type first
- For subset/equality, using separate `fact_type` and
  `superset_fact_type` fields

This is a pragmatic simplification: most transcript-derived
constraints are within a single fact type. Cross-fact-type constraints
are rare in extraction and can be added manually.

## Test plan

- One "applies" test per constraint type (8 tests)
- One "skips with bad roles" test per constraint type (8 tests)
- One "detects duplicate" test per constraint type (8 tests)
- Frequency-specific: missing min/max, unbounded max
- Ring-specific: invalid ring_type, roles from different players
- Subset/equality: mismatched arity
