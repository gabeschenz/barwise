/**
 * Commander program definition for the fregma CLI.
 *
 * Each command group is registered from its own module.
 */

import { Command } from "commander";
import { registerValidateCommand } from "./commands/validate.js";
import { registerVerbalizeCommand } from "./commands/verbalize.js";
import { registerSchemaCommand } from "./commands/schema.js";
import { registerExportCommand } from "./commands/export.js";
import { registerDiagramCommand } from "./commands/diagram.js";
import { registerDiffCommand } from "./commands/diff.js";
import { registerImportCommand } from "./commands/import.js";
import { registerDescribeCommand } from "./commands/describe.js";

export function createProgram(): Command {
  const program = new Command();
  program
    .name("fregma")
    .description("ORM 2 modeling tool for data engineers and architects")
    .version("0.1.0");

  registerValidateCommand(program);
  registerVerbalizeCommand(program);
  registerDescribeCommand(program);
  registerSchemaCommand(program);
  registerExportCommand(program);
  registerDiagramCommand(program);
  registerDiffCommand(program);
  registerImportCommand(program);

  return program;
}
