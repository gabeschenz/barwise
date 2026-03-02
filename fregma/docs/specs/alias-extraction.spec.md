# FREGMA-d4y: Extract Aliases/Synonyms from Transcripts

## Goal

Teach the LLM extraction pipeline to identify when stakeholders use
different names for the same concept and record them as aliases on the
object type, rather than flagging as ambiguities. Display aliases on
diagram entity nodes so they are visible at a glance.

## Design

### Part A: LLM Extraction (COMPLETE -- PR #65)

1. **ExtractionTypes.ts**: Add `aliases?: readonly string[]` to
   `ExtractedObjectType`
2. **ExtractionPrompt.ts**: Add alias guidance to system prompt and
   `aliases` field to response schema object_types items
3. **DraftModelParser.ts**: Pass extracted aliases through to
   `model.addObjectType()`
4. **Tests**: Parser tests for alias pass-through, prompt schema test

### Part B: Diagram Alias Rendering

Display aliases below the entity name and reference mode on diagram
nodes. Format: `(a.k.a. 'Client', 'Buyer')` in a smaller, muted font.

#### What changes

1. **GraphTypes.ts**: Add `aliases?: readonly string[]` to
   `ObjectTypeNode`
2. **ModelToGraph.ts**: Pass `ot.aliases` into the ObjectTypeNode
3. **LayoutTypes.ts**: Add `aliases?: readonly string[]` to
   `PositionedObjectTypeNode`
4. **ElkLayoutEngine.ts**: Pass aliases through in `extractPositions`;
   widen node when aliases are present (alias text may be wider than
   the entity name)
5. **theme.ts**: Add `FONT_SIZE_ALIAS` (9) and `COLOR_ALIAS` constants
6. **SvgRenderer.ts**: Render alias line below name/reference-mode as
   italic text: `(a.k.a. 'Client', 'Buyer')`

#### Rendering rules

- Only render the alias line when `aliases` is non-empty
- Use `a.k.a.` prefix, each alias single-quoted, comma-separated
- Font size: `FONT_SIZE_ALIAS` (9px), same as annotation font
- Color: `COLOR_ALIAS` (muted, same as ref-mode color)
- Style: italic
- Vertical positioning: below the reference mode line (or below the
  name if no reference mode)
- Node height: increase `OT_HEIGHT` to accommodate alias line when
  present (pass computed height to ELK)
- Node width: `max(name width, alias text width)` with padding

### What does NOT change

All downstream infrastructure is already in place:
- OrmModel.addObjectType() accepts aliases
- YAML serialization round-trips aliases
- JSON schema validates aliases
- Diff engine compares aliases (order-insensitive)
- Merge engine unions aliases

## Stages

### Stage 1: LLM Extraction -- COMPLETE

- ExtractionTypes.ts: add `aliases` to ExtractedObjectType
- ExtractionPrompt.ts: add alias extraction guidance to system prompt,
  add `aliases` array to object_types schema
- DraftModelParser.ts: pass `ext.aliases` to addObjectType()
- Tests: DraftModelParser + ExtractionPrompt tests

### Stage 2: Diagram Types and Graph Conversion (TDD)

**Tests first:**
- ModelToGraph.test.ts: entity type node includes aliases when present
- ModelToGraph.test.ts: entity type node omits aliases when not set

**Implementation:**
- GraphTypes.ts: add `aliases` to ObjectTypeNode
- LayoutTypes.ts: add `aliases` to PositionedObjectTypeNode
- ModelToGraph.ts: pass `ot.aliases` into the node

### Stage 3: Layout Engine (TDD)

**Tests first:**
- ElkLayoutEngine.test.ts: node with aliases gets wider width estimate
- ElkLayoutEngine.test.ts: node with aliases gets taller height
- ElkLayoutEngine.test.ts: aliases pass through positioned node

**Implementation:**
- ElkLayoutEngine.ts: compute label width including alias text;
  increase height by alias line offset when aliases present;
  pass aliases through in extractPositions

### Stage 4: SVG Rendering (TDD)

**Tests first:**
- SvgRenderer.test.ts: renders alias text below entity name
- SvgRenderer.test.ts: alias text uses correct format (a.k.a. ...)
- SvgRenderer.test.ts: escapes special characters in aliases
- SvgRenderer.test.ts: omits alias line when aliases not present
- SvgRenderer.test.ts: omits alias line for value types (optional)

**Implementation:**
- theme.ts: add FONT_SIZE_ALIAS, COLOR_ALIAS
- SvgRenderer.ts: render alias text element in renderObjectType()

### Stage 5: Build, lint, test, commit, push, PR

## Success Criteria

- All diagram tests pass (ModelToGraph, ElkLayout, SvgRenderer)
- Full monorepo build passes (1,183+ tests)
- No lint errors
- Aliases visible on diagram entity nodes with correct formatting
- Nodes without aliases render identically to before
