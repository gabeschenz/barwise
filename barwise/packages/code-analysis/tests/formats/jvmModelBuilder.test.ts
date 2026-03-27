/**
 * Tests for the jvmModelBuilder.
 *
 * Verifies that CodeContext is correctly converted into an ORM model
 * with proper entity types, value types, fact types, and constraints.
 */
import { describe, expect, it } from "vitest";
import { buildModelFromJvmContext } from "../../src/formats/jvmModelBuilder.js";
import type { CodeContext } from "../../src/types.js";

function emptyContext(overrides?: Partial<CodeContext>): CodeContext {
  return {
    root: "/test",
    language: "java",
    types: [],
    validations: [],
    stateTransitions: [],
    annotations: [],
    filesAnalyzed: [],
    ...overrides,
  };
}

describe("buildModelFromJvmContext", () => {
  it("creates a model with the given name", () => {
    const ctx = emptyContext();
    const warnings: string[] = [];
    const model = buildModelFromJvmContext(ctx, "Test Model", warnings);

    expect(model.name).toBe("Test Model");
  });

  describe("enum extraction", () => {
    it("converts enums to value types with value constraints", () => {
      const ctx = emptyContext({
        types: [
          {
            name: "OrderStatus",
            kind: "enum",
            members: ["DRAFT", "SUBMITTED", "FULFILLED"],
            filePath: "OrderStatus.java",
            startLine: 1,
            sourceText: "enum OrderStatus { ... }",
          },
        ],
      });
      const warnings: string[] = [];
      const model = buildModelFromJvmContext(ctx, "Test", warnings);

      const ot = model.getObjectTypeByName("OrderStatus");
      expect(ot).toBeDefined();
      expect(ot!.kind).toBe("value");
      expect(ot!.valueConstraint?.values).toEqual(["DRAFT", "SUBMITTED", "FULFILLED"]);
    });
  });

  describe("@Entity extraction", () => {
    it("converts @Entity-annotated classes to entity types", () => {
      const ctx = emptyContext({
        types: [
          {
            name: "Customer",
            kind: "class",
            members: ["id", "name"],
            filePath: "Customer.java",
            startLine: 1,
            sourceText: "class Customer { ... }",
          },
        ],
        annotations: [
          {
            targetName: "Customer",
            targetKind: "class",
            className: "Customer",
            annotation: "Entity",
            parameters: {},
            filePath: "Customer.java",
            line: 1,
            sourceText: "@Entity",
          },
        ],
      });
      const warnings: string[] = [];
      const model = buildModelFromJvmContext(ctx, "Test", warnings);

      const ot = model.getObjectTypeByName("Customer");
      expect(ot).toBeDefined();
      expect(ot!.kind).toBe("entity");
    });

    it("infers reference mode from @Id annotation", () => {
      const ctx = emptyContext({
        types: [
          {
            name: "Employee",
            kind: "class",
            members: ["employeeId", "name"],
            filePath: "Employee.java",
            startLine: 1,
            sourceText: "class Employee { ... }",
          },
        ],
        annotations: [
          {
            targetName: "Employee",
            targetKind: "class",
            className: "Employee",
            annotation: "Entity",
            parameters: {},
            filePath: "Employee.java",
            line: 1,
            sourceText: "@Entity",
          },
          {
            targetName: "employeeId",
            targetKind: "field",
            className: "Employee",
            annotation: "Id",
            parameters: {},
            filePath: "Employee.java",
            line: 3,
            sourceText: "@Id",
          },
        ],
      });
      const warnings: string[] = [];
      const model = buildModelFromJvmContext(ctx, "Test", warnings);

      const ot = model.getObjectTypeByName("Employee");
      expect(ot).toBeDefined();
      expect(ot!.referenceMode).toBe("employeeId");
    });
  });

  describe("interface/class extraction", () => {
    it("converts non-entity interfaces to entity types", () => {
      const ctx = emptyContext({
        types: [
          {
            name: "Order",
            kind: "interface",
            members: ["id", "total"],
            filePath: "Order.java",
            startLine: 1,
            sourceText: "interface Order { ... }",
          },
        ],
      });
      const warnings: string[] = [];
      const model = buildModelFromJvmContext(ctx, "Test", warnings);

      const ot = model.getObjectTypeByName("Order");
      expect(ot).toBeDefined();
      expect(ot!.kind).toBe("entity");
    });

    it("excludes utility types", () => {
      const ctx = emptyContext({
        types: [
          {
            name: "OrderService",
            kind: "class",
            members: [],
            filePath: "OrderService.java",
            startLine: 1,
            sourceText: "class OrderService { ... }",
          },
          {
            name: "OrderController",
            kind: "class",
            members: [],
            filePath: "OrderController.java",
            startLine: 1,
            sourceText: "class OrderController { ... }",
          },
          {
            name: "OrderDTO",
            kind: "class",
            members: [],
            filePath: "OrderDTO.java",
            startLine: 1,
            sourceText: "class OrderDTO { ... }",
          },
        ],
      });
      const warnings: string[] = [];
      const model = buildModelFromJvmContext(ctx, "Test", warnings);

      expect(model.getObjectTypeByName("OrderService")).toBeUndefined();
      expect(model.getObjectTypeByName("OrderController")).toBeUndefined();
      expect(model.getObjectTypeByName("OrderDTO")).toBeUndefined();
    });
  });

  describe("@ManyToOne fact types", () => {
    it("creates fact types from @ManyToOne annotations", () => {
      const ctx = emptyContext({
        types: [
          {
            name: "Order",
            kind: "class",
            members: ["id", "customer"],
            filePath: "Order.java",
            startLine: 1,
            sourceText: "class Order { ... }",
          },
          {
            name: "Customer",
            kind: "class",
            members: ["id", "name"],
            filePath: "Customer.java",
            startLine: 1,
            sourceText: "class Customer { ... }",
          },
        ],
        annotations: [
          {
            targetName: "Order",
            targetKind: "class",
            className: "Order",
            annotation: "Entity",
            parameters: {},
            filePath: "Order.java",
            line: 1,
            sourceText: "@Entity",
          },
          {
            targetName: "Customer",
            targetKind: "class",
            className: "Customer",
            annotation: "Entity",
            parameters: {},
            filePath: "Customer.java",
            line: 1,
            sourceText: "@Entity",
          },
          {
            targetName: "customer",
            targetKind: "field",
            className: "Order",
            annotation: "ManyToOne",
            parameters: {},
            filePath: "Order.java",
            line: 4,
            sourceText: "@ManyToOne",
          },
        ],
      });
      const warnings: string[] = [];
      const model = buildModelFromJvmContext(ctx, "Test", warnings);

      expect(model.factTypes.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("state transitions", () => {
    it("creates value types from state transition fields", () => {
      const ctx = emptyContext({
        stateTransitions: [
          {
            stateField: "orderStatus",
            filePath: "OrderService.java",
            startLine: 10,
            sourceText: "switch (orderStatus) { ... }",
            transitions: [
              { from: "DRAFT", to: "SUBMITTED" },
              { from: "SUBMITTED", to: "FULFILLED" },
            ],
          },
        ],
      });
      const warnings: string[] = [];
      const model = buildModelFromJvmContext(ctx, "Test", warnings);

      const ot = model.getObjectTypeByName("OrderStatus");
      expect(ot).toBeDefined();
      expect(ot!.kind).toBe("value");
      expect(ot!.valueConstraint?.values).toContain("DRAFT");
      expect(ot!.valueConstraint?.values).toContain("SUBMITTED");
      expect(ot!.valueConstraint?.values).toContain("FULFILLED");
    });
  });

  describe("constraint annotations in warnings", () => {
    it("tracks @NotNull, @Size etc. as warnings", () => {
      const ctx = emptyContext({
        annotations: [
          {
            targetName: "name",
            targetKind: "field",
            className: "Product",
            annotation: "NotNull",
            parameters: {},
            filePath: "Product.java",
            line: 5,
            sourceText: "@NotNull",
          },
          {
            targetName: "name",
            targetKind: "field",
            className: "Product",
            annotation: "Size",
            parameters: { min: 1, max: 100 },
            filePath: "Product.java",
            line: 6,
            sourceText: "@Size(min = 1, max = 100)",
          },
        ],
      });
      const warnings: string[] = [];
      buildModelFromJvmContext(ctx, "Test", warnings);

      expect(warnings.some((w) => w.includes("@NotNull"))).toBe(true);
      expect(warnings.some((w) => w.includes("@Size"))).toBe(true);
    });
  });

  describe("empty context", () => {
    it("warns when no types or annotations found", () => {
      const ctx = emptyContext();
      const warnings: string[] = [];
      buildModelFromJvmContext(ctx, "Test", warnings);

      expect(warnings).toContain("No types or annotations found in scope");
    });
  });
});
