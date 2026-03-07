/**
 * Types for the import format system.
 *
 * Import formats provide a two-phase pipeline:
 * 1. Deterministic parsing (required) - produces a draft ORM model from structured input
 * 2. LLM enrichment (optional) - improves the draft with definitions, better naming, etc.
 *
 * The parse phase is always available and produces usable results. The enrich phase
 * requires an LLM client and provides semantic improvements.
 */

import type { OrmModel } from "../model/OrmModel.js";

/**
 * Options for importing from a format.
 */
export interface ImportOptions {
  /** Name to use for the generated model. Defaults to format-specific value. */
  readonly modelName?: string;
  /** Format-specific options (dialect, parsing hints, etc.). */
  readonly [key: string]: unknown;
}

/**
 * Result of an import operation.
 */
export interface ImportResult {
  /** The inferred ORM model. */
  readonly model: OrmModel;
  /** Warnings about ambiguities, assumptions, or unsupported features. */
  readonly warnings: readonly string[];
  /** Confidence level for the overall import quality. */
  readonly confidence: "high" | "medium" | "low";
}

/**
 * An import format that can parse structured data into an ORM model.
 *
 * All import formats must implement the deterministic `parse` method.
 * The optional `enrich` method uses an LLM to improve the draft model.
 */
export interface ImportFormat {
  /** Format identifier (e.g., "ddl", "dbt", "openapi"). */
  readonly name: string;
  /** Human-readable description of what this format imports. */
  readonly description: string;

  /**
   * Phase 1: Deterministic parse.
   *
   * Produces a draft ORM model from the input without any LLM assistance.
   * This should always succeed for valid input and produce a structurally
   * correct (if semantically rough) model.
   *
   * @param input - The raw input to parse (DDL, dbt YAML, OpenAPI JSON, etc.)
   * @param options - Format-specific parsing options
   * @returns ImportResult with the draft model, warnings, and confidence level
   */
  parse(input: string, options?: ImportOptions): ImportResult;

  /**
   * Phase 2: LLM enrichment (optional).
   *
   * Takes the draft model from `parse` and improves it using an LLM:
   * - Add entity/value type definitions
   * - Resolve naming ambiguities (is "patient_id" a Patient or a PatientId?)
   * - Identify semantic patterns (subtype relationships, missing constraints)
   * - Improve reading patterns for fact types
   *
   * The LLM client type is intentionally loose here (unknown) because core
   * cannot depend on @barwise/llm. Concrete implementations in packages that
   * have LLM access (cli, mcp, vscode) will narrow this to LlmClient.
   *
   * @param draft - The draft model from `parse`
   * @param input - The original input (for LLM context)
   * @param llm - LLM client (type varies by implementation context)
   * @param options - Format-specific enrichment options
   * @returns Enriched ImportResult with improved model
   */
  enrich?(
    draft: ImportResult,
    input: string,
    llm: unknown,
    options?: ImportOptions,
  ): Promise<ImportResult>;
}
