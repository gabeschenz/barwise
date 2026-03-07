/**
 * File I/O helpers for the CLI.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { OrmYamlSerializer } from "@barwise/core";
import type { OrmModel } from "@barwise/core";

const serializer = new OrmYamlSerializer();

/**
 * Load and deserialize an ORM model from a .orm.yaml file.
 * Throws with a user-friendly message on failure.
 */
export function loadModel(filePath: string): OrmModel {
  let yaml: string;
  try {
    yaml = readFileSync(filePath, "utf-8");
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      throw new Error(`File not found: ${filePath}`, { cause: err });
    }
    throw new Error(`Cannot read file: ${filePath} (${(err as Error).message})`, { cause: err });
  }

  try {
    return serializer.deserialize(yaml);
  } catch (err) {
    throw new Error(`Failed to parse ${filePath}: ${(err as Error).message}`, { cause: err });
  }
}

/**
 * Read a file as a UTF-8 string.
 */
export function readFile(filePath: string): string {
  try {
    return readFileSync(filePath, "utf-8");
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      throw new Error(`File not found: ${filePath}`, { cause: err });
    }
    throw new Error(`Cannot read file: ${filePath} (${(err as Error).message})`, { cause: err });
  }
}

/**
 * Write a string to a file, or print to stdout if no path is given.
 */
export function writeOutput(content: string, filePath?: string): void {
  if (filePath) {
    writeFileSync(filePath, content, "utf-8");
  } else {
    process.stdout.write(content);
    // Ensure trailing newline.
    if (!content.endsWith("\n")) {
      process.stdout.write("\n");
    }
  }
}

export { serializer };
