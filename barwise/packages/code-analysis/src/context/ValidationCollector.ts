/**
 * Validation function collector.
 *
 * Identifies functions whose names or signatures suggest validation
 * logic (validate*, check*, is*, assert*). The function body is
 * included for LLM interpretation.
 */

import type { ValidationContext } from "../types.js";

/**
 * Patterns that suggest a function performs validation.
 */
const VALIDATION_NAME_PATTERNS = [
  /^validate\w*/i,
  /^check\w*/i,
  /^is[A-Z]\w*/,
  /^assert\w*/i,
  /^ensure\w*/i,
  /^verify\w*/i,
  /^must\w*/i,
  /^require\w*/i,
  /^canBe\w*/i,
  /^should\w*/i,
];

/**
 * Regex to find function declarations in TypeScript.
 */
const TS_FUNCTION_REGEX =
  /^\s*(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*(?:<[^>]*>)?\s*\(([^)]*)\)\s*(?::\s*[^{]+)?\s*\{/gm;

/**
 * Regex to find arrow function assignments.
 */
const TS_ARROW_REGEX =
  /^\s*(?:export\s+)?(?:const|let)\s+(\w+)\s*=\s*(?:async\s+)?(?:\([^)]*\)|(\w+))\s*(?::\s*[^=]+)?\s*=>\s*\{/gm;

/**
 * Regex to find class method declarations.
 */
const TS_METHOD_REGEX =
  /^\s*(?:(?:public|private|protected)\s+)?(?:static\s+)?(?:async\s+)?(\w+)\s*\(([^)]*)\)\s*(?::\s*[^{]+)?\s*\{/gm;

/**
 * Extract validation functions from TypeScript source code.
 */
export function collectValidations(
  sourceText: string,
  filePath: string,
): ValidationContext[] {
  const validations: ValidationContext[] = [];

  // Collect from function declarations
  collectFromRegex(TS_FUNCTION_REGEX, sourceText, filePath, validations);

  // Collect from arrow functions
  collectFromRegex(TS_ARROW_REGEX, sourceText, filePath, validations);

  // Collect from class methods
  collectFromRegex(TS_METHOD_REGEX, sourceText, filePath, validations);

  return validations;
}

function collectFromRegex(
  regex: RegExp,
  sourceText: string,
  filePath: string,
  results: ValidationContext[],
): void {
  let match;
  regex.lastIndex = 0;
  while ((match = regex.exec(sourceText)) !== null) {
    const name = match[1]!;

    // Check if the function name matches validation patterns
    if (!isValidationName(name)) continue;

    const startLine = lineNumber(sourceText, match.index);
    const body = extractFunctionBody(sourceText, match.index + match[0].length - 1);
    const fullSource = match[0] + body + "}";
    const endLine = lineNumber(sourceText, match.index + fullSource.length);

    // Try to determine the target type from parameters
    const targetType = extractTargetType(match[2] ?? "", body);

    results.push({
      functionName: name,
      filePath,
      startLine,
      endLine,
      sourceText: fullSource,
      targetType,
      calledFrom: [],
    });
  }
}

/**
 * Check if a function name matches validation patterns.
 */
function isValidationName(name: string): boolean {
  return VALIDATION_NAME_PATTERNS.some((pattern) => pattern.test(name));
}

/**
 * Extract the target type from function parameters or body.
 */
function extractTargetType(params: string, _body: string): string | undefined {
  // Look for typed parameter: (order: Order) or (input: CreateOrderInput)
  const typeMatch = /(\w+)\s*:\s*(\w+)/.exec(params);
  if (typeMatch) {
    return typeMatch[2];
  }
  return undefined;
}

/**
 * Extract the body of a function (between { and matching }).
 */
function extractFunctionBody(source: string, openBrace: number): string {
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
 * Get 1-based line number for a character offset.
 */
function lineNumber(source: string, offset: number): number {
  let line = 1;
  for (let i = 0; i < offset && i < source.length; i++) {
    if (source[i] === "\n") line++;
  }
  return line;
}
