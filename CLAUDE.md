# CLAUDE.md

## Project: Fregma

An ORM 2 (Object-Role Modeling) toolkit for data engineers and
architects. Includes a VS Code extension, CLI tool, and MCP server.
Named after Frege + Schema.

## Essential Context

Read `fregma/docs/ARCHITECTURE.md` before making any changes. It
contains the full system design, metamodel specification, and phasing
plan.

## Package-Specific Instructions

Each package has its own CLAUDE.md with dependency rules, layout,
commands, and testing conventions. Read the relevant file before
working in a package:

- `fregma/packages/core/CLAUDE.md` -- metamodel, validation, verbalization, serialization, mapping
- `fregma/packages/diagram/CLAUDE.md` -- diagram layout and SVG rendering
- `fregma/packages/llm/CLAUDE.md` -- LLM transcript extraction
- `fregma/packages/cli/CLAUDE.md` -- CLI tool (validate, verbalize, schema, export, diagram, diff, import)
- `fregma/packages/mcp/CLAUDE.md` -- MCP server (tools, resources, prompts)
- `fregma/packages/vscode/CLAUDE.md` -- VS Code extension integration
- `AGENTS.md` -- General guidance on development practices.

## Dependency Graph

```
@fregma/core          (no internal deps)
  ^
  |--- @fregma/diagram  (core)
  |--- @fregma/llm      (core)
  |--- @fregma/cli      (core, diagram, llm)
  |--- @fregma/mcp      (core, diagram, llm)
  |--- fregma-vscode     (core, diagram, llm, mcp)
```

Changes to `@fregma/core` can break all downstream packages. Run the
full monorepo build and tests after modifying core's public API.

## Current State

All phases are complete. The project has 1,315 passing tests across 6
packages. The CLI tool (`fregma`) and MCP server (`fregma-mcp`) provide
the same capabilities as the VS Code extension for terminal and AI
workflows. The VS Code extension is functional but lacks integration
tests. NORMA XML import is functional with data type resolution and
preferred identifier support.

## Milestones

### Phase 1 -- COMPLETE

1. Project scaffolding and metamodel types -- DONE
2. Phase 1 constraints -- DONE (integrated into metamodel)
3. JSON Schema and YAML serialization (round-trip .orm.yaml files) -- DONE
4. Validation engine with structural rules -- DONE
5. Verbalization engine (fact types and Phase 1 constraints) -- DONE

### Phase 2 -- COMPLETE

6. Phase 2 constraints (exclusion, ring, frequency, subset, equality, etc.) -- DONE
7. Subtype relationships (SubtypeFact) -- DONE
8. Multi-file models and context mapping -- DONE
9. Relational mapping (Rmap) and DDL rendering -- DONE
10. Model diffing and merging -- DONE

### Phase 3 -- COMPLETE

11. LLM transcript processing (@fregma/llm) -- DONE
12. Diagram visualization (@fregma/diagram) -- DONE
13. VS Code extension (LSP, commands, webview) -- DONE

### Phase 4 -- COMPLETE

14. LLM provider expansion (OpenAI, Ollama, factory) -- DONE
15. CLI tool (@fregma/cli) -- DONE
16. MCP server (@fregma/mcp) -- DONE

### Remaining Work

- VS Code integration tests (packages/vscode/tests/ is empty) -- HIGH
- NORMA XML import enhancements (role-level value constraints, external uniqueness import) -- LOW
- Internal naming audit for semantic precision (FREGMA-93q) -- LOW

## Monorepo Commands (run from `fregma/`)

- `npm run build` -- build all packages (Turborepo, respects dependency order)
- `npm run test` -- test all packages
- `npm run lint` -- lint all packages (ESLint)
- `cd packages/core && npx vitest run` -- run core tests only
- `cd packages/core && npx vitest run --coverage` -- core tests with coverage
- `cd packages/core && npx tsc --noEmit` -- type-check core

## Conventions (Monorepo-Wide)

- ALWAYS create a spec file before beginning development.  There should
  be a documented and reviewed plan to ensure the quality of work is high.
- TypeScript strict mode. Base config in `fregma/tsconfig.base.json`
  uses NodeNext module resolution; the vscode package overrides to
  Bundler resolution for esbuild.
- Vitest for all test packages. Tests co-located under `tests/`
  mirroring `src/` structure.
- No emoji in output or documentation.
- No trivial dependencies: never add a package for something provided
  by JavaScript or Node core (e.g. use `node:crypto.randomUUID()` not
  `uuid`). High-quality libraries that solve real problems (yaml, ajv)
  are fine.
- ESLint config is shared at the repo root (`fregma/eslint.config.mjs`).
- Turborepo (`fregma/turbo.json`) orchestrates build/test/lint with
  correct dependency ordering.
