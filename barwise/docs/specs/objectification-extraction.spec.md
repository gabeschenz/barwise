# BARWISE-nsn: Extract Objectified Fact Types from Transcripts

## Goal

Add objectification support to the LLM extraction pipeline. The core
metamodel already supports ObjectifiedFactType (class, serialization,
mapping, verbalization, validation). The LLM pipeline currently has no
awareness of objectification.

## Stages

### Stage 1: Types and prompt

- ExtractionTypes.ts: add ExtractedObjectifiedFactType,
  ObjectificationProvenance, extend ExtractionResponse and
  DraftModelResult
- ExtractionPrompt.ts: add objectification to system prompt, response
  schema, and parseExtractionResponse
- index.ts: export new types

### Stage 2: Parser

- DraftModelParser.ts: add Pass 5 after subtypes
  - Resolve fact type and object type by name
  - Validate object type is entity kind
  - Call model.addObjectifiedFactType()
  - Track provenance with skip reasons

### Stage 3: Tests

- DraftModelParser.test.ts: ~6 tests covering success, skip paths
- ExtractionPrompt.test.ts: verify schema includes objectified_fact_types

### Stage 4: Build, lint, test, commit, push, PR

## Success Criteria

- All llm tests pass (170 existing + new)
- Full monorepo build passes
- No lint errors
