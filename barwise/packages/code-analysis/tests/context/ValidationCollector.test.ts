/**
 * Tests for the ValidationCollector.
 *
 * Verifies extraction of validation functions from TypeScript source code.
 */
import { describe, expect, it } from "vitest";
import { collectValidations } from "../../src/context/ValidationCollector.js";

describe("collectValidations", () => {
  it("extracts validate* functions", () => {
    const source = `
export function validateOrder(order: Order): boolean {
  if (!order.customerId) throw new Error("Customer required");
  return true;
}`;
    const validations = collectValidations(source, "validators.ts");

    expect(validations).toHaveLength(1);
    expect(validations[0]!.functionName).toBe("validateOrder");
    expect(validations[0]!.targetType).toBe("Order");
    expect(validations[0]!.filePath).toBe("validators.ts");
  });

  it("extracts check* functions", () => {
    const source = `
function checkInventory(product: Product): void {
  if (product.quantity < 0) throw new Error("Negative inventory");
}`;
    const validations = collectValidations(source, "checks.ts");

    expect(validations).toHaveLength(1);
    expect(validations[0]!.functionName).toBe("checkInventory");
    expect(validations[0]!.targetType).toBe("Product");
  });

  it("extracts is* functions (type guards)", () => {
    const source = `
export function isValid(input: string): boolean {
  return input.length > 0;
}`;
    const validations = collectValidations(source, "guards.ts");

    expect(validations).toHaveLength(1);
    expect(validations[0]!.functionName).toBe("isValid");
  });

  it("extracts assert* functions", () => {
    const source = `
function assertPositive(value: number): void {
  if (value <= 0) throw new Error("Must be positive");
}`;
    const validations = collectValidations(source, "assert.ts");

    expect(validations).toHaveLength(1);
    expect(validations[0]!.functionName).toBe("assertPositive");
  });

  it("extracts ensure* functions", () => {
    const source = `
async function ensureExists(id: string): Promise<void> {
  const item = await db.find(id);
  if (!item) throw new Error("Not found");
}`;
    const validations = collectValidations(source, "ensure.ts");

    expect(validations).toHaveLength(1);
    expect(validations[0]!.functionName).toBe("ensureExists");
  });

  it("ignores non-validation functions", () => {
    const source = `
function calculateTotal(items: Item[]): number {
  return items.reduce((sum, i) => sum + i.price, 0);
}

function processOrder(order: Order): void {
  // do stuff
}`;
    const validations = collectValidations(source, "services.ts");

    expect(validations).toHaveLength(0);
  });

  it("extracts multiple validations from one file", () => {
    const source = `
function validateEmail(email: string): boolean {
  return email.includes("@");
}

function checkAge(age: number): void {
  if (age < 0) throw new Error("Invalid age");
}

function isActive(user: User): boolean {
  return user.status === "active";
}`;
    const validations = collectValidations(source, "validators.ts");

    expect(validations).toHaveLength(3);
    const names = validations.map((v) => v.functionName).sort();
    expect(names).toEqual(["checkAge", "isActive", "validateEmail"]);
  });

  it("tracks line numbers", () => {
    const source = `// line 1
// line 2
function validateName(name: string): boolean {
  return name.length > 0;
}`;
    const validations = collectValidations(source, "test.ts");

    expect(validations).toHaveLength(1);
    expect(validations[0]!.startLine).toBe(3);
  });

  it("includes function body in sourceText", () => {
    const source = `
function validateAge(age: number): void {
  if (age < 0 || age > 150) {
    throw new Error("Age must be between 0 and 150");
  }
}`;
    const validations = collectValidations(source, "test.ts");

    expect(validations).toHaveLength(1);
    expect(validations[0]!.sourceText).toContain("age < 0 || age > 150");
  });
});
