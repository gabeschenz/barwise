# FREGMA-cp4: Phase 2 Constraint Extraction Test Coverage

## Goal

Close 3 untested branches in the equality constraint handler of
`DraftModelParser.ts`. All other Phase 2 constraint types have full
branch coverage.

## Findings

The subset and equality handlers share a code path (lines 443-522).
Subset has 6 tests covering all 7 branches. Equality has only 4 tests,
missing 3 branches that are tested for subset but not equality:

| Branch | Line | Subset test | Equality test |
|--------|------|-------------|---------------|
| Missing superset_roles | 455 | Yes | **No** |
| Superset FT not found | 467 | Yes | **No** |
| Role resolution failure | 483 | Yes | **No** |

## Stage 1 (only stage)

Add 3 tests to `packages/llm/tests/DraftModelParser.test.ts` in the
existing `equality` describe block:

1. "skips equality with missing superset_roles"
2. "skips equality when superset fact type not found"
3. "skips equality with unresolvable roles"

Each mirrors the structure of its corresponding subset test.

### Success criteria

- `npx vitest run` in packages/llm passes (170 + 3 = 173 tests)
- No lint errors

### Status: Not Started
