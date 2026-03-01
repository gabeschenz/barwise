/**
 * fregma import transcript <file>
 *
 * Processes a transcript through the LLM extraction pipeline
 * and produces an .orm.yaml file.
 */

import type { Command } from "commander";
import { existsSync } from "node:fs";
import { basename, extname } from "node:path";
import {
  OrmYamlSerializer,
  diffModels,
  mergeAndValidate,
  annotateOrmYaml,
} from "@fregma/core";
import { processTranscript, createLlmClient } from "@fregma/llm";
import type { ProviderName } from "@fregma/llm";
import { readFile, writeOutput } from "../helpers/io.js";

const serializer = new OrmYamlSerializer();

export function registerImportCommand(program: Command): void {
  const importCmd = program
    .command("import")
    .description("Import data into ORM models");

  importCmd
    .command("transcript")
    .description("Extract an ORM model from a transcript using an LLM")
    .argument("<file>", "Path to transcript file (.md, .txt)")
    .option("--output <file>", "Write .orm.yaml to file instead of stdout")
    .option(
      "--provider <provider>",
      "LLM provider (anthropic, openai, ollama). Auto-detects from env vars if omitted.",
    )
    .option("--model <model>", "Model override for the LLM provider")
    .option("--api-key <key>", "API key (falls back to env vars)")
    .option(
      "--base-url <url>",
      "Ollama server URL (only for ollama provider)",
    )
    .option("--name <name>", "Model name (defaults to filename)")
    .option("--no-annotate", "Skip TODO/NOTE annotations in output")
    .action(
      async (
        file: string,
        opts: {
          output?: string;
          provider?: string;
          model?: string;
          apiKey?: string;
          baseUrl?: string;
          name?: string;
          annotate: boolean;
        },
      ) => {
        try {
          const transcript = readFile(file);
          if (!transcript.trim()) {
            process.stderr.write("Error: Transcript file is empty.\n");
            process.exitCode = 1;
            return;
          }

          const client = createLlmClient({
            provider: opts.provider as ProviderName | undefined,
            apiKey: opts.apiKey,
            model: opts.model,
            baseUrl: opts.baseUrl,
          });

          const modelName =
            opts.name ?? basename(file, extname(file));

          process.stderr.write("Extracting ORM model from transcript...\n");

          const result = await processTranscript(transcript, client, {
            modelName,
          });

          // If --output targets an existing file, do a non-interactive merge.
          let finalModel = result.model;
          if (opts.output && existsSync(opts.output)) {
            try {
              const existingYaml = readFile(opts.output);
              const existingModel = serializer.deserialize(existingYaml);
              const diff = diffModels(existingModel, result.model);

              if (diff.hasChanges) {
                // Accept additions and modifications, reject removals.
                const accepted = new Set<number>();
                for (let i = 0; i < diff.deltas.length; i++) {
                  const d = diff.deltas[i]!;
                  if (d.kind === "added" || d.kind === "modified") {
                    accepted.add(i);
                  }
                }

                const mergeResult = mergeAndValidate(
                  existingModel,
                  result.model,
                  diff.deltas,
                  accepted,
                );

                if (mergeResult.model) {
                  finalModel = mergeResult.model;
                  if (!mergeResult.isValid) {
                    process.stderr.write(
                      `Warning: Merged model has ${mergeResult.errors.length} validation issue(s).\n`,
                    );
                  }
                } else {
                  process.stderr.write(
                    "Warning: Merge failed, using extracted model directly.\n",
                  );
                }
              } else {
                process.stderr.write(
                  "No changes detected -- existing model is up to date.\n",
                );
                return;
              }
            } catch {
              // Existing file is not a valid model -- overwrite.
            }
          }

          // Serialize.
          const rawYaml = serializer.serialize(finalModel);
          let output: string;
          if (opts.annotate) {
            const annotated = annotateOrmYaml(rawYaml, result);
            output = annotated.yaml;
          } else {
            output = rawYaml;
          }

          writeOutput(output, opts.output);

          // Summary to stderr (so stdout stays clean for piping).
          const ots = result.model.objectTypes.length;
          const fts = result.model.factTypes.length;
          const applied = result.constraintProvenance.filter(
            (c) => c.applied,
          ).length;
          const modelNote = result.modelUsed ? ` (model: ${result.modelUsed})` : "";
          process.stderr.write(
            `Extracted ${ots} object types, ${fts} fact types, ${applied} constraints${modelNote}.\n`,
          );

          if (result.warnings.length > 0) {
            process.stderr.write(`${result.warnings.length} warning(s).\n`);
          }
          if (result.ambiguities.length > 0) {
            process.stderr.write(
              `${result.ambiguities.length} ambiguity(ies) detected.\n`,
            );
          }
        } catch (err) {
          process.stderr.write(`Error: ${(err as Error).message}\n`);
          process.exitCode = 1;
        }
      },
    );
}
