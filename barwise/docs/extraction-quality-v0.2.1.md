# Extraction Quality Assessment -- Barwise v0.2.1

Date: 2026-03-01
Barwise version: 0.2.1
Transcripts: clinic-appointments, order-management, university-enrollment
Models compared: GPT-5 Mini vs GPT-5.3 Codex (via GitHub Copilot)
Baseline comparison: v0.2.0 (see extraction-quality-v0.2.0.md)

## Summary

The v0.2.1 prompt improvements dramatically narrowed the gap between
GPT-5 Mini and GPT-5.3 Codex. Mini's three worst deficits from v0.2.0
(missing identifier fact types, fabricated reference modes, weak n-ary
modeling) are largely resolved. Codex's weakness (missing data type
lengths) is also fixed.

The remaining gap is concentrated on two specific issues:
1. Inconsistent `is_preferred: true` on identifier fact types (Mini)
2. Missing mandatory constraints on identifier entity roles (Mini)

## Scoring

| Dimension             | v0.2.0 Mini | v0.2.1 Mini | v0.2.0 Codex | v0.2.1 Codex |
|-----------------------|-------------|-------------|--------------|--------------|
| Identifier fact types | Poor (0/3/3)| Good (4/3/4)| Good         | Good         |
| is_preferred flag     | N/A         | Poor (1-2/4)| Good         | Good         |
| Mandatory on IDs      | N/A         | Poor (0-1)  | Good         | Good         |
| Constraint coverage   | Poor        | Good        | Good         | Good         |
| N-ary fact types      | Poor        | Fair        | Good         | Good         |
| Data type lengths     | Good        | Good        | Poor         | Good (fixed) |
| Reference mode quality| Poor        | Good (fixed)| Good         | Good         |
| Ambiguity detection   | Good        | Good        | Good         | Good         |
| No spurious elements  | Good        | Fair        | Good         | Good         |

## Impact of v0.2.1 Prompt Changes

### What improved (Mini)

1. **Identifier fact types**: Clinic went from 0 to 4 identifier fact
   types. University went from 3 to 4 (added Term). All transcripts
   now have identifier fact types for every entity with a reference_mode.

2. **Fabricated reference modes eliminated**: Order Management no longer
   has `auto_counter (generated OrderLineId)`. University no longer has
   `CourseCode + TermCode (composite)`. Both use simple names or flag
   ambiguity.

3. **N-ary modeling**: Order Management now uses a ternary
   Order-Product-Quantity instead of an explicit OrderLine entity.

4. **Skipped constraints**: Clinic dropped from 11 to 1 (the remaining
   one is a role-level value constraint, a known system limitation).

### What improved (Codex)

1. **Data type lengths**: All text fields now include length values.
   This was Codex's only deficit at v0.2.0 and is now resolved.

### What did NOT improve

1. **is_preferred: true**: Mini marks only 1-2 of 3-4 identifier fact
   types with `is_preferred`. Codex marks all of them. Without this
   flag, the relational mapper cannot determine primary keys.

