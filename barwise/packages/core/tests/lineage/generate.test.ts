import { describe, expect, it } from "vitest";
import { generateDdlLineage, generateModelLineage } from "../../src/lineage/generate.js";
import { RelationalMapper } from "../../src/mapping/RelationalMapper.js";
import { ModelBuilder } from "../helpers/ModelBuilder.js";

describe("Lineage Generation", () => {
  describe("generateDdlLineage", () => {
    it("should generate lineage for a simple entity table", () => {
      const model = new ModelBuilder("Test Model")
        .withEntityType("Customer", { referenceMode: "customer_id" })
        .build();

      const mapper = new RelationalMapper();
      const schema = mapper.map(model);

      const lineage = generateDdlLineage(model, schema);

      expect(lineage).toHaveLength(1);
      expect(lineage[0].artifact).toBe("customer");

      // Should trace back to the Customer entity type
      const entitySource = lineage[0].sources.find(
        s => s.elementType === "EntityType" && s.elementName === "Customer",
      );
      expect(entitySource).toBeDefined();
    });

    it("should trace FK relationships to source constraints", () => {
      const model = new ModelBuilder("Test Model")
        .withEntityType("Customer", { referenceMode: "customer_id" })
        .withEntityType("Order", { referenceMode: "order_id" })
        .withBinaryFactType("Customer places Order", {
          role1: { player: "Customer", name: "places" },
          role2: { player: "Order", name: "is placed by" },
          uniqueness: "role2", // Order is unique -> FK on Order table
          mandatory: "role2",
        })
        .build();

      const mapper = new RelationalMapper();
      const schema = mapper.map(model);

      const lineage = generateDdlLineage(model, schema);

      // Find the Order table lineage
      const orderLineage = lineage.find(entry => entry.artifact === "order");
      expect(orderLineage).toBeDefined();

      // Should have the Order entity type as a source
      const orderEntitySource = orderLineage!.sources.find(
        s => s.elementType === "EntityType" && s.elementName === "Order",
      );
      expect(orderEntitySource).toBeDefined();

      // Should have the fact type as a source (FK column)
      const factTypeSource = orderLineage!.sources.find(
        s => s.elementType === "FactType" && s.elementName === "Customer places Order",
      );
      expect(factTypeSource).toBeDefined();

      // Should have the Customer entity as a source (FK references Customer)
      const customerSource = orderLineage!.sources.find(
        s => s.elementType === "EntityType" && s.elementName === "Customer",
      );
      expect(customerSource).toBeDefined();
    });

    it("should trace columns back to their source roles", () => {
      const model = new ModelBuilder("Test Model")
        .withEntityType("Customer", { referenceMode: "customer_id" })
        .withValueType("CustomerName", { dataType: { name: "Text" } })
        .withBinaryFactType("Customer has CustomerName", {
          role1: { player: "Customer", name: "has" },
          role2: { player: "CustomerName", name: "is name of" },
          uniqueness: "role2",
          mandatory: "role2",
        })
        .build();

      const mapper = new RelationalMapper();
      const schema = mapper.map(model);

      const lineage = generateDdlLineage(model, schema);

      const customerLineage = lineage.find(entry => entry.artifact === "customer");
      expect(customerLineage).toBeDefined();

      // Should have the fact type that produced the name column
      const factTypeSource = customerLineage!.sources.find(
        s => s.elementType === "FactType" && s.elementName === "Customer has CustomerName",
      );
      expect(factTypeSource).toBeDefined();

      // Should have the CustomerName value type
      const valueTypeSource = customerLineage!.sources.find(
        s => s.elementType === "ValueType" && s.elementName === "CustomerName",
      );
      expect(valueTypeSource).toBeDefined();

      // Should have roles as sources
      const roleSources = customerLineage!.sources.filter(s => s.elementType === "Role");
      expect(roleSources.length).toBeGreaterThan(0);
    });

    it("should handle associative tables from many-to-many relationships", () => {
      const model = new ModelBuilder("Test Model")
        .withEntityType("Student", { referenceMode: "student_id" })
        .withEntityType("Course", { referenceMode: "course_id" })
        .withBinaryFactType("Student enrolls in Course", {
          role1: { player: "Student", name: "enrolls in" },
          role2: { player: "Course", name: "has enrolled" },
          // No uniqueness on either role -> spanning uniqueness -> associative table
        })
        .build();

      const mapper = new RelationalMapper();
      const schema = mapper.map(model);

      const lineage = generateDdlLineage(model, schema);

      // Should have 3 tables: student, course, and the associative table
      expect(lineage.length).toBe(3);

      // Find the associative table
      const assocLineage = lineage.find(
        entry => entry.artifact !== "student" && entry.artifact !== "course",
      );
      expect(assocLineage).toBeDefined();

      // Should trace to the fact type
      const factTypeSource = assocLineage!.sources.find(
        s => s.elementType === "FactType" && s.elementName === "Student enrolls in Course",
      );
      expect(factTypeSource).toBeDefined();

      // Should reference both entity types
      const studentSource = assocLineage!.sources.find(
        s => s.elementType === "EntityType" && s.elementName === "Student",
      );
      const courseSource = assocLineage!.sources.find(
        s => s.elementType === "EntityType" && s.elementName === "Course",
      );
      expect(studentSource).toBeDefined();
      expect(courseSource).toBeDefined();
    });
  });

  describe("generateModelLineage", () => {
    it("should generate lineage entries for all entity types", () => {
      const model = new ModelBuilder("Test Model")
        .withEntityType("Customer", { referenceMode: "customer_id" })
        .withEntityType("Order", { referenceMode: "order_id" })
        .build();

      const lineage = generateModelLineage(model);

      expect(lineage).toHaveLength(2);

      const customerEntry = lineage.find(e => e.artifact === "Customer");
      const orderEntry = lineage.find(e => e.artifact === "Order");

      expect(customerEntry).toBeDefined();
      expect(orderEntry).toBeDefined();

      // Each should have the entity itself as a source
      expect(customerEntry!.sources.some(
        s => s.elementType === "EntityType" && s.elementName === "Customer",
      )).toBe(true);
      expect(orderEntry!.sources.some(
        s => s.elementType === "EntityType" && s.elementName === "Order",
      )).toBe(true);
    });

    it("should include related fact types and constraints", () => {
      const model = new ModelBuilder("Test Model")
        .withEntityType("Customer", { referenceMode: "customer_id" })
        .withEntityType("Order", { referenceMode: "order_id" })
        .withBinaryFactType("Customer places Order", {
          role1: { player: "Customer", name: "places" },
          role2: { player: "Order", name: "is placed by" },
          uniqueness: "role2",
          mandatory: "role2",
        })
        .build();

      const lineage = generateModelLineage(model);

      const customerEntry = lineage.find(e => e.artifact === "Customer");
      expect(customerEntry).toBeDefined();

      // Should include the fact type
      const factTypeSource = customerEntry!.sources.find(
        s => s.elementType === "FactType" && s.elementName === "Customer places Order",
      );
      expect(factTypeSource).toBeDefined();

      // Should include roles
      const roleSources = customerEntry!.sources.filter(s => s.elementType === "Role");
      expect(roleSources.length).toBeGreaterThan(0);

      // Should include constraints
      const constraintSources = customerEntry!.sources.filter(s => s.elementType === "Constraint");
      expect(constraintSources.length).toBeGreaterThan(0);
    });

    it("should include value types when present", () => {
      const model = new ModelBuilder("Test Model")
        .withEntityType("Customer", { referenceMode: "customer_id" })
        .withValueType("CustomerName", { dataType: { name: "Text" } })
        .withBinaryFactType("Customer has CustomerName", {
          role1: { player: "Customer", name: "has" },
          role2: { player: "CustomerName", name: "is name of" },
          uniqueness: "role2",
          mandatory: "role2",
        })
        .build();

      const lineage = generateModelLineage(model);

      const customerEntry = lineage.find(e => e.artifact === "Customer");
      expect(customerEntry).toBeDefined();

      // Should include the value type
      const valueTypeSource = customerEntry!.sources.find(
        s => s.elementType === "ValueType" && s.elementName === "CustomerName",
      );
      expect(valueTypeSource).toBeDefined();
    });

    it("should include subtype relationships", () => {
      const model = new ModelBuilder("Test Model")
        .withEntityType("Person", { referenceMode: "person_id" })
        .withEntityType("Customer", { referenceMode: "person_id" })
        .withSubtypeFact("Customer", "Person")
        .build();

      const lineage = generateModelLineage(model);

      const customerEntry = lineage.find(e => e.artifact === "Customer");
      expect(customerEntry).toBeDefined();

      // Should include Person as a supertype
      const personSource = customerEntry!.sources.filter(
        s => s.elementType === "EntityType" && s.elementName === "Person",
      );
      expect(personSource.length).toBeGreaterThan(0);

      const personEntry = lineage.find(e => e.artifact === "Person");
      expect(personEntry).toBeDefined();

      // Person should reference Customer as a subtype
      const customerSource = personEntry!.sources.filter(
        s => s.elementType === "EntityType" && s.elementName === "Customer",
      );
      expect(customerSource.length).toBeGreaterThan(0);
    });

    it("should handle entities with no fact types", () => {
      const model = new ModelBuilder("Test Model")
        .withEntityType("Customer", { referenceMode: "customer_id" })
        .build();

      const lineage = generateModelLineage(model);

      expect(lineage).toHaveLength(1);
      expect(lineage[0].artifact).toBe("Customer");

      // Should only have the entity itself as a source
      expect(lineage[0].sources).toHaveLength(1);
      expect(lineage[0].sources[0].elementType).toBe("EntityType");
      expect(lineage[0].sources[0].elementName).toBe("Customer");
    });
  });
});
