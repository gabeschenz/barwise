# @fregma/cli

Command-line tool for ORM 2 modeling. Wraps the platform-independent
packages (`@fregma/core`, `@fregma/diagram`, `@fregma/llm`) into a
`fregma` CLI binary.

## Dependency Rule

This package depends on `@fregma/core`, `@fregma/diagram`,
`@fregma/llm`, and `commander`. It has ZERO dependencies on VS Code.

## Package Layout

```
src/
  index.ts              Main entry point (bin shebang)
  cli.ts                Commander program definition
  commands/
    validate.ts         fregma validate <file>
    verbalize.ts        fregma verbalize <file>
    schema.ts           fregma schema <file>
    export.ts           fregma export yaml|json|dbt <file>
    diagram.ts          fregma diagram <file>
    diff.ts             fregma diff <file1> <file2>
    import.ts           fregma import transcript <file>
  helpers/
    io.ts               File I/O helpers (loadModel, writeModel)
    format.ts           Output formatting helpers (JSON, text)
tests/
  cli.test.ts           Scaffolding tests
  commands/             Command-specific tests
  fixtures/             .orm.yaml test files
```

## Commands

```sh
npx vitest run              # run tests
npx tsc --noEmit            # type-check only
```

## Key Conventions

- Each command is a separate module that registers itself on a
  Commander program.
- Commands read `.orm.yaml` files via the shared `loadModel()` helper.
- Output goes to stdout by default. `--output` writes to a file.
- `--format json` is available on most commands for machine-readable
  output.
- Exit code 1 for validation errors or failures; 0 for success.

## Dependencies

| Direction | Package | What is used |
|-----------|---------|--------------|
| Upstream  | `@fregma/core` | Model, validation, verbalization, mapping, diff, serialization |
| Upstream  | `@fregma/diagram` | `generateDiagram` for SVG output |
| Upstream  | `@fregma/llm` | `processTranscript`, `createLlmClient`, provider factory |
