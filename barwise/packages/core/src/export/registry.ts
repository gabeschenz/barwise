/**
 * Export format registry.
 *
 * A simple Map-based registry for discovering and dispatching to export formats.
 * All export formats (DDL, dbt, Avro, OpenAPI, etc.) register here, making them
 * available to all tool surfaces (MCP, CLI, Language Model Tools) without
 * surface-specific wiring.
 */

import type { ExportFormatAdapter } from "./types.js";

/**
 * Registry for export formats.
 *
 * Provides registration, lookup, and listing of available formats.
 */
class FormatRegistry {
  private readonly formats = new Map<string, ExportFormatAdapter>();

  /**
   * Register an export format.
   *
   * @param format - The format to register.
   * @throws If a format with the same name is already registered.
   */
  registerFormat(format: ExportFormatAdapter): void {
    if (this.formats.has(format.name)) {
      throw new Error(
        `Export format "${format.name}" is already registered.`,
      );
    }
    this.formats.set(format.name, format);
  }

  /**
   * Get a registered format by name.
   *
   * @param name - The format identifier (e.g., "ddl", "dbt", "avro").
   * @returns The format, or undefined if not found.
   */
  getFormat(name: string): ExportFormatAdapter | undefined {
    return this.formats.get(name);
  }

  /**
   * List all registered formats.
   *
   * @returns Array of all registered format objects.
   */
  listFormats(): readonly ExportFormatAdapter[] {
    return Array.from(this.formats.values());
  }

  /**
   * Clear all registered formats.
   *
   * Used primarily in tests to reset the registry state.
   */
  clear(): void {
    this.formats.clear();
  }
}

/**
 * Singleton registry instance.
 *
 * All format registrations should use this instance.
 */
export const formatRegistry = new FormatRegistry();

/**
 * Register an export format.
 *
 * Convenience export that delegates to the singleton registry.
 */
export function registerFormat(format: ExportFormatAdapter): void {
  formatRegistry.registerFormat(format);
}

/**
 * Get a registered format by name.
 *
 * Convenience export that delegates to the singleton registry.
 */
export function getFormat(name: string): ExportFormatAdapter | undefined {
  return formatRegistry.getFormat(name);
}

/**
 * List all registered formats.
 *
 * Convenience export that delegates to the singleton registry.
 */
export function listFormats(): readonly ExportFormatAdapter[] {
  return formatRegistry.listFormats();
}
