/**
 * Types for the code analysis package.
 *
 * These types represent the intermediate context assembled from LSP queries
 * and source code analysis, before being converted to ORM model elements.
 */

import type { ImportOptions } from "@barwise/core";

// -- LSP types ---------------------------------------------------------------

/**
 * Configuration for starting a language server.
 */
export interface LspConfig {
  /** Language identifier (e.g., "typescript", "java", "kotlin"). */
  readonly language: string;
  /** Workspace root path. */
  readonly workspaceRoot: string;
  /** Server command (e.g., "typescript-language-server"). */
  readonly command: string;
  /** Command arguments (e.g., ["--stdio"]). */
  readonly args: readonly string[];
  /** Initialization options passed to the server. */
  readonly initOptions?: Record<string, unknown>;
}

/**
 * LSP DocumentSymbol (simplified from the LSP spec).
 */
export interface DocumentSymbol {
  readonly name: string;
  readonly kind: SymbolKind;
  readonly range: Range;
  readonly selectionRange: Range;
  readonly detail?: string;
  readonly children?: readonly DocumentSymbol[];
}

/**
 * LSP SymbolInformation (workspace symbols).
 */
export interface SymbolInformation {
  readonly name: string;
  readonly kind: SymbolKind;
  readonly location: Location;
  readonly containerName?: string;
}

/**
 * LSP Location.
 */
export interface Location {
  readonly uri: string;
  readonly range: Range;
}

/**
 * LSP Range.
 */
export interface Range {
  readonly start: Position;
  readonly end: Position;
}

/**
 * LSP Position.
 */
export interface Position {
  readonly line: number;
  readonly character: number;
}

/**
 * LSP HoverResult.
 */
export interface HoverResult {
  readonly contents: string | { readonly kind: string; readonly value: string; };
}

/**
 * LSP CallHierarchyItem.
 */
export interface CallHierarchyItem {
  readonly name: string;
  readonly kind: SymbolKind;
  readonly uri: string;
  readonly range: Range;
  readonly selectionRange: Range;
  readonly detail?: string;
}

/** Subset of LSP SymbolKind values relevant to our analysis. */
export enum SymbolKind {
  File = 1,
  Module = 2,
  Namespace = 3,
  Package = 4,
  Class = 5,
  Method = 6,
  Property = 7,
  Field = 8,
  Constructor = 9,
  Enum = 10,
  Interface = 11,
  Function = 12,
  Variable = 13,
  Constant = 14,
  String = 15,
  Number = 16,
  Boolean = 17,
  Array = 18,
  Object = 19,
  Key = 20,
  Null = 21,
  EnumMember = 22,
  Struct = 23,
  Event = 24,
  Operator = 25,
  TypeParameter = 26,
}

// -- Context types -----------------------------------------------------------

/**
 * Assembled context from LSP queries and source code analysis.
 */
export interface CodeContext {
  /** Workspace root. */
  readonly root: string;
  /** Language analyzed. */
  readonly language: string;
  /** Type definitions found. */
  readonly types: readonly TypeDefinitionContext[];
  /** Validation/guard logic found. */
  readonly validations: readonly ValidationContext[];
  /** State machine / transition logic found. */
  readonly stateTransitions: readonly StateTransitionContext[];
  /** Annotation-based constraints (Java/Kotlin). */
  readonly annotations: readonly AnnotationConstraintContext[];
  /** Files analyzed. */
  readonly filesAnalyzed: readonly string[];
}

/**
 * A type definition found in source code.
 */
export interface TypeDefinitionContext {
  readonly name: string;
  readonly kind: "enum" | "interface" | "type_alias" | "class";
  readonly filePath: string;
  readonly startLine: number;
  readonly endLine: number;
  readonly sourceText: string;
  /** Members/fields of the type. */
  readonly members?: readonly string[];
  /** Symbols that reference this type (from LSP find-references). */
  readonly referencedBy: readonly SymbolReference[];
}

/**
 * A validation function found in source code.
 */
export interface ValidationContext {
  readonly functionName: string;
  readonly filePath: string;
  readonly startLine: number;
  readonly endLine: number;
  readonly sourceText: string;
  /** What entity/type this validation applies to (from LSP type info). */
  readonly targetType?: string;
  /** Where this validation is called from (from call hierarchy). */
  readonly calledFrom: readonly SymbolReference[];
}

/**
 * A state transition pattern found in source code.
 */
export interface StateTransitionContext {
  readonly stateField: string;
  readonly filePath: string;
  readonly startLine: number;
  readonly endLine: number;
  readonly sourceText: string;
  /** Allowed transitions extracted from code structure. */
  readonly transitions?: readonly { readonly from: string; readonly to: string; }[];
}

/**
 * An annotation-based constraint (Java/Kotlin Bean Validation, JPA).
 */
export interface AnnotationConstraintContext {
  /** Class or field the annotation applies to. */
  readonly targetName: string;
  readonly targetKind: "class" | "field" | "method" | "parameter";
  /** Enclosing class name. */
  readonly className: string;
  /** Annotation name (e.g., "NotNull", "Size", "ManyToOne"). */
  readonly annotation: string;
  /** Annotation parameters (e.g., { min: 1, max: 100 }). */
  readonly parameters: Record<string, unknown>;
  readonly filePath: string;
  readonly line: number;
  readonly sourceText: string;
}

/**
 * A reference to a symbol found via LSP.
 */
export interface SymbolReference {
  readonly filePath: string;
  readonly line: number;
  readonly symbolName: string;
}

// -- Import options ----------------------------------------------------------

/**
 * Extended import options for code-based formats.
 */
export interface CodeImportOptions extends ImportOptions {
  /** Glob patterns to include. */
  readonly scope?: readonly string[];
  /** Glob patterns to exclude. */
  readonly exclude?: readonly string[];
  /** Maximum files to analyze (guard against huge repos). */
  readonly maxFiles?: number;
  /** Path to existing ORM model to guide analysis. */
  readonly guidingModel?: string;
  /** Override LSP server command. */
  readonly lspCommand?: string;
}

// -- LSP session interface ---------------------------------------------------

/**
 * A live session with a language server.
 */
export interface LspSession {
  /** Query: get all symbols in a file. */
  documentSymbols(uri: string): Promise<DocumentSymbol[]>;

  /** Query: get type definition at a position. */
  typeDefinition(uri: string, line: number, character: number): Promise<Location[]>;

  /** Query: find all references to a symbol. */
  references(uri: string, line: number, character: number): Promise<Location[]>;

  /** Query: get hover information (type signature, docs). */
  hover(uri: string, line: number, character: number): Promise<HoverResult | null>;

  /** Query: get call hierarchy items at a position. */
  callHierarchy(uri: string, line: number, character: number): Promise<CallHierarchyItem[]>;

  /** Query: get workspace symbols matching a pattern. */
  workspaceSymbols(query: string): Promise<SymbolInformation[]>;

  /** Shut down this session. */
  stop(): Promise<void>;
}

/**
 * Provider that can return an existing LSP session (e.g. from VS Code).
 */
export interface LspSessionProvider {
  /** Return an existing session if available, or null to spawn. */
  getSession(config: LspConfig): LspSession | null;
}
