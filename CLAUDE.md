# CLAUDE.md
## Project: Fregma
An ORM 2 (Object-Role Modeling) VS Code extension for data engineers
and architects. Named after Frege + Schema.
## Essential Context
Read `docs/ARCHITECTURE.md` before making any changes. It contains
the full system design, metamodel specification, and phasing plan.
## Current State
Milestone 1 (project scaffold and metamodel types) is in progress.
The core metamodel classes are implemented in `packages/core/src/model/`.
Tests are in `packages/core/tests/`.
## Milestones (Phase 1)
1. Project scaffolding and metamodel types -- DONE
2. Phase 1 constraints -- DONE (integrated into metamodel)
3. JSON Schema and YAML serialization (round-trip .orm.yaml files)
4. Validation engine with structural rules
5. Verbalization engine (fact types and Phase 1 constraints)
## Commands
- `cd packages/core && npx vitest run` -- run tests
- `cd packages/core && npx tsc --noEmit` -- type-check
## Conventions
- Core package has ZERO dependencies on VS Code
- All model logic is testable without launching an editor
- Use Vitest for tests, co-located under tests/ mirrors of src/
- ModelBuilder (tests/helpers/ModelBuilder.ts) for constructing test fixtures
- No emoji in output or documentation
- TypeScript strict mode, NodeNext module resolution
- No trivial dependencies: never add a package for something provided by
  JavaScript or Node core (e.g. use node:crypto.randomUUID() not uuid).
  High-quality libraries that solve real problems (yaml, ajv) are fine.
