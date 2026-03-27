/**
 * Type definition collector.
 *
 * Identifies enums, interfaces, type aliases, and class shapes from
 * source code. These often encode value constraints and entity
 * attributes directly.
 */

import type { TypeDefinitionContext } from "../types.js";

/**
 * Regex patterns for TypeScript type definitions.
 */
const TS_ENUM_REGEX = /^\s*(?:export\s+)?enum\s+(\w+)\s*\{([^}]*)\}/gm;
const TS_INTERFACE_REGEX = /^\s*(?:export\s+)?interface\s+(\w+)(?:\s+extends\s+[\w,\s<>]+)?\s*\{/gm;
const TS_TYPE_ALIAS_REGEX = /^\s*(?:export\s+)?type\s+(\w+)\s*=\s*(.+?);/gm;
const TS_CLASS_REGEX =
  /^\s*(?:export\s+)?(?:abstract\s+)?class\s+(\w+)(?:\s+(?:extends|implements)\s+[\w,\s<>]+)?\s*\{/gm;

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
  while ((match = TS_ENUM_REGEX.exec(sourceText)) !== null) {
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
  TS_ENUM_REGEX.lastIndex = 0;

  // Interfaces
  while ((match = TS_INTERFACE_REGEX.exec(sourceText)) !== null) {
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
  TS_INTERFACE_REGEX.lastIndex = 0;

  // Type aliases (including union types)
  while ((match = TS_TYPE_ALIAS_REGEX.exec(sourceText)) !== null) {
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
  TS_TYPE_ALIAS_REGEX.lastIndex = 0;

  // Classes
  while ((match = TS_CLASS_REGEX.exec(sourceText)) !== null) {
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
  TS_CLASS_REGEX.lastIndex = 0;

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
 */
function extractMembers(body: string): string[] {
  const members: string[] = [];
  // Match property declarations: name: type or name?: type
  const memberRegex = /^\s*(?:readonly\s+)?(\w+)\s*[?:]/gm;
  let match;
  while ((match = memberRegex.exec(body)) !== null) {
    members.push(match[1]!);
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
