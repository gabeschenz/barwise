# CLAUDE.md

## Project: Fregma

An ORM 2 (Object-Role Modeling) VS Code extension for data engineers
and architects. Named after Frege + Schema.

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
- `fregma/packages/vscode/CLAUDE.md` -- VS Code extension integration

## Dependency Graph

```
@fregma/core          (no internal deps)
  ^
  |--- @fregma/diagram  (core)
  |--- @fregma/llm      (core)
  |--- fregma-vscode     (core, diagram, llm)
```

Changes to `@fregma/core` can break all downstream packages. Run the
full monorepo build and tests after modifying core's public API.

## Current State

Milestone 1 (project scaffold and metamodel types) is in progress.
The core metamodel classes are implemented in `fregma/packages/core/src/model/`.
Tests are in `fregma/packages/core/tests/`.

## Milestones (Phase 1)

1. Project scaffolding and metamodel types -- DONE
2. Phase 1 constraints -- DONE (integrated into metamodel)
3. JSON Schema and YAML serialization (round-trip .orm.yaml files)
4. Validation engine with structural rules
5. Verbalization engine (fact types and Phase 1 constraints)

## Monorepo Commands (run from `fregma/`)

- `npm run build` -- build all packages (Turborepo, respects dependency order)
- `npm run test` -- test all packages
- `npm run lint` -- lint all packages (ESLint)
- `cd packages/core && npx vitest run` -- run core tests only
- `cd packages/core && npx vitest run --coverage` -- core tests with coverage
- `cd packages/core && npx tsc --noEmit` -- type-check core

## Conventions (Monorepo-Wide)

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
