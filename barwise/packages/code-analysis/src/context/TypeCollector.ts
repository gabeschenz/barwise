/**
 * Type definition collector.
 *
 * Identifies enums, interfaces, type aliases, and class shapes from
 * source code. These often encode value constraints and entity
 * attributes directly.
 */

import type { TypeDefinitionContext } from "../types.js";

/**
 * Regex patterns for type definitions.
 *
 * These patterns handle TypeScript, Java, and Kotlin syntax:
 * - TS: export enum Foo, export interface Foo, export class Foo, type Foo = ...
 * - Java: public enum Foo, public class Foo, public interface Foo
 * - Kotlin: enum class Foo, data class Foo, sealed class Foo, sealed interface Foo
 */
const ENUM_REGEX =
  /^\s*(?:export\s+|public\s+|private\s+|protected\s+|internal\s+)*enum\s+(?:class\s+)?(\w+)\s*(?:\([^)]*\)\s*)?\{([^}]*)\}/gm;
const INTERFACE_REGEX =
  /^\s*(?:export\s+|public\s+|private\s+|protected\s+|internal\s+|sealed\s+)*interface\s+(\w+)(?:\s+(?:extends|:)\s+[\w,\s<>]+)?\s*\{/gm;
const TYPE_ALIAS_REGEX = /^\s*(?:export\s+)?type\s+(\w+)\s*=\s*(.+?);/gm;
const CLASS_REGEX =
  /^\s*(?:export\s+|public\s+|private\s+|protected\s+|internal\s+|abstract\s+|final\s+|open\s+|data\s+|sealed\s+)*class\s+(\w+)(?:\s*(?:\(|extends|implements|:)[\w,\s<>()@]*?)?\s*\{/gm;

/**
 * Extract type definitions from TypeScript source code.
 *
 * This is a regex-based extraction that works without an LSP server.
 * It identifies the major type definition patterns in TypeScript:
 * enums, interfaces, type aliases, and classes.
 */
export function collectTypeDefinitions(
  sourceText: string,
  filePath: string,
): TypeDefinitionContext[] {
  const types: TypeDefinitionContext[] = [];

  // Enums
  let match;
  while ((match = ENUM_REGEX.exec(sourceText)) !== null) {
    const name = match[1]!;
    const body = match[2]!;
    const startLine = lineNumber(sourceText, match.index);
    const endLine = lineNumber(sourceText, match.index + match[0].length);

    const members = body
      .split(",")
      .map((m) => m.trim().split("=")[0]!.trim())
      .filter((m) => m.length > 0);

    types.push({
      name,
      kind: "enum",
      filePath,
      startLine,
      endLine,
      sourceText: match[0],
      members,
      referencedBy: [],
    });
  }
  ENUM_REGEX.lastIndex = 0;

  // Interfaces
  while ((match = INTERFACE_REGEX.exec(sourceText)) !== null) {
    const name = match[1]!;
    const startLine = lineNumber(sourceText, match.index);
    const body = extractBlock(sourceText, match.index + match[0].length - 1);
    const endLine = lineNumber(sourceText, match.index + match[0].length + body.length);
    const members = extractMembers(body);

    types.push({
      name,
      kind: "interface",
      filePath,
      startLine,
      endLine,
      sourceText: match[0] + body + "}",
      members,
      referencedBy: [],
    });
  }
  INTERFACE_REGEX.lastIndex = 0;

  // Type aliases (including union types)
  while ((match = TYPE_ALIAS_REGEX.exec(sourceText)) !== null) {
    const name = match[1]!;
    const value = match[2]!;
    const startLine = lineNumber(sourceText, match.index);
    const endLine = lineNumber(sourceText, match.index + match[0].length);

    // Extract union members if it's a string literal union
    const members = extractUnionMembers(value);

    types.push({
      name,
      kind: "type_alias",
      filePath,
      startLine,
      endLine,
      sourceText: match[0],
      members: members.length > 0 ? members : undefined,
      referencedBy: [],
    });
  }
  TYPE_ALIAS_REGEX.lastIndex = 0;

  // Classes
  while ((match = CLASS_REGEX.exec(sourceText)) !== null) {
    const name = match[1]!;
    const startLine = lineNumber(sourceText, match.index);
    const body = extractBlock(sourceText, match.index + match[0].length - 1);
    const endLine = lineNumber(sourceText, match.index + match[0].length + body.length);
    const members = extractMembers(body);

    types.push({
      name,
      kind: "class",
      filePath,
      startLine,
      endLine,
      sourceText: match[0] + body + "}",
      members,
      referencedBy: [],
    });
  }
  CLASS_REGEX.lastIndex = 0;

  return types;
}

/**
 * Get 1-based line number for a character offset in source text.
 */
function lineNumber(source: string, offset: number): number {
  let line = 1;
  for (let i = 0; i < offset && i < source.length; i++) {
    if (source[i] === "\n") line++;
  }
  return line;
}

/**
 * Extract the body of a block (between { and matching }).
 */
function extractBlock(source: string, openBrace: number): string {
  let depth = 1;
  let i = openBrace + 1;
  while (i < source.length && depth > 0) {
    if (source[i] === "{") depth++;
    else if (source[i] === "}") depth--;
    if (depth > 0) i++;
  }
  return source.substring(openBrace + 1, i);
}

/**
 * Extract member names from a block body (interface/class).
 *
 * Handles:
 * - TypeScript: name: type, readonly name: type, name?: type
 * - Java: private String name;  or  Type name;
 * - Kotlin: val name: Type, var name: Type
 */
function extractMembers(body: string): string[] {
  const members: string[] = [];
  const seen = new Set<string>();

  // TypeScript/Kotlin style: name: type or name?: type or val/var name: type
  const tsRegex = /^\s*(?:readonly\s+|val\s+|var\s+)?(\w+)\s*[?:]/gm;
  let match;
  while ((match = tsRegex.exec(body)) !== null) {
    const name = match[1]!;
    if (!seen.has(name)) {
      seen.add(name);
      members.push(name);
    }
  }

  // Java style: access_modifier? Type name;
  const javaRegex =
    /^\s*(?:private|protected|public|final|static|transient|volatile)\s+(?:\w+(?:<[^>]*>)?)\s+(\w+)\s*[;=]/gm;
  while ((match = javaRegex.exec(body)) !== null) {
    const name = match[1]!;
    if (!seen.has(name)) {
      seen.add(name);
      members.push(name);
    }
  }

  return members;
}

/**
 * Extract members from a union type (string literal union).
 */
function extractUnionMembers(value: string): string[] {
  // Match: "a" | "b" | "c" or 'a' | 'b' | 'c'
  const literals = value.match(/['"]([^'"]+)['"]/g);
  if (!literals) return [];
  return literals.map((l) => l.replace(/['"]/g, ""));
}
