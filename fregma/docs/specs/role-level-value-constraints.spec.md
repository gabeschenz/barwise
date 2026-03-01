# FREGMA-bbb: Extract role-level value constraints from transcripts

## Problem

DraftModelParser currently skips role-level value constraints with the
message "Role-level value constraints from transcripts are not yet
supported." These are value restrictions on a role within a fact type
(as opposed to on the value type itself), e.g. "in the context of
grading, only grades A-F are allowed."

The core model already supports role-level value constraints via the
`roleId` field on `ValueConstraint`. The serializer and JSON schema
are also ready. The gap is entirely in the LLM extraction pipeline
(`@fregma/llm`).

Current behavior: LLMs extract value constraints and emit them as
`inferred_constraints` with `type: "value_constraint"`, but:
1. The `InferredConstraint` type has no `values` field to carry the
   enumerated values.
2. The response schema in `ExtractionPrompt.ts` does not include a
   `values` field in the inferred_constraints schema.
3. `DraftModelParser.ts` unconditionally skips all `value_constraint`
   entries in `inferred_constraints`.

As a result, extracted role-level VCs produce `TODO(fregma): Skipped
constraint` annotations in the output YAML, requiring manual fix-up.

## Solution

Extend the extraction pipeline to carry and apply role-level value
constraints end-to-end.

### Layer changes

**ExtractionTypes.ts** -- Add `values?: readonly string[]` to
`InferredConstraint`. Required when `type === "value_constraint"`,
ignored for other constraint types.

**ExtractionPrompt.ts** -- Add `values` array to the
`inferred_constraints` response schema so the LLM can emit enumerated
values for role-level VCs. Update prompt instructions to explain when
to use role-level VCs vs object-type level VCs.

**DraftModelParser.ts** -- Replace the skip logic with:
1. Validate `ic.values` is present and non-empty.
2. Resolve the fact type by name (already done by existing code).
3. Resolve the role by player name using `resolveRolesByPlayerName`.
4. Require exactly one role (value constraints apply to a single role).
5. Create a `{ type: "value_constraint", roleId, values }` constraint.
6. Check for duplicate value constraints on the same role.
7. Add to the fact type and record provenance as `applied: true`.

**isDuplicateConstraint** -- Add a value_constraint branch: duplicate
if same roleId and same values set.

### Prompt guidance

Add to the system prompt's constraint section:
- For `value_constraint` in `inferred_constraints`, the `roles` array
  identifies the constrained role (by player name), and the `values`
  array lists the allowed values.
- Use role-level VCs when the constraint is specific to the role's
  context within the fact type. Use object-type level VCs (on the
  value type itself) when the constraint applies universally.

## Test plan

- Update existing "skips value_constraint" test to verify application.
- Add tests for:
  - Successful application of role-level VC with resolved role.
  - Missing `values` array (should skip with reason).
  - Empty `values` array (should skip with reason).
  - Unresolvable role (should skip with reason).
  - Multiple roles specified (should skip -- VC applies to one role).
  - Duplicate value constraint detection.
- Full monorepo build, lint, and test suite.

## Success criteria

- Role-level value constraints appear in output YAML with `role` and
  `values` fields instead of TODO comments.
- Existing object-type level value constraints continue to work.
- All existing tests pass.
