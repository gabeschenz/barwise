# Fregma CLI

Command-line tool for ORM 2 modeling. Wraps the platform-independent
packages (`@fregma/core`, `@fregma/diagram`, `@fregma/llm`) into a
`fregma` binary.

## Installation

From the monorepo root:

```sh
npm run build
npm link --workspace=packages/cli
```

Or run directly without linking:

```sh
node packages/cli/dist/index.js <command>
```

## Commands

### validate

Run the validation engine on a model file and report diagnostics.

```sh
fregma validate model.orm.yaml
fregma validate model.orm.yaml --format json
fregma validate model.orm.yaml --no-warnings
```

Options:
- `--format <text|json>` -- output format (default: text)
- `--no-warnings` -- suppress warnings, show errors only

Exit code 1 if there are validation errors.

### verbalize

Generate FORML natural-language readings for fact types and constraints.

```sh
fregma verbalize university.orm.yaml
fregma verbalize university.orm.yaml --fact-type "Student enrolls in Course"
fregma verbalize university.orm.yaml --format json
```

Options:
- `--format <text|json>` -- output format (default: text)
- `--fact-type <name>` -- verbalize a specific fact type only

### schema

Generate a relational schema from the ORM model.

```sh
fregma schema university.orm.yaml
fregma schema university.orm.yaml --format json
fregma schema university.orm.yaml --output schema.sql
```

Options:
- `--format <ddl|json>` -- DDL SQL or JSON mapping (default: ddl)
- `--output <file>` -- write to file instead of stdout

### export

Export a model in various formats.

```sh
fregma export yaml model.orm.yaml --output normalized.orm.yaml
fregma export json model.orm.yaml --output model.json
fregma export dbt model.orm.yaml --output-dir dbt/models
```

Subcommands:
- `yaml` -- re-serialize as .orm.yaml (normalize/reformat)
- `json` -- serialize as JSON
- `dbt` -- generate dbt model YAML and SQL files

Options:
- `--output <file>` -- write to file (yaml, json)
- `--output-dir <dir>` -- output directory for dbt files (default: `.`)

### diagram

Generate an SVG diagram from the model.

```sh
fregma diagram university.orm.yaml
fregma diagram university.orm.yaml --output university.svg
```

Options:
- `--output <file>` -- write SVG to file instead of stdout

### diff

Compare two ORM model files and report structural deltas.

```sh
fregma diff old.orm.yaml new.orm.yaml
fregma diff old.orm.yaml new.orm.yaml --format json
fregma diff old.orm.yaml new.orm.yaml --no-synonyms
```

Options:
- `--format <text|json>` -- output format (default: text)
- `--no-synonyms` -- hide synonym/rename candidates

### import transcript

Extract an ORM model from a transcript using an LLM provider.

```sh
fregma import transcript meeting-notes.md --output model.orm.yaml
fregma import transcript notes.txt --provider openai --model gpt-4o
fregma import transcript notes.txt --provider ollama --base-url http://localhost:11434
```

Options:
- `--output <file>` -- write .orm.yaml to file instead of stdout
- `--provider <anthropic|openai|ollama>` -- LLM provider (auto-detects
  from env vars if omitted)
- `--model <name>` -- model override for the LLM provider
- `--api-key <key>` -- API key (falls back to env vars)
- `--base-url <url>` -- Ollama server URL (ollama provider only)
- `--name <name>` -- model name (defaults to filename)
- `--no-annotate` -- skip TODO/NOTE annotations in output

Provider auto-detection checks environment variables in order:
1. `ANTHROPIC_API_KEY` set -- uses Anthropic (Claude)
2. `OPENAI_API_KEY` set -- uses OpenAI
3. Neither set -- uses Ollama (local, no key required)

When `--output` targets an existing `.orm.yaml` file, the command runs
a non-interactive merge: additions and modifications are accepted,
removals are rejected. Use `fregma diff` to review changes first.
