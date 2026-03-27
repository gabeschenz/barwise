/**
 * Tests for the TypeCollector.
 *
 * Verifies regex-based extraction of TypeScript type definitions:
 * enums, interfaces, type aliases, and classes.
 */
import { describe, expect, it } from "vitest";
import { collectTypeDefinitions } from "../../src/context/TypeCollector.js";

describe("collectTypeDefinitions", () => {
  describe("enum extraction", () => {
    it("extracts a simple enum", () => {
      const source = `
export enum OrderStatus {
  Active,
  Pending,
  Completed,
  Cancelled
}`;
      const types = collectTypeDefinitions(source, "models.ts");

      expect(types).toHaveLength(1);
      expect(types[0]!.name).toBe("OrderStatus");
      expect(types[0]!.kind).toBe("enum");
      expect(types[0]!.members).toEqual(["Active", "Pending", "Completed", "Cancelled"]);
      expect(types[0]!.filePath).toBe("models.ts");
    });

    it("extracts enum with string values", () => {
      const source = `
enum Color {
  Red = "RED",
  Green = "GREEN",
  Blue = "BLUE"
}`;
      const types = collectTypeDefinitions(source, "colors.ts");

      expect(types).toHaveLength(1);
      expect(types[0]!.members).toEqual(["Red", "Green", "Blue"]);
    });

    it("extracts non-exported enum", () => {
      const source = `enum Direction { North, South, East, West }`;
      const types = collectTypeDefinitions(source, "direction.ts");

      expect(types).toHaveLength(1);
      expect(types[0]!.name).toBe("Direction");
    });
  });

  describe("interface extraction", () => {
    it("extracts a simple interface", () => {
      const source = `
export interface Order {
  id: string;
  customerId: string;
  total: number;
  status: OrderStatus;
}`;
      const types = collectTypeDefinitions(source, "order.ts");

      expect(types).toHaveLength(1);
      expect(types[0]!.name).toBe("Order");
      expect(types[0]!.kind).toBe("interface");
      expect(types[0]!.members).toContain("id");
      expect(types[0]!.members).toContain("customerId");
      expect(types[0]!.members).toContain("total");
      expect(types[0]!.members).toContain("status");
    });

    it("extracts interface with extends", () => {
      const source = `
interface Employee extends Person {
  employeeId: string;
  department: string;
}`;
      const types = collectTypeDefinitions(source, "employee.ts");

      expect(types).toHaveLength(1);
      expect(types[0]!.name).toBe("Employee");
    });
  });

  describe("type alias extraction", () => {
    it("extracts string literal union type", () => {
      const source =
        `export type PaymentMethod = "credit_card" | "debit_card" | "cash" | "wire_transfer";`;
      const types = collectTypeDefinitions(source, "payment.ts");

      expect(types).toHaveLength(1);
      expect(types[0]!.name).toBe("PaymentMethod");
      expect(types[0]!.kind).toBe("type_alias");
      expect(types[0]!.members).toEqual(["credit_card", "debit_card", "cash", "wire_transfer"]);
    });

    it("extracts type alias without union members", () => {
      const source = `type UserId = string;`;
      const types = collectTypeDefinitions(source, "types.ts");

      expect(types).toHaveLength(1);
      expect(types[0]!.name).toBe("UserId");
      expect(types[0]!.members).toBeUndefined();
    });
  });

  describe("class extraction", () => {
    it("extracts a simple class", () => {
      const source = `
export class Customer {
  id: string;
  name: string;
  email: string;
}`;
      const types = collectTypeDefinitions(source, "customer.ts");

      expect(types).toHaveLength(1);
      expect(types[0]!.name).toBe("Customer");
      expect(types[0]!.kind).toBe("class");
      expect(types[0]!.members).toContain("id");
      expect(types[0]!.members).toContain("name");
      expect(types[0]!.members).toContain("email");
    });

    it("extracts abstract class", () => {
      const source = `
export abstract class Vehicle {
  vin: string;
  make: string;
}`;
      const types = collectTypeDefinitions(source, "vehicle.ts");

      expect(types).toHaveLength(1);
      expect(types[0]!.name).toBe("Vehicle");
    });
  });

  describe("multiple types in one file", () => {
    it("extracts all types", () => {
      const source = `
export enum Status { Active, Inactive }
export interface Order { id: string; status: Status; }
export type Priority = "low" | "medium" | "high";
export class Product { sku: string; }`;
      const types = collectTypeDefinitions(source, "domain.ts");

      expect(types).toHaveLength(4);
      const names = types.map((t) => t.name).sort();
      expect(names).toEqual(["Order", "Priority", "Product", "Status"]);
    });
  });

  describe("line number tracking", () => {
    it("tracks start line numbers", () => {
      const source = `// line 1
// line 2
enum Color {
  Red,
  Blue
}`;
      const types = collectTypeDefinitions(source, "test.ts");

      expect(types).toHaveLength(1);
      expect(types[0]!.startLine).toBe(3);
    });
  });
});