2. **Mandatory on identifier entity roles**: Codex adds mandatory
   constraints on every identifier entity role (e.g., "every Patient
   has a MedicalRecordNumber"). Mini omits these entirely.

3. **Composite scheduling constraints**: Mini still models clinic
   appointment scheduling as separate binary fact types rather than a
   single higher-arity fact type. The ternary guidance helped for
   simpler cases (order-product-quantity) but not for 5-ary scheduling.

4. **Spurious fact types**: Mini occasionally emits redundant fact
   types (e.g., "Course has CourseTitleAndCredits" duplicating separate
   Course-Title and Course-Credits binaries).

## Transcript 1: Clinic Appointments

### GPT-5 Mini (v0.2.1)

- 13 object types, 14 fact types
- 4 identifier fact types (Patient, Doctor, Appointment, ExamRoom)
- is_preferred on 1 of 4 (Appointment only)
- Mandatory on identifier entity roles: 0
- 1 skipped constraint (role-level value constraint)
- Ternary: Doctor-ExamRoom-Date present
- Scheduling constraints: separate binaries (no cross-entity rules)

### GPT-5.3 Codex (v0.2.1)

- 13 object types, 12 fact types
- 4 identifier fact types with is_preferred on all 4
- Mandatory on all 4 identifier entity roles
- 3 skipped constraints (role-level value constraints)
- 5-ary scheduling fact type with 3 uniqueness constraints
- Ternary Doctor-ExamRoom-Date with dual uniqueness

### Changes from v0.2.0

| Metric | v0.2.0 Mini | v0.2.1 Mini | Delta |
|--------|-------------|-------------|-------|
| Identifier fact types | 0 | 4 | +4 |
| Skipped constraints | 11 | 1 | -10 |
| Total constraints | 4 | ~8 | +4 |

## Transcript 2: Order Management

### GPT-5 Mini (v0.2.1)

- 9 object types, 7 fact types
- 3 identifier fact types (Customer, Order, Product)
- is_preferred: 2 (one misplaced on Customer-places-Order)
- Mandatory on identifier entity roles: 1 (Order only)
- 1 ternary (Order-Product-Quantity) -- correct
- No fabricated reference modes (OrderLine eliminated)

### GPT-5.3 Codex (v0.2.1)

- 9 object types, 8 fact types
- 3 identifier fact types with is_preferred on all 3
- Mandatory on all 3 identifier entity roles
- 1 ternary (Order-Product-Quantity) -- correct
- Customer has CustomerName with mandatory

### Changes from v0.2.0

| Metric | v0.2.0 Mini | v0.2.1 Mini | Delta |
|--------|-------------|-------------|-------|
| Fabricated ref modes | 1 (auto_counter) | 0 | Fixed |
| OrderLine entity | Yes (over-modeled) | No (ternary) | Fixed |
| is_preferred misplaced | 0 | 1 | Regression |

## Transcript 3: University Enrollment

### GPT-5 Mini (v0.2.1)

- 15 object types, 15 fact types
- 4 identifier fact types (Student, Course, Term, Instructor)
- is_preferred on 1 of 4 (Course only)
- Mandatory on identifier entity roles: 0
- 1 ternary (Student-Grade-CourseOffering) -- correct
- 1 spurious 3-ary (Course-Title-Credits, duplicates binaries)
- CourseOffering: flagged as ambiguity + simple ref mode

### GPT-5.3 Codex (v0.2.1)

- 15 object types, 16 fact types
- 5 identifier fact types with is_preferred on 4 of 5
- Mandatory on 4 identifier entity roles
- 1 ternary (Student-LetterGrade-CourseOffering) -- correct
- CourseOffering: flagged as ambiguity + simple ref mode

### Changes from v0.2.0

| Metric | v0.2.0 Mini | v0.2.1 Mini | Delta |
|--------|-------------|-------------|-------|
| Composite ref mode | Yes | No | Fixed |
| Identifier fact types | 3 | 4 | +1 (Term) |
| Spurious conflated FT | 1 (Term-TermCode) | 1 (Title-Credits) | Changed |

## Root Causes of Remaining Gaps

1. **is_preferred inconsistency**: The v0.2.1 prompt mentions
   `is_preferred: true` in the inferred_constraints section but does
   not repeat it emphatically in the Critical Rules or the identifier
   fact type mandate. Mini follows the mandate to emit the fact type
   but applies `is_preferred` only sometimes.

2. **Missing mandatory on identifiers**: The v0.2.1 prompt describes
   mandatory constraints generally but does not specifically instruct
   that every identifier entity role needs a mandatory constraint.

3. **Misplaced is_preferred**: Mini occasionally puts `is_preferred`
   on non-identifier fact types (e.g., Customer-places-Order), which
   is semantically incorrect.

4. **Spurious/duplicate fact types**: No explicit rule against
   duplicating information already captured by other fact types.

## Prompt Improvements Applied (v0.2.2)

1. Added explicit CRITICAL section for identifier constraints:
   "Every identifier fact type MUST have three constraints: (a)
   internal_uniqueness on entity role with is_preferred: true,
   (b) internal_uniqueness on value role, (c) mandatory on entity
   role." Repeated in both the instructions and Critical Rules.

2. Strengthened composite scheduling guidance with explicit examples
   of higher-arity fact types with multiple uniqueness constraints.

3. Added Critical Rules: "NEVER emit a fact type that duplicates
   information already captured by other fact types" and "Do NOT
   place is_preferred on non-identifier fact types."

## Re-test Plan

After merging v0.2.2 prompt improvements, re-extract all three
transcripts and compare:

- is_preferred coverage (target: all identifier fact types)
- Mandatory on identifier entity roles (target: all)
- No misplaced is_preferred on non-identifier fact types
- No spurious/duplicate fact types
- Composite scheduling modeling for clinic appointments
