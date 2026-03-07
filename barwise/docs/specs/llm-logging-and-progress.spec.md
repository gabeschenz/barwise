# LLM Logging and Progress Messages

**Issues:** BARWISE-qsq, BARWISE-a8c
**Status:** In Progress

## Problem

1. The VS Code progress notification during transcript extraction shows
   a generic message with no context about which file or model is being
   used.

2. There is no visibility into the LLM interaction itself -- prompt
   size, raw response, token usage, and latency are all discarded.

## Goals

### BARWISE-qsq

Replace `"Extracting ORM model from transcript..."` with a message
that includes the transcript filename and LLM model, e.g.
`"Extracting ORM model from clinic-appointments.md using gpt-5-mini..."`.

### BARWISE-a8c

Add a `barwise.verboseLogging` boolean setting that, when enabled,
writes detailed LLM interaction data to the output channel:

- Prompt length (character count) and model configuration
- Raw JSON response (truncated to 2000 characters)
- Token usage (prompt and completion tokens, if reported by provider)
- Extraction latency in milliseconds

## Approach

### Stage 1: Extend CompletionResponse interface

Add optional `usage` and `latencyMs` fields to `CompletionResponse`
in `@barwise/llm`. This is backward-compatible since the fields are
optional.

### Stage 2: Capture usage data in providers

Update `anthropic.ts`, `openai.ts`, and `ollama.ts` to populate the
new fields from their SDK responses. `CopilotLlmClient` may not have
access to token counts.

### Stage 3: Update progress message

Change the progress title in `ImportTranscriptCommand.ts` to include
the filename and model identifier.

### Stage 4: Add verbose logging

Add the `barwise.verboseLogging` setting and write LLM interaction
details to the output channel when enabled.

## Files Changed

- `packages/llm/src/LlmClient.ts`
- `packages/llm/src/providers/anthropic.ts`
- `packages/llm/src/providers/openai.ts`
- `packages/llm/src/providers/ollama.ts`
- `packages/vscode/src/llm/CopilotLlmClient.ts`
- `packages/vscode/src/commands/ImportTranscriptCommand.ts`
- `packages/vscode/src/commands/ImportDbtCommand.ts`
- `packages/vscode/package.json`
