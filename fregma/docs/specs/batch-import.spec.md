# Batch transcript import

## Problem

Comparing extraction quality across models requires manually running
`fregma import transcript` for each transcript/model combination.
With 3 transcripts and 2 models, that is 6 manual invocations with
the same boilerplate options each time.

## Solution

Add `fregma import batch <dir>` subcommand that runs all `.md`
transcripts in a directory through one or more LLM models and writes
the outputs alongside the transcripts.

### Usage

```bash
fregma import batch examples/transcripts/ \
  --model gpt-5-mini --model gpt-5.3-codex
```

### Behavior

1. Scan `<dir>` for `.md` files (transcripts).
2. For each transcript and each `--model`:
   a. Create an LLM client with the specified model.
   b. Run `processTranscript()`.
   c. Serialize and annotate the result.
   d. Write to `<dir>/<transcript>-<model-slug>.orm.yaml`.
3. Print a summary table to stderr showing each combination and
   its result (object types, fact types, constraints, or error).

### Model slug

The model name is slugified for the filename: lowercase, replace
dots/spaces/slashes with nothing or hyphens, collapse consecutive
hyphens. Examples:
- `gpt-5-mini` -> `gpt-5-mini`
- `gpt-5.3-codex` -> `gpt-53-codex`
- `claude-sonnet-4-5-20250929` -> `claude-sonnet-45-20250929`

### Options

- `--model <model>` (repeatable, required): LLM model names to use.
- `--provider <provider>`: LLM provider (auto-detected if omitted).
- `--api-key <key>`: API key (falls back to env vars).
- `--base-url <url>`: Ollama server URL.
- `--no-annotate`: Skip TODO/NOTE annotations.
- `--output-dir <dir>`: Write outputs to a different directory
  (defaults to the input directory).

### Error handling

- If extraction fails for one transcript/model combination, log the
  error and continue with the next combination. Do not abort the
  entire batch.
- Exit code 1 if any combination failed, 0 if all succeeded.

## Test plan

- Unit test: model slug generation.
- Unit test: transcript file discovery (mock filesystem).
- Integration: verify command registers and parses options correctly.
