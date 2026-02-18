import { describe, it, expect } from "vitest";
import { ModelBuilder } from "../helpers/ModelBuilder.js";
import { OrmModel } from "../../src/model/OrmModel.js";
import { RelationalMapper } from "../../src/mapping/RelationalMapper.js";

const mapper = new RelationalMapper();

describe("RelationalMapper", () => {
  describe("entity type tables", () => {
    it("creates a table for each entity type", () => {
      const model = new ModelBuilder("Test")
        .withEntityType("Customer", { referenceMode: "customer_id" })
        .withEntityType("Order", { referenceMode: "order_number" })
        .build();

      const schema = mapper.map(model);
      expect(schema.tables).toHaveLength(2);
      expect(schema.tables.map((t) => t.name)).toContain("customer");
      expect(schema.tables.map((t) => t.name)).toContain("order");
    });

    it("uses the reference mode as PK column", () => {
      const model = new ModelBuilder("Test")
        .withEntityType("Customer", { referenceMode: "customer_id" })
        .build();

      const schema = mapper.map(model);
      const table = schema.tables.find((t) => t.name === "customer")!;
      expect(table.primaryKey.columnNames).toEqual(["customer_id"]);
      expect(table.columns[0]!.name).toBe("customer_id");
      expect(table.columns[0]!.nullable).toBe(false);
    });

    it("does not create tables for value types", () => {
      const model = new ModelBuilder("Test")
        .withEntityType("Customer", { referenceMode: "customer_id" })
        .withValueType("Rating")
        .build();

      const schema = mapper.map(model);
      expect(schema.tables).toHaveLength(1);
      expect(schema.tables[0]!.name).toBe("customer");
    });
  });

  describe("binary fact types with single-role uniqueness", () => {
    it("adds FK to the unique side table (standard many-to-one)", () => {
      // Customer places Order: uniqueness on Order role means
      // each Order -> at most one Customer. FK goes on Order table.
      const model = new ModelBuilder("Test")
        .withEntityType("Customer", { referenceMode: "customer_id" })
        .withEntityType("Order", { referenceMode: "order_number" })
        .withBinaryFactType("Customer places Order", {
          role1: { player: "Customer", name: "places" },
          role2: { player: "Order", name: "is placed by" },
          uniqueness: "role2",
        })
        .build();

      const schema = mapper.map(model);
      const orderTable = schema.tables.find((t) => t.name === "order")!;

      // FK column added to order table.
      expect(orderTable.foreignKeys).toHaveLength(1);
      expect(orderTable.foreignKeys[0]!.referencedTable).toBe("customer");
    });

    it("FK column is nullable when role is not mandatory", () => {
      const model = new ModelBuilder("Test")
        .withEntityType("Customer", { referenceMode: "customer_id" })
        .withEntityType("Order", { referenceMode: "order_number" })
        .withBinaryFactType("Customer places Order", {
          role1: { player: "Customer", name: "places" },
          role2: { player: "Order", name: "is placed by" },
          uniqueness: "role2",
        })
        .build();

      const schema = mapper.map(model);
      const orderTable = schema.tables.find((t) => t.name === "order")!;
      const fkCol = orderTable.columns.find((c) => c.name === "customer_id")!;
      expect(fkCol.nullable).toBe(true);
    });

    it("FK column is NOT NULL when role is mandatory", () => {
      const model = new ModelBuilder("Test")
        .withEntityType("Customer", { referenceMode: "customer_id" })
        .withEntityType("Order", { referenceMode: "order_number" })
        .withBinaryFactType("Customer places Order", {
          role1: { player: "Customer", name: "places" },
          role2: { player: "Order", name: "is placed by" },
          uniqueness: "role2",
          mandatory: "role2",
        })
        .build();

      const schema = mapper.map(model);
      const orderTable = schema.tables.find((t) => t.name === "order")!;
      const fkCol = orderTable.columns.find((c) => c.name === "customer_id")!;
      expect(fkCol.nullable).toBe(false);
    });
  });

  describe("binary fact types with both roles unique (1:1)", () => {
    it("absorbs FK into mandatory side when one side is mandatory", () => {
      const model = new ModelBuilder("Test")
        .withEntityType("Employee", { referenceMode: "employee_id" })
        .withEntityType("Desk", { referenceMode: "desk_id" })
        .withBinaryFactType("Employee sits at Desk", {
          role1: { player: "Employee", name: "sits at" },
          role2: { player: "Desk", name: "is sat at by" },
          uniqueness: "both",
          mandatory: "role1",
        })
        .build();

      const schema = mapper.map(model);
      const employeeTable = schema.tables.find((t) => t.name === "employee")!;
      expect(employeeTable.foreignKeys).toHaveLength(1);
      expect(employeeTable.foreignKeys[0]!.referencedTable).toBe("desk");
      // No separate associative table.
      expect(schema.tables).toHaveLength(2);
    });

    it("creates associative table when neither side is mandatory", () => {
      const model = new ModelBuilder("Test")
        .withEntityType("Employee", { referenceMode: "employee_id" })
        .withEntityType("Desk", { referenceMode: "desk_id" })
        .withBinaryFactType("Employee sits at Desk", {
          role1: { player: "Employee", name: "sits at" },
          role2: { player: "Desk", name: "is sat at by" },
          uniqueness: "both",
        })
        .build();

      const schema = mapper.map(model);
      // 2 entity tables + 1 associative
      expect(schema.tables).toHaveLength(3);
      const assoc = schema.tables.find((t) => t.name === "employee_sits_at_desk");
      expect(assoc).toBeDefined();
    });
  });

  describe("binary fact types with no uniqueness", () => {
    it("creates an associative table (many-to-many)", () => {
      const model = new ModelBuilder("Test")
        .withEntityType("Student", { referenceMode: "student_id" })
        .withEntityType("Course", { referenceMode: "course_id" })
        .withBinaryFactType("Student enrolls in Course", {
          role1: { player: "Student", name: "enrolls in" },
          role2: { player: "Course", name: "has enrolled" },
          // No uniqueness -> spanning/many-to-many
        })
        .build();

      const schema = mapper.map(model);
      expect(schema.tables).toHaveLength(3);
      const assoc = schema.tables.find((t) => t.name === "student_enrolls_in_course");
      expect(assoc).toBeDefined();
      expect(assoc!.foreignKeys).toHaveLength(2);
    });
  });

  describe("value type columns", () => {
    it("adds a column for a value type in a binary fact type", () => {
      const model = new OrmModel({ name: "Test" });
      const customer = model.addObjectType({ name: "Customer", kind: "entity", referenceMode: "customer_id" });
      const name = model.addObjectType({ name: "Name", kind: "value" });
      model.addFactType({
        name: "Customer has Name",
        roles: [
          { id: "r1", name: "has", playerId: customer.id },
          { id: "r2", name: "is of", playerId: name.id },
        ],
        readings: ["{0} has {1}"],
        constraints: [
          { type: "internal_uniqueness", roleIds: ["r1"] },
          { type: "mandatory", roleId: "r1" },
        ],
      });

      const schema = mapper.map(model);
      expect(schema.tables).toHaveLength(1);
      const table = schema.tables[0]!;
      expect(table.name).toBe("customer");
      const nameCol = table.columns.find((c) => c.name === "name");
      expect(nameCol).toBeDefined();
      expect(nameCol!.nullable).toBe(false); // mandatory
    });
  });

  describe("unary fact types", () => {
    it("adds a boolean column", () => {
      const model = new OrmModel({ name: "Test" });
      const customer = model.addObjectType({ name: "Customer", kind: "entity", referenceMode: "customer_id" });
      model.addFactType({
        name: "Customer is active",
        roles: [{ id: "r1", name: "is active", playerId: customer.id }],
        readings: ["{0} is active"],
        constraints: [],
      });

      const schema = mapper.map(model);
      const table = schema.tables.find((t) => t.name === "customer")!;
      const col = table.columns.find((c) => c.name === "customer_is_active");
      expect(col).toBeDefined();
      expect(col!.dataType).toBe("BOOLEAN");
      expect(col!.nullable).toBe(true);
    });
  });

  describe("schema metadata", () => {
    it("sets sourceModelId", () => {
      const model = new ModelBuilder("Order Management").build();
      const schema = mapper.map(model);
      expect(schema.sourceModelId).toBe("Order Management");
    });
  });
});
