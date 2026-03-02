# FREGMA-d4y: Extract Aliases/Synonyms from Transcripts

## Goal

Teach the LLM extraction pipeline to identify when stakeholders use
different names for the same concept and record them as aliases on the
object type, rather than flagging as ambiguities.

## Design

### What changes

1. **ExtractionTypes.ts**: Add `aliases?: readonly string[]` to
   `ExtractedObjectType`
2. **ExtractionPrompt.ts**: Add alias guidance to system prompt and
   `aliases` field to response schema object_types items
3. **DraftModelParser.ts**: Pass extracted aliases through to
   `model.addObjectType()`
4. **Tests**: Parser tests for alias pass-through, prompt schema test

### What does NOT change

All downstream infrastructure is already in place:
- OrmModel.addObjectType() accepts aliases
- YAML serialization round-trips aliases
- JSON schema validates aliases
- Diff engine compares aliases (order-insensitive)
- Merge engine unions aliases

## Stages

### Stage 1: Types, prompt, parser

- ExtractionTypes.ts: add `aliases` to ExtractedObjectType
- ExtractionPrompt.ts: add alias extraction guidance to system prompt,
  add `aliases` array to object_types schema
- DraftModelParser.ts: pass `ext.aliases` to addObjectType()

### Stage 2: Tests

- DraftModelParser.test.ts: aliases pass through to model
- ExtractionPrompt.test.ts: schema includes aliases field

### Stage 3: Build, lint, test, commit, push, PR

## Success Criteria

- All LLM tests pass
- Full monorepo build passes
- No lint errors
