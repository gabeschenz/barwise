# Extraction Quality Assessment -- Fregma v0.2.0

Date: 2026-03-01
Fregma version: 0.2.0
Transcripts: clinic-appointments, order-management, university-enrollment
Models compared: GPT-5 Mini vs GPT-5.3 Codex (via GitHub Copilot)

## Summary

GPT-5.3 Codex produces structurally superior ORM models on all three
transcripts. The primary advantage is consistent emission of identifier
fact types with proper constraints, which GPT-5 Mini frequently omits.
GPT-5 Mini has a minor advantage in data type specificity (includes
text lengths where Codex omits them).

## Scoring

| Dimension             | GPT-5 Mini | GPT-5.3 Codex | Notes |
|-----------------------|------------|---------------|-------|
| Identifier fact types | Poor       | Good          | Mini omits them; Codex emits with is_preferred |
| Constraint coverage   | Poor       | Good          | Mini skips 11/5/5 constraints; Codex skips 2/1/1 |
| N-ary fact types      | Poor       | Good          | Codex models scheduling and composite rules correctly |
| Data type lengths     | Good       | Poor          | Mini specifies lengths; Codex omits most |
| Reference mode quality| Poor       | Good          | Mini fabricates composites and auto_counters |
| Ambiguity detection   | Good       | Good          | Both flag relevant ambiguities |
| Definitions           | Good       | Good          | Both produce useful definitions |

## Transcript 1: Clinic Appointments

### GPT-5 Mini

- 13 object types, 9 fact types
- 0 identifier fact types (Patient/Doctor/Appointment/ExamRoom identifiers not modeled)
- 11 skipped constraints (all reference fact types not found)
- 4 mandatory constraints applied
- Data type lengths specified (text(20), text(5), text(255), etc.)
- Ternary: Doctor-ExamRoom-Date (no constraints applied)
- Missing: patient/doctor no-double-booking rules (only TODOs)

### GPT-5.3 Codex

- 13 object types, 16 fact types
- 4 identifier fact types with is_preferred:true, bijection, mandatory
- 2 skipped constraints (role-level value constraints -- known limitation)
- 19 constraints applied (4 mandatory + 12 uniqueness + 3 mandatory on IDs)
- Data type lengths mostly omitted
- Two 4-ary fact types for no-double-booking (Patient-Date-TimeSlot, Doctor-Date-TimeSlot)
- Ternary Doctor-ExamRoom-Date with two separate uniqueness constraints
- Better naming: AppointmentDate, VisitReason (domain-specific)

### Key Differences

1. Codex emits 4 explicit identifier fact types; Mini emits 0.
2. Codex models scheduling constraints as quaternary fact types; Mini leaves them as TODOs.
3. Codex applies 19 constraints vs Mini's 4.
4. Mini has better data type lengths.

## Transcript 2: Order Management

### GPT-5 Mini

- 10 object types (includes OrderLine entity)
- 10 fact types, 3 identifier fact types ("X identified by Y" pattern)
- OrderLine modeled as explicit entity with auto_counter reference mode
- 1 skipped constraint
- Separate fact types: Order has OrderLine, OrderLine specifies Product, OrderLine has Quantity

### GPT-5.3 Codex

- 8 object types (no OrderLine)
- 8 fact types, 3 identifier fact types ("X has Y" pattern)
- Order-Product-Quantity modeled as ternary with composite uniqueness
- 1 skipped constraint
- More idiomatic ORM: ternary captures the functional dependency directly

### Key Differences

1. Both emit identifier fact types (comparable quality here).
2. Mini fabricates `auto_counter (generated OrderLineId)` -- invalid ORM.
3. Codex's ternary is more faithful to the transcript's semantics.
4. Both correctly flag customer/client ambiguity.

## Transcript 3: University Enrollment

### GPT-5 Mini

- 14 object types, 14 fact types
- 3 identifier fact types (Course, Instructor, Student)
- Missing: Term has TermCode (2 skipped constraints)
- 5 total skipped constraints
- Spurious fact type: "CourseOffering is in Term with TermCode" (conflates Term identity with CourseOffering)
- Fabricated reference mode: "CourseCode + TermCode (composite)" -- invalid ORM

### GPT-5.3 Codex

- 14 object types, 14 fact types
- 5 identifier fact types (Course, Instructor, Student, Term, CourseOffering)
- Term has TermCode present with full identifier constraints
- 1 skipped constraint (role-level value constraint)
- Mandatory on Course has CourseTitle, Course has CreditValue (correct per transcript)
- Clean reference modes throughout

### Key Differences

1. Codex emits 5 identifier fact types vs Mini's 3.
2. Mini has a spurious conflated fact type; Codex's structure is clean.
3. Mini fabricates a composite reference mode; Codex flags it as ambiguity.
4. Codex applies mandatory constraints where transcript implies required properties.

## Root Causes of GPT-5 Mini Deficits

1. **Missing identifier fact types**: The v0.2.0 prompt mentions identifier
   constraints but does not mandate emitting the fact type itself. Mini skips
   the fact type and then its constraints are orphaned.

2. **Weak n-ary modeling**: Mini defaults to binary fact types and leaves
   multi-role constraints as prose TODOs rather than modeling them as
   ternary/quaternary fact types.

3. **Fabricated reference modes**: Mini invents composite and auto_counter
   reference modes when identification is unclear, rather than flagging
   ambiguity.

4. **Missing text lengths (Codex)**: Codex omits data type lengths on most
   text fields, producing less complete schemas for DDL generation.

## Prompt Improvements Applied (v0.3.0)

The following changes were made to ExtractionPrompt.ts to address
these findings:

1. **FREGMA-pcj**: Added explicit mandate in the fact types section:
   "For EVERY entity type that has a reference_mode, you MUST emit a
   binary fact type linking the entity to its identifying value type."
   Also added to Critical Rules: "EVERY entity type with a reference_mode
   MUST have a corresponding identifier fact type in the fact_types array."

2. **FREGMA-h9q**: Added ternary/n-ary guidance in the fact types section
   with concrete examples (scheduling rules, order-product-quantity).

3. **FREGMA-cma**: Changed data type instruction from "Include length
   for text" to "ALWAYS include length for text types" with inferred
   length guidelines (codes 10-20, names 100-200, free text 500).

4. **FREGMA-afb**: Added to reference_mode instructions: "NEVER a
   composite or fabricated scheme." Added to Critical Rules: "NEVER use
   composite or fabricated reference_modes."

## Re-test Plan

After merging the prompt improvements, re-extract all three transcripts
using the same two models (GPT-5 Mini, GPT-5.3 Codex) and compare:

- Number of identifier fact types emitted
- Number of skipped constraints
- Presence of ternary fact types for scheduling/composite rules
- Data type length coverage
- Reference mode validity
- Overall constraint coverage

Save outputs with version suffix (e.g., clinic-appointments-gpt5mini-v030.orm.yaml)
for side-by-side comparison with this baseline.
