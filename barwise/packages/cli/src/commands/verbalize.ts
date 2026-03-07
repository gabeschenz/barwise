/**
 * barwise verbalize <file>
 *
 * Loads an .orm.yaml file and generates FORML verbalizations
 * for all fact types and constraints.
 */

import type { Command } from "commander";
import { Verbalizer } from "@barwise/core";
import { loadModel } from "../helpers/io.js";
import { formatVerbalizations, formatVerbalizationsJson } from "../helpers/format.js";

export function registerVerbalizeCommand(program: Command): void {
  program
    .command("verbalize")
    .description("Generate FORML verbalizations for an ORM model")
    .argument("<file>", "Path to .orm.yaml file")
    .option("--format <format>", "Output format (text or json)", "text")
    .option("--fact-type <name>", "Verbalize a specific fact type only")
    .action(async (file: string, opts: { format: string; factType?: string }) => {
      try {
        const model = loadModel(file);
        const verbalizer = new Verbalizer();

        let verbalizations;
        if (opts.factType) {
          const ft = model.getFactTypeByName(opts.factType);
          if (!ft) {
            process.stderr.write(
              `Error: Fact type "${opts.factType}" not found in model.\n`,
            );
            process.exitCode = 1;
            return;
          }
          verbalizations = verbalizer.verbalizeFactType(ft.id, model);
        } else {
          verbalizations = verbalizer.verbalizeModel(model);
        }

        if (opts.format === "json") {
          process.stdout.write(formatVerbalizationsJson(verbalizations) + "\n");
        } else {
          process.stdout.write(formatVerbalizations(verbalizations) + "\n");
        }
      } catch (err) {
        process.stderr.write(`Error: ${(err as Error).message}\n`);
        process.exitCode = 1;
      }
    });
}
