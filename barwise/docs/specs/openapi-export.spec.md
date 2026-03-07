# BARWISE-cjt: Add OpenAPI Export Format

## Goal

Add an OpenAPI 3.0 renderer that generates a JSON specification from a
RelationalSchema. Entity tables become component schemas, foreign keys
become $ref relationships, and CRUD paths are generated for each
resource.

## Design

### Input

Same as all renderers: `RelationalSchema` from `RelationalMapper.map()`.

### Output

An OpenAPI 3.0.0 JSON document with:

- **info**: title from model name, version "1.0.0"
- **components/schemas**: one schema per table
  - Properties from columns with SQL-to-JSON-Schema type mapping
  - Required array from non-nullable columns + PK columns
  - Foreign keys rendered as `$ref` to referenced schema
- **paths**: CRUD endpoints per table
  - `GET /{resource}` -- list all
  - `GET /{resource}/{id}` -- get by PK
  - `POST /{resource}` -- create
  - `PUT /{resource}/{id}` -- update
  - `DELETE /{resource}/{id}` -- delete

### Type Mapping

| SQL Type | JSON Schema type + format |
|----------|--------------------------|
| TEXT, VARCHAR | `{ type: "string" }` |
| INTEGER, INT, BIGINT | `{ type: "integer" }` |
| DECIMAL, NUMERIC, FLOAT, DOUBLE | `{ type: "number" }` |
| BOOLEAN, BOOL | `{ type: "boolean" }` |
| DATE | `{ type: "string", format: "date" }` |
| TIME | `{ type: "string", format: "time" }` |
| DATETIME, TIMESTAMP | `{ type: "string", format: "date-time" }` |
| UUID | `{ type: "string", format: "uuid" }` |
| BINARY, BLOB | `{ type: "string", format: "binary" }` |
| AUTO_COUNTER | `{ type: "integer" }` |
| Fallback | `{ type: "string" }` |

### Options

- `title`: Override the API title (default: derived from model)
- `version`: API version string (default: "1.0.0")
- `basePath`: Path prefix (default: "/")

## Stages

### Stage 1: Core renderer

- Create `packages/core/src/mapping/renderers/openapi.ts`
- Export types: `OpenApiSpec`, `OpenApiRenderOptions`
- Export functions: `renderOpenApi()`, `openApiToJson()`
- Add exports to `packages/core/src/index.ts`

### Stage 2: Tests

- Create `packages/core/tests/mapping/openapi.test.ts`
- Test schema generation, type mapping, FK references, paths, options

### Stage 3: CLI integration

- Add `barwise export openapi` subcommand in `packages/cli/src/commands/export.ts`
- Add CLI test in `packages/cli/tests/commands/export.test.ts`

### Stage 4: Build, lint, test, commit, push, PR

## Success Criteria

- All core and CLI tests pass
- Full monorepo build passes
- No lint errors
