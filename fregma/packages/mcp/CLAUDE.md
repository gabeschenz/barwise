# @fregma/mcp

MCP (Model Context Protocol) server that exposes fregma ORM 2
modeling capabilities as tools, resources, and prompts. Any AI tool
that speaks MCP (Claude Code, Claude Desktop, opencode, Cursor,
Windsurf, Zed, Cline, JetBrains) gets fregma capabilities without
per-tool integration work.

## Dependency Rule

This package depends on `@fregma/core`, `@fregma/diagram`,
`@fregma/llm`, the MCP SDK, and `zod`. It has ZERO dependencies on
VS Code.

## Package Layout

```
src/
  index.ts              Main entry point (bin shebang)
  server.ts             McpServer setup and registration
  helpers/
    resolve.ts          Source resolution (file path vs inline YAML)
  tools/
    index.ts            Tool registration barrel
    validate.ts         validate_model tool
    verbalize.ts        verbalize_model tool
    schema.ts           generate_schema tool
    diff.ts             diff_models tool
    diagram.ts          generate_diagram tool
    import.ts           import_transcript tool
    merge.ts            merge_models tool
  resources/
    index.ts            Resource registration barrel
    ormSchema.ts        orm-schema://json-schema resource
    ormModel.ts         orm-model://{path} resource template
  prompts/
    index.ts            Prompt registration barrel
    analyzeDomain.ts    analyze-domain prompt
    reviewModel.ts      review-model prompt
tests/
  tools/                Tool handler tests
  resources/            Resource handler tests
```

## Commands

```sh
npx vitest run              # run tests
npx tsc --noEmit            # type-check only
```

## Key Conventions

- Uses stdio transport only (universally supported by all MCP clients).
- Each tool accepts a `source` parameter that can be either a file
  path to an `.orm.yaml` file or inline YAML content. The
  `resolveSource` helper detects which case applies.
- Tool handlers return `{ content: [{ type: "text", text }] }` per
  MCP protocol.
- Tests call tool handler functions directly with mock inputs (no
  transport needed).

## Dependencies

| Direction | Package | What is used |
|-----------|---------|--------------|
| Upstream  | `@fregma/core` | Model, validation, verbalization, mapping, diff, merge, serialization |
| Upstream  | `@fregma/diagram` | `generateDiagram` for SVG output |
| Upstream  | `@fregma/llm` | `processTranscript`, `createLlmClient`, provider factory |
