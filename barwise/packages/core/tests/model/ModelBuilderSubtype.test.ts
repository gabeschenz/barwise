/**
 * Tests for ModelBuilder.withSubtypeFact().
 *
 * Verifies the fluent builder API for adding subtype relationships:
 *   - Basic usage with entity type names
 *   - Error when referencing nonexistent types
 *   - Custom providesIdentification option
 */
import { describe, expect, it } from "vitest";
import { ModelBuilder } from "../helpers/ModelBuilder.js";

describe("ModelBuilder withSubtypeFact", () => {
  it("adds a subtype fact between two entity types", () => {
    const model = new ModelBuilder("Test")
      .withEntityType("Person", { referenceMode: "person_id" })
      .withEntityType("Employee", { referenceMode: "employee_id" })
      .withSubtypeFact("Employee", "Person")
      .build();

    expect(model.subtypeFacts).toHaveLength(1);
    const sf = model.subtypeFacts[0]!;
    expect(sf.subtypeId).toBe(model.getObjectTypeByName("Employee")!.id);
    expect(sf.supertypeId).toBe(model.getObjectTypeByName("Person")!.id);
    expect(sf.providesIdentification).toBe(true);
  });

  it("supports providesIdentification = false", () => {
    const model = new ModelBuilder("Test")
      .withEntityType("Person", { referenceMode: "person_id" })
      .withEntityType("Employee", { referenceMode: "employee_id" })
      .withSubtypeFact("Employee", "Person", { providesIdentification: false })
      .build();

    expect(model.subtypeFacts[0]!.providesIdentification).toBe(false);
  });

  it("throws when subtype entity does not exist", () => {
    expect(() =>
      new ModelBuilder("Test")
        .withEntityType("Person", { referenceMode: "person_id" })
        .withSubtypeFact("Employee", "Person")
        .build()
    ).toThrow("not found");
  });

  it("throws when supertype entity does not exist", () => {
    expect(() =>
      new ModelBuilder("Test")
        .withEntityType("Employee", { referenceMode: "employee_id" })
        .withSubtypeFact("Employee", "Person")
        .build()
    ).toThrow("not found");
  });

  it("works with fact types on the same model", () => {
    const model = new ModelBuilder("Test")
      .withEntityType("Person", { referenceMode: "person_id" })
      .withEntityType("Employee", { referenceMode: "employee_id" })
      .withEntityType("Department", { referenceMode: "dept_id" })
      .withBinaryFactType("Employee works in Department", {
        role1: { player: "Employee", name: "works in" },
        role2: { player: "Department", name: "has" },
        uniqueness: "role1",
        mandatory: "role1",
      })
      .withSubtypeFact("Employee", "Person")
      .build();

    expect(model.subtypeFacts).toHaveLength(1);
    expect(model.factTypes).toHaveLength(1);
    expect(model.objectTypes).toHaveLength(3);
  });
});
