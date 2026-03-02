# Fregma MCP Server

MCP (Model Context Protocol) server that exposes fregma ORM 2 modeling
capabilities as tools, resources, and prompts. Any AI tool that speaks
MCP gets access to validation, verbalization, schema generation,
diffing, diagram generation, transcript import, and model merging.

## Supported clients

Claude Code, Claude Desktop, GitHub Copilot (VS Code), opencode, Cursor,
Windsurf, Zed, Cline, JetBrains AI, and any other tool implementing the
MCP specification.

## Setup

### Build

From the monorepo root:

```sh
npm run build
```

### Claude Code

Add to `.claude/settings.json` (project) or
`~/.claude/settings.json` (global):

```json
{
  "mcpServers": {
    "fregma": {
      "command": "node",
      "args": ["/absolute/path/to/fregma/packages/mcp/dist/index.js"]
    }
  }
}
```

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`
(macOS) or the equivalent on your platform:

```json
{
  "mcpServers": {
    "fregma": {
      "command": "node",
      "args": ["/absolute/path/to/fregma/packages/mcp/dist/index.js"]
    }
  }
}
```

### GitHub Copilot (VS Code)

The quickest way is via the command palette: run **MCP: Add Server...**,
choose **stdio**, and enter the command and arguments below.

To configure manually, add to `.vscode/mcp.json` in your project:

```json
{
  "servers": {
    "fregma": {
      "type": "stdio",
      "command": "node",
      "args": ["/absolute/path/to/fregma/packages/mcp/dist/index.js"],
      "env": {
        "ANTHROPIC_API_KEY": "${input:anthropic-key}"
      }
    }
  },
  "inputs": [
    {
      "type": "promptString",
      "id": "anthropic-key",
      "description": "Anthropic API key (for transcript import)",
      "password": true
    }
  ]
}
```

The `env` and `inputs` sections are only needed for the `import_transcript`
tool. Remove them if you only use validation, verbalization, schema
generation, diffing, and diagram tools.

Open Copilot Chat, switch to **Agent** mode, and the fregma tools will
appear in the tool picker.

### Cursor / Windsurf

Add to `.cursor/mcp.json` or `.windsurf/mcp.json` in your project:

```json
{
  "mcpServers": {
    "fregma": {
      "command": "node",
      "args": ["/absolute/path/to/fregma/packages/mcp/dist/index.js"]
    }
  }
}
```

### Environment variables

For the `import_transcript` tool, set one of these to enable LLM
extraction:

- `ANTHROPIC_API_KEY` -- use Anthropic (Claude)
- `OPENAI_API_KEY` -- use OpenAI

If neither is set, the tool falls back to Ollama (local, no key
required).

## Tools

### validate_model

Validate an ORM 2 model and return structured diagnostics.

**Input**: `source` (file path or inline YAML)
**Returns**: JSON with `valid`, `errorCount`, `warningCount`, `errors`,
`warnings`

### verbalize_model

Generate FORML natural-language readings for fact types and constraints.

**Input**: `source` (file path or inline YAML), optional `factType`
**Returns**: Verbalization text

### generate_schema

Generate a relational schema from an ORM model.

**Input**: `source` (file path or inline YAML), `format` (`ddl` or
`json`, default: `ddl`)
**Returns**: DDL SQL or JSON mapping

### diff_models

Compare two ORM models and return structural deltas.

**Input**: `base` (file path or inline YAML), `incoming` (file path or
inline YAML)
**Returns**: JSON with `hasChanges`, `deltas`, `synonymCandidates`

### generate_diagram

Generate an SVG diagram from an ORM model.

**Input**: `source` (file path or inline YAML)
**Returns**: SVG markup

### import_transcript

Process a transcript through LLM extraction to produce a formal ORM
model. Requires an LLM provider configured via environment variables or
explicit options.

**Input**: `transcript` (text or file path), `modelName`, optional
`provider`, optional `model`
**Returns**: Annotated `.orm.yaml` content

### merge_models

Merge an incoming model into a base model. Accepts additions and
modifications, rejects removals (non-interactive).

**Input**: `base` (file path or inline YAML), `incoming` (file path or
inline YAML)
**Returns**: JSON with merged YAML, validation results

## Resources

### orm-schema://json-schema

The JSON Schema that defines the structure of `.orm.yaml` files. Useful
for understanding the model format.

### orm-model://{path}

Returns a deserialized ORM model from a file path as JSON. Allows AI
tools to inspect model contents without parsing YAML.

## Prompts

### analyze-domain

Guides the AI through analyzing a business domain transcript:
identifying entity types, value types, fact types, and constraints,
then using `import_transcript` to extract a formal model.

**Argument**: `transcript` (the business domain text to analyze)

### review-model

Guides the AI through reviewing an existing ORM model for quality.
Runs validation, verbalization, and schema generation to identify
issues and suggest improvements.

**Argument**: `filePath` (path to the .orm.yaml file to review)
