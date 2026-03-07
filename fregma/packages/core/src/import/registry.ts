/**
 * Import format registry.
 *
 * Provides a central registry for all import formats, allowing formats to be
 * discovered and dispatched by name. This enables adding new import formats
 * without modifying tool surfaces (CLI, MCP, VS Code).
 */

import type { ImportFormat } from "./types.js";

/**
 * Error thrown when an import format operation fails.
 */
export class ImportFormatError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "ImportFormatError";
  }
}

/**
 * Registry of all available import formats.
 */
class ImportFormatRegistry {
  private readonly formats = new Map<string, ImportFormat>();

  /**
   * Register an import format.
   *
   * @param format - The import format to register
   * @throws ImportFormatError if a format with the same name already exists
   */
  register(format: ImportFormat): void {
    if (this.formats.has(format.name)) {
      throw new ImportFormatError(
        `Import format "${format.name}" is already registered.`,
      );
    }
    this.formats.set(format.name, format);
  }

  /**
   * Get an import format by name.
   *
   * @param name - Format identifier (e.g., "ddl", "dbt", "openapi")
   * @returns The import format, or undefined if not found
   */
  get(name: string): ImportFormat | undefined {
    return this.formats.get(name);
  }

  /**
   * Get all registered import formats.
   *
   * @returns Array of all registered formats
   */
  list(): readonly ImportFormat[] {
    return [...this.formats.values()];
  }

  /**
   * Clear all registered formats (primarily for testing).
   */
  clear(): void {
    this.formats.clear();
  }
}

/**
 * Singleton registry instance.
 */
const registry = new ImportFormatRegistry();

/**
 * Register an import format with the global registry.
 *
 * @param format - The import format to register
 * @throws ImportFormatError if a format with the same name already exists
 */
export function registerImportFormat(format: ImportFormat): void {
  registry.register(format);
}

/**
 * Get an import format by name from the global registry.
 *
 * @param name - Format identifier (e.g., "ddl", "dbt", "openapi")
 * @returns The import format, or undefined if not found
 */
export function getImportFormat(name: string): ImportFormat | undefined {
  return registry.get(name);
}

/**
 * Get all registered import formats.
 *
 * @returns Array of all registered formats
 */
export function listImportFormats(): readonly ImportFormat[] {
  return registry.list();
}

/**
 * Clear all registered import formats.
 *
 * This is primarily intended for testing to ensure a clean slate between tests.
 */
export function clearImportFormats(): void {
  registry.clear();
}
