# CLAUDE.md

## Project: Barwise

An ORM 2 (Object-Role Modeling) toolkit for data engineers and
architects. Includes a VS Code extension, CLI tool, and MCP server.
Named after Jon Barwise, whose work on situation semantics
provides the theoretical foundation for fact-based modeling.

## Essential Context

Read `barwise/docs/ARCHITECTURE.md` before making any changes. It
contains the full system design, metamodel specification, and phasing
plan.

## Package-Specific Instructions

Each package has its own CLAUDE.md with dependency rules, layout,
commands, and testing conventions. Read the relevant file before
working in a package:

- `barwise/packages/core/CLAUDE.md` -- metamodel, validation, verbalization, serialization, mapping
- `barwise/packages/diagram/CLAUDE.md` -- diagram layout and SVG rendering
- `barwise/packages/llm/CLAUDE.md` -- LLM transcript extraction
- `barwise/packages/cli/CLAUDE.md` -- CLI tool (validate, verbalize, schema, export, diagram, diff, import)
- `barwise/packages/mcp/CLAUDE.md` -- MCP server (tools, resources, prompts)
- `barwise/packages/vscode/CLAUDE.md` -- VS Code extension integration
- `AGENTS.md` -- General guidance on development practices.

## Dependency Graph

```
@barwise/core          (no internal deps)
  ^
  |--- @barwise/diagram  (core)
  |--- @barwise/llm      (core)
  |--- @barwise/cli      (core, diagram, llm)
  |--- @barwise/mcp      (core, diagram, llm)
  |--- barwise-vscode     (core, diagram, llm, mcp)
```

Changes to `@barwise/core` can break all downstream packages. Run the
full monorepo build and tests after modifying core's public API.

## Current State

All phases are complete. The project has 1,580 passing tests across 6
packages. The CLI tool (`barwise`) and MCP server (`barwise-mcp`) provide
the same capabilities as the VS Code extension for terminal and AI
workflows. Import and export formats (DDL, OpenAPI) are managed through
a unified format registry (`FormatDescriptor` in `core/src/format/`).
NORMA XML import is functional with data type resolution, preferred
identifier support, external uniqueness constraints, and role-level
value constraints.

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

11. LLM transcript processing (@barwise/llm) -- DONE
12. Diagram visualization (@barwise/diagram) -- DONE
13. VS Code extension (LSP, commands, webview) -- DONE

### Phase 4 -- COMPLETE

14. LLM provider expansion (OpenAI, Ollama, factory) -- DONE
15. CLI tool (@barwise/cli) -- DONE
16. MCP server (@barwise/mcp) -- DONE

### Remaining Work

No major items remain. All phases, naming audit, and NORMA XML
enhancements are complete.

## Monorepo Commands (run from `barwise/`)

- `npm run build` -- build all packages (Turborepo, respects dependency order)
- `npm run test` -- test all packages
- `npm run lint` -- lint all packages (ESLint)
- `cd packages/core && npx vitest run` -- run core tests only
- `cd packages/core && npx vitest run --coverage` -- core tests with coverage
- `cd packages/core && npx tsc --noEmit` -- type-check core

## Conventions (Monorepo-Wide)

- ALWAYS create a spec file before beginning development.  There should
  be a documented and reviewed plan to ensure the quality of work is high.
- TypeScript strict mode. Base config in `barwise/tsconfig.base.json`
  uses NodeNext module resolution; the vscode package overrides to
  Bundler resolution for esbuild.
- Vitest for all test packages. Tests co-located under `tests/`
  mirroring `src/` structure.
- No emoji in output or documentation.
- No trivial dependencies: never add a package for something provided
  by JavaScript or Node core (e.g. use `node:crypto.randomUUID()` not
  `uuid`). High-quality libraries that solve real problems (yaml, ajv)
  are fine.
- ESLint config is shared at the repo root (`barwise/eslint.config.mjs`).
- Turborepo (`barwise/turbo.json`) orchestrates build/test/lint with
  correct dependency ordering.
