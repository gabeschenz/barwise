/**
 * fregma export yaml|json|dbt <file>
 *
 * Export an ORM model in various formats.
 */

import type { Command } from "commander";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { RelationalMapper, renderDbt } from "@fregma/core";
import { loadModel, serializer, writeOutput } from "../helpers/io.js";

export function registerExportCommand(program: Command): void {
  const exportCmd = program
    .command("export")
    .description("Export an ORM model in various formats");

  exportCmd
    .command("yaml")
    .description("Re-serialize model as .orm.yaml (normalize/reformat)")
    .argument("<file>", "Path to .orm.yaml file")
    .option("--output <file>", "Write to file instead of stdout")
    .action(async (file: string, opts: { output?: string }) => {
      try {
        const model = loadModel(file);
        const yaml = serializer.serialize(model);
        writeOutput(yaml, opts.output);
      } catch (err) {
        process.stderr.write(`Error: ${(err as Error).message}\n`);
        process.exitCode = 1;
      }
    });

  exportCmd
    .command("json")
    .description("Serialize model as JSON")
    .argument("<file>", "Path to .orm.yaml file")
    .option("--output <file>", "Write to file instead of stdout")
    .action(async (file: string, opts: { output?: string }) => {
      try {
        const model = loadModel(file);
        // Serialize via YAML, then parse and re-serialize as JSON
        // to get the canonical structure.
        const yaml = serializer.serialize(model);
        const { parse } = await import("yaml");
        const parsed = parse(yaml) as unknown;
        const json = JSON.stringify(parsed, null, 2);
        writeOutput(json, opts.output);
      } catch (err) {
        process.stderr.write(`Error: ${(err as Error).message}\n`);
        process.exitCode = 1;
      }
    });

  exportCmd
    .command("dbt")
    .description("Generate dbt model YAML and SQL from relational mapping")
    .argument("<file>", "Path to .orm.yaml file")
    .option("--output-dir <dir>", "Output directory for dbt files", ".")
    .action(async (file: string, opts: { outputDir: string }) => {
      try {
        const model = loadModel(file);
        const mapper = new RelationalMapper();
        const schema = mapper.map(model);
        const dbt = renderDbt(schema);

        mkdirSync(opts.outputDir, { recursive: true });

        // Write schema.yml
        const schemaPath = join(opts.outputDir, "schema.yml");
        writeOutput(dbt.schemaYaml, schemaPath);

        // Write model SQL files.
        for (const modelFile of dbt.models) {
          const modelPath = join(opts.outputDir, `${modelFile.name}.sql`);
          writeOutput(modelFile.sql, modelPath);
        }

        process.stdout.write(
          `Wrote schema.yml and ${dbt.models.length} model file(s) to ${opts.outputDir}\n`,
        );
      } catch (err) {
        process.stderr.write(`Error: ${(err as Error).message}\n`);
        process.exitCode = 1;
      }
    });
}
