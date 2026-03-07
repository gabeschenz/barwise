/**
 * Tests for population rendering utilities.
 */

import { describe, it, expect } from "vitest";
import {
  renderPopulationAsSql,
  renderPopulationAsOpenApiExamples,
} from "../../src/export/populationRenderer.js";
import { ModelBuilder } from "../helpers/ModelBuilder.js";
import { RelationalMapper } from "../../src/mapping/RelationalMapper.js";

describe("renderPopulationAsSql", () => {
  it("should render SQL INSERT statements for a populated model", () => {
    // Use a many-to-many relationship that creates a separate table (not absorbed)
    const model = new ModelBuilder("TestModel")
      .withEntityType("Student", { referenceMode: "student_id" })
      .withEntityType("Course", { referenceMode: "course_id" })
      .withValueType("StudentId", { dataType: { name: "text", length: 10 } })
      .withValueType("CourseId", { dataType: { name: "text", length: 10 } })
      .withBinaryFactType("Student has StudentId", {
        role1: { player: "Student", name: "has" },
        role2: { player: "StudentId", name: "identifies" },
        uniqueness: "role1",
        isPreferred: true,
      })
      .withBinaryFactType("Course has CourseId", {
        role1: { player: "Course", name: "has" },
        role2: { player: "CourseId", name: "identifies" },
        uniqueness: "role1",
        isPreferred: true,
      })
      .withBinaryFactType("Student enrolls in Course", {
        role1: { player: "Student", name: "enrolls in" },
        role2: { player: "Course", name: "has enrolled" },
      })
      .build();

    // Get the enrollment fact type to add population
    const ft = model.getFactTypeByName("Student enrolls in Course");
    if (!ft) throw new Error("Fact type not found");

    // Add population for many-to-many relationship
    const pop = model.addPopulation({
      factTypeId: ft.id,
      description: "Sample enrollments",
    });
    pop.addInstance({
      roleValues: {
        [ft.roles[0]!.id]: "S001",
        [ft.roles[1]!.id]: "CS101",
      },
    });
    pop.addInstance({
      roleValues: {
        [ft.roles[0]!.id]: "S002",
        [ft.roles[1]!.id]: "CS101",
      },
    });

    // Map to relational schema
    const mapper = new RelationalMapper();
    const schema = mapper.map(model);

    // Render
    const sql = renderPopulationAsSql(model, schema);

    expect(sql).toContain("-- Sample data from populations");
    expect(sql).toContain("INSERT INTO");
    expect(sql).toContain("S001");
    expect(sql).toContain("CS101");
  });

  it("should return empty string when model has no populations", () => {
    const model = new ModelBuilder("EmptyModel")
      .withEntityType("Customer", { referenceMode: "customer_id" })
      .withValueType("CustomerId", { dataType: { name: "text", length: 10 } })
      .withBinaryFactType("Customer has CustomerId", {
        role1: { player: "Customer", name: "has" },
        role2: { player: "CustomerId", name: "identifies" },
      })
      .build();

    const mapper = new RelationalMapper();
    const schema = mapper.map(model);

    const sql = renderPopulationAsSql(model, schema);

    expect(sql).toBe("");
  });

  it("should handle binary fact types", () => {
    const model = new ModelBuilder("OrderModel")
      .withEntityType("Customer", { referenceMode: "customer_id" })
      .withEntityType("Order", { referenceMode: "order_number" })
      .withValueType("CustomerId", { dataType: { name: "text", length: 10 } })
      .withValueType("OrderNumber", { dataType: { name: "text", length: 10 } })
      .withBinaryFactType("Customer has CustomerId", {
        role1: { player: "Customer", name: "has" },
        role2: { player: "CustomerId", name: "identifies" },
        uniqueness: "role1",
        isPreferred: true,
      })
      .withBinaryFactType("Order has OrderNumber", {
        role1: { player: "Order", name: "has" },
        role2: { player: "OrderNumber", name: "identifies" },
        uniqueness: "role1",
        isPreferred: true,
      })
      .withBinaryFactType("Customer places Order", {
        role1: { player: "Customer", name: "places" },
        role2: { player: "Order", name: "is placed by" },
      })
      .build();

    // Add population for relationship
    const placesFt = model.getFactTypeByName("Customer places Order");
    if (!placesFt) throw new Error("Fact type not found");

    const pop = model.addPopulation({
      factTypeId: placesFt.id,
      description: "Sample orders",
    });
    pop.addInstance({
      roleValues: {
        [placesFt.roles[0]!.id]: "C001",
        [placesFt.roles[1]!.id]: "O123",
      },
    });

    const mapper = new RelationalMapper();
    const schema = mapper.map(model);

    const sql = renderPopulationAsSql(model, schema);

    expect(sql).toContain("INSERT INTO");
    expect(sql).toContain("C001");
    expect(sql).toContain("O123");
  });
});

