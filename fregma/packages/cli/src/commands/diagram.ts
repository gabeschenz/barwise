/**
 * fregma diagram <file>
 *
 * Generates an SVG diagram from an ORM model.
 */

import type { Command } from "commander";
import { generateDiagram } from "@fregma/diagram";
import { loadModel, writeOutput } from "../helpers/io.js";

export function registerDiagramCommand(program: Command): void {
  program
    .command("diagram")
    .description("Generate an SVG diagram from an ORM model")
    .argument("<file>", "Path to .orm.yaml file")
    .option("--output <file>", "Write SVG to file instead of stdout")
    .action(async (file: string, opts: { output?: string }) => {
      // Print deprecation notice to stderr.
      process.stderr.write(
        "Note: 'fregma diagram' is deprecated. Use 'fregma export --format svg' instead (when available).\n\n",
      );

      try {
        const model = loadModel(file);
        const result = await generateDiagram(model);
        writeOutput(result.svg, opts.output);
      } catch (err) {
        process.stderr.write(`Error: ${(err as Error).message}\n`);
        process.exitCode = 1;
      }
    });
}
