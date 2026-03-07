/**
 * barwise validate <file>
 *
 * Loads an .orm.yaml file, runs the full validation engine,
 * and prints diagnostics to stdout.
 */

import { ValidationEngine } from "@barwise/core";
import type { Command } from "commander";
import { formatDiagnostics, formatDiagnosticsJson } from "../helpers/format.js";
import { loadModel } from "../helpers/io.js";

export function registerValidateCommand(program: Command): void {
  program
    .command("validate")
    .description("Validate an ORM model file")
    .argument("<file>", "Path to .orm.yaml file")
    .option("--format <format>", "Output format (text or json)", "text")
    .option("--no-warnings", "Suppress warnings")
    .action(async (file: string, opts: { format: string; warnings: boolean; }) => {
      try {
        const model = loadModel(file);
        const engine = new ValidationEngine();
        let diagnostics = engine.validate(model);

        if (!opts.warnings) {
          diagnostics = diagnostics.filter((d) => d.severity === "error");
        }

        const errors = diagnostics.filter((d) => d.severity === "error");
        const warnings = diagnostics.filter((d) => d.severity === "warning");

        if (opts.format === "json") {
          process.stdout.write(formatDiagnosticsJson(diagnostics) + "\n");
        } else {
          if (diagnostics.length === 0) {
            process.stdout.write(`${file}: valid (0 errors, 0 warnings)\n`);
          } else {
            process.stdout.write(
              `${file}: ${errors.length} error(s), ${warnings.length} warning(s)\n\n`,
            );
            process.stdout.write(formatDiagnostics(diagnostics) + "\n");
          }
        }

        if (errors.length > 0) {
          process.exitCode = 1;
        }
      } catch (err) {
        process.stderr.write(`Error: ${(err as Error).message}\n`);
        process.exitCode = 1;
      }
    });
}