describe("renderPopulationAsOpenApiExamples", () => {
  it("should render OpenAPI examples for entity types", () => {
    const model = new ModelBuilder("TestModel")
      .withEntityType("Customer", { referenceMode: "customer_id" })
      .withValueType("CustomerId", { dataType: { name: "text", length: 10 } })
      .withBinaryFactType("Customer has CustomerId", {
        role1: { player: "Customer", name: "has" },
        role2: { player: "CustomerId", name: "identifies" },
        uniqueness: "role1",
        isPreferred: true,
      })
      .build();

    const ft = model.getFactTypeByName("Customer has CustomerId");
    if (!ft) throw new Error("Fact type not found");

    const pop = model.addPopulation({
      factTypeId: ft.id,
      description: "Sample customers",
    });
    pop.addInstance({
      roleValues: {
        [ft.roles[0]!.id]: "C001",
        [ft.roles[1]!.id]: "C001",
      },
    });

    const examples = renderPopulationAsOpenApiExamples(model);

    expect(examples.has("Customer")).toBe(true);
    const customerExample = examples.get("Customer");
    expect(customerExample).toBeDefined();
    expect(Object.keys(customerExample!).length).toBeGreaterThan(0);
  });

  it("should return empty map when model has no populations", () => {
    const model = new ModelBuilder("EmptyModel")
      .withEntityType("Customer", { referenceMode: "customer_id" })
      .withValueType("CustomerId", { dataType: { name: "text", length: 10 } })
      .withBinaryFactType("Customer has CustomerId", {
        role1: { player: "Customer", name: "has" },
        role2: { player: "CustomerId", name: "identifies" },
      })
      .build();

    const examples = renderPopulationAsOpenApiExamples(model);

    expect(examples.size).toBe(0);
  });

  it("should use first instance when multiple exist", () => {
    const model = new ModelBuilder("TestModel")
      .withEntityType("Customer", { referenceMode: "customer_id" })
      .withValueType("CustomerId", { dataType: { name: "text", length: 10 } })
      .withBinaryFactType("Customer has CustomerId", {
        role1: { player: "Customer", name: "has" },
        role2: { player: "CustomerId", name: "identifies" },
        uniqueness: "role1",
        isPreferred: true,
      })
      .build();

    const ft = model.getFactTypeByName("Customer has CustomerId");
    if (!ft) throw new Error("Fact type not found");

    const pop = model.addPopulation({
      factTypeId: ft.id,
    });
    pop.addInstance({
      roleValues: {
        [ft.roles[0]!.id]: "FIRST",
        [ft.roles[1]!.id]: "FIRST",
      },
    });
    pop.addInstance({
      roleValues: {
        [ft.roles[0]!.id]: "SECOND",
        [ft.roles[1]!.id]: "SECOND",
      },
    });

    const examples = renderPopulationAsOpenApiExamples(model);

    expect(examples.has("Customer")).toBe(true);
    const customerExample = examples.get("Customer");
    expect(customerExample).toBeDefined();
    // Should use first instance
    expect(JSON.stringify(customerExample)).toContain("FIRST");
  });
});
