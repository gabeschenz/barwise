/**
 * Tests for the ORM-to-relational schema mapper.
 *
 * RelationalMapper translates an OrmModel into a relational schema
 * following standard ORM-to-relational mapping rules:
 *   - Entity types become tables; value types become columns
 *   - Single-role uniqueness -> FK on the unique side (many-to-one)
 *   - Both-roles unique + one mandatory -> FK absorbed into mandatory side (1:1)
 *   - Both-roles unique + neither mandatory -> associative table (1:1 optional)
 *   - No uniqueness -> associative table (many-to-many)
 *   - Unary fact types -> boolean columns
 *   - Mandatory constraints -> NOT NULL
 */
import { describe, it, expect } from "vitest";
import { ModelBuilder } from "../helpers/ModelBuilder.js";
import { OrmModel } from "../../src/model/OrmModel.js";
import { RelationalMapper } from "../../src/mapping/RelationalMapper.js";
import { renderDdl } from "../../src/mapping/renderers/ddl.js";

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

  describe("data type resolution", () => {
    it("resolves entity PK type from reference-mode value type", () => {
      const model = new OrmModel({ name: "Test" });
      const customer = model.addObjectType({
        name: "Customer",
        kind: "entity",
        referenceMode: "customer_id",
      });
      model.addObjectType({
        name: "Customer_id",
        kind: "value",
        dataType: { name: "auto_counter" },
      });
      // Reference-mode fact type linking Customer to Customer_id.
      model.addFactType({
        name: "Customer has id",
        roles: [
          { id: "r1", name: "has", playerId: customer.id },
          {
            id: "r2",
            name: "is of",
            playerId: model.getObjectTypeByName("Customer_id")!.id,
          },
        ],
        readings: ["{0} has {1}"],
        constraints: [],
      });

      const schema = mapper.map(model);
      const table = schema.tables.find((t) => t.name === "customer")!;
      expect(table.columns[0]!.dataType).toBe("INTEGER");
    });

    it("falls back to TEXT when entity has no reference-mode value type", () => {
      const model = new ModelBuilder("Test")
        .withEntityType("Widget", { referenceMode: "widget_id" })
        .build();

      const schema = mapper.map(model);
      const table = schema.tables.find((t) => t.name === "widget")!;
      // No value type in the model, so PK defaults to TEXT.
      expect(table.columns[0]!.dataType).toBe("TEXT");
    });

    it("maps text with length to VARCHAR(n)", () => {
      const model = new OrmModel({ name: "Test" });
      const person = model.addObjectType({
        name: "Person",
        kind: "entity",
        referenceMode: "person_id",
      });
      const firstName = model.addObjectType({
        name: "FirstName",
        kind: "value",
        dataType: { name: "text", length: 30 },
      });
      model.addFactType({
        name: "Person has FirstName",
        roles: [
          { id: "r1", name: "has", playerId: person.id },
          { id: "r2", name: "is of", playerId: firstName.id },
        ],
        readings: ["{0} has {1}"],
        constraints: [
          { type: "internal_uniqueness", roleIds: ["r1"] },
        ],
      });

      const schema = mapper.map(model);
      const table = schema.tables.find((t) => t.name === "person")!;
      const col = table.columns.find((c) => c.name === "first_name")!;
      expect(col.dataType).toBe("VARCHAR(30)");
    });

    it("maps text without length to TEXT", () => {
      const model = new OrmModel({ name: "Test" });
      const person = model.addObjectType({
        name: "Person",
        kind: "entity",
        referenceMode: "person_id",
      });
      const note = model.addObjectType({
        name: "Note",
        kind: "value",
        dataType: { name: "text" },
      });
      model.addFactType({
        name: "Person has Note",
        roles: [
          { id: "r1", name: "has", playerId: person.id },
          { id: "r2", name: "is of", playerId: note.id },
        ],
        readings: ["{0} has {1}"],
        constraints: [
          { type: "internal_uniqueness", roleIds: ["r1"] },
        ],
      });

      const schema = mapper.map(model);
      const table = schema.tables.find((t) => t.name === "person")!;
      const col = table.columns.find((c) => c.name === "note")!;
      expect(col.dataType).toBe("TEXT");
    });

    it("maps decimal with precision and scale", () => {
      const model = new OrmModel({ name: "Test" });
      const product = model.addObjectType({
        name: "Product",
        kind: "entity",
        referenceMode: "product_id",
      });
      const price = model.addObjectType({
        name: "Price",
        kind: "value",
        dataType: { name: "decimal", length: 10, scale: 2 },
      });
      model.addFactType({
        name: "Product has Price",
        roles: [
          { id: "r1", name: "has", playerId: product.id },
          { id: "r2", name: "is of", playerId: price.id },
        ],
        readings: ["{0} has {1}"],
        constraints: [
          { type: "internal_uniqueness", roleIds: ["r1"] },
        ],
      });

      const schema = mapper.map(model);
      const table = schema.tables.find((t) => t.name === "product")!;
      const col = table.columns.find((c) => c.name === "price")!;
      expect(col.dataType).toBe("DECIMAL(10,2)");
    });

    it("maps boolean, date, and uuid types correctly", () => {
      const model = new OrmModel({ name: "Test" });
      const person = model.addObjectType({
        name: "Person",
        kind: "entity",
        referenceMode: "person_id",
      });
      const active = model.addObjectType({
        name: "IsActive",
        kind: "value",
        dataType: { name: "boolean" },
      });
      const dob = model.addObjectType({
        name: "BirthDate",
        kind: "value",
        dataType: { name: "date" },
      });
      const token = model.addObjectType({
        name: "Token",
        kind: "value",
        dataType: { name: "uuid" },
      });
      model.addFactType({
        name: "Person has IsActive",
        roles: [
          { id: "r1", name: "has", playerId: person.id },
          { id: "r2", name: "is of", playerId: active.id },
        ],
        readings: ["{0} has {1}"],
        constraints: [{ type: "internal_uniqueness", roleIds: ["r1"] }],
      });
      model.addFactType({
        name: "Person has BirthDate",
        roles: [
          { id: "r3", name: "has", playerId: person.id },
          { id: "r4", name: "is of", playerId: dob.id },
        ],
        readings: ["{0} has {1}"],
        constraints: [{ type: "internal_uniqueness", roleIds: ["r3"] }],
      });
      model.addFactType({
        name: "Person has Token",
        roles: [
          { id: "r5", name: "has", playerId: person.id },
          { id: "r6", name: "is of", playerId: token.id },
        ],
        readings: ["{0} has {1}"],
        constraints: [{ type: "internal_uniqueness", roleIds: ["r5"] }],
      });

      const schema = mapper.map(model);
      const table = schema.tables.find((t) => t.name === "person")!;
      expect(table.columns.find((c) => c.name === "is_active")!.dataType).toBe("BOOLEAN");
      expect(table.columns.find((c) => c.name === "birth_date")!.dataType).toBe("DATE");
      expect(table.columns.find((c) => c.name === "token")!.dataType).toBe("UUID");
    });

    it("FK column type matches referenced PK type", () => {
      const model = new OrmModel({ name: "Test" });
      const customer = model.addObjectType({
        name: "Customer",
        kind: "entity",
        referenceMode: "customer_id",
      });
      const customerId = model.addObjectType({
        name: "Customer_id",
        kind: "value",
        dataType: { name: "auto_counter" },
      });
      const order = model.addObjectType({
        name: "Order",
        kind: "entity",
        referenceMode: "order_number",
      });
      // Reference-mode fact type for Customer.
      model.addFactType({
        name: "Customer has id",
        roles: [
          { id: "r1", name: "has", playerId: customer.id },
          { id: "r2", name: "is of", playerId: customerId.id },
        ],
        readings: ["{0} has {1}"],
        constraints: [],
      });
      // Binary fact type: Order -> Customer.
      model.addFactType({
        name: "Customer places Order",
        roles: [
          { id: "r3", name: "places", playerId: customer.id },
          { id: "r4", name: "is placed by", playerId: order.id },
        ],
        readings: ["{0} places {1}"],
        constraints: [
          { type: "internal_uniqueness", roleIds: ["r4"] },
        ],
      });

      const schema = mapper.map(model);
      const orderTable = schema.tables.find((t) => t.name === "order")!;
      const fkCol = orderTable.columns.find((c) => c.name === "customer_id")!;
      // FK should be INTEGER (matching the auto_counter PK).
      expect(fkCol.dataType).toBe("INTEGER");
    });

    it("maps money type to DECIMAL(19,2)", () => {
      const model = new OrmModel({ name: "Test" });
      const invoice = model.addObjectType({
        name: "Invoice",
        kind: "entity",
        referenceMode: "invoice_id",
      });
      const amount = model.addObjectType({
        name: "Amount",
        kind: "value",
        dataType: { name: "money" },
      });
      model.addFactType({
        name: "Invoice has Amount",
        roles: [
          { id: "r1", name: "has", playerId: invoice.id },
          { id: "r2", name: "is of", playerId: amount.id },
        ],
        readings: ["{0} has {1}"],
        constraints: [{ type: "internal_uniqueness", roleIds: ["r1"] }],
      });

      const schema = mapper.map(model);
      const table = schema.tables.find((t) => t.name === "invoice")!;
      const col = table.columns.find((c) => c.name === "amount")!;
      expect(col.dataType).toBe("DECIMAL(19,2)");
    });
  });

  describe("data types in DDL rendering", () => {
    it("renders parameterized types in DDL", () => {
      const model = new OrmModel({ name: "Test" });
      const person = model.addObjectType({
        name: "Person",
        kind: "entity",
        referenceMode: "person_id",
      });
      const personId = model.addObjectType({
        name: "Person_id",
        kind: "value",
        dataType: { name: "auto_counter" },
      });
      const firstName = model.addObjectType({
        name: "FirstName",
        kind: "value",
        dataType: { name: "text", length: 50 },
      });
      model.addFactType({
        name: "Person has id",
        roles: [
          { id: "r1", name: "has", playerId: person.id },
          { id: "r2", name: "is of", playerId: personId.id },
        ],
        readings: ["{0} has {1}"],
        constraints: [],
      });
      model.addFactType({
        name: "Person has FirstName",
        roles: [
          { id: "r3", name: "has", playerId: person.id },
          { id: "r4", name: "is of", playerId: firstName.id },
        ],
        readings: ["{0} has {1}"],
        constraints: [
          { type: "internal_uniqueness", roleIds: ["r3"] },
          { type: "mandatory", roleId: "r3" },
        ],
      });

      const schema = mapper.map(model);
      const ddl = renderDdl(schema);

      expect(ddl).toContain("person_id INTEGER NOT NULL");
      expect(ddl).toContain("first_name VARCHAR(50) NOT NULL");
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
