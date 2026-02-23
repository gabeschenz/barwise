/**
 * Tests for subtype fact verbalization.
 *
 * Verifies that the Verbalizer produces correct verbalizations for
 * subtype relationships:
 *   - Basic "{Subtype} is a subtype of {Supertype}." pattern
 *   - Subtype verbalizations are included in verbalizeModel output
 *   - Category is "subtype"
 *   - Object type name references are correct
 */
import { describe, it, expect } from "vitest";
import { OrmModel } from "../../src/model/OrmModel.js";
import { Verbalizer } from "../../src/verbalization/Verbalizer.js";

const verbalizer = new Verbalizer();

describe("subtype verbalization", () => {
  it("verbalizes a subtype fact", () => {
    const model = new OrmModel({ name: "Test" });
    const person = model.addObjectType({
      name: "Person",
      kind: "entity",
      referenceMode: "person_id",
    });
    const employee = model.addObjectType({
      name: "Employee",
      kind: "entity",
      referenceMode: "employee_id",
    });
    const sf = model.addSubtypeFact({
      subtypeId: employee.id,
      supertypeId: person.id,
    });

    const verb = verbalizer.verbalizeSubtypeFact(sf, model);

    expect(verb.text).toBe("Employee is a subtype of Person.");
    expect(verb.category).toBe("subtype");
    expect(verb.sourceElementId).toBe(sf.id);
  });

  it("includes subtype verbalizations in verbalizeModel", () => {
    const model = new OrmModel({ name: "Test" });
    const person = model.addObjectType({
      name: "Person",
      kind: "entity",
      referenceMode: "person_id",
    });
    const employee = model.addObjectType({
      name: "Employee",
      kind: "entity",
      referenceMode: "employee_id",
    });
    model.addSubtypeFact({
      subtypeId: employee.id,
      supertypeId: person.id,
    });

    const all = verbalizer.verbalizeModel(model);
    const subtypeVerbs = all.filter((v) => v.category === "subtype");

    expect(subtypeVerbs).toHaveLength(1);
    expect(subtypeVerbs[0]!.text).toContain("Employee");
    expect(subtypeVerbs[0]!.text).toContain("Person");
  });

  it("includes object type references in segments", () => {
    const model = new OrmModel({ name: "Test" });
    const person = model.addObjectType({
      name: "Person",
      kind: "entity",
      referenceMode: "person_id",
    });
    const employee = model.addObjectType({
      name: "Employee",
      kind: "entity",
      referenceMode: "employee_id",
    });
    const sf = model.addSubtypeFact({
      subtypeId: employee.id,
      supertypeId: person.id,
    });

    const verb = verbalizer.verbalizeSubtypeFact(sf, model);
    const refs = verb.segments.filter((s) => s.kind === "object_type_ref");

    expect(refs).toHaveLength(2);
    expect(refs[0]!.text).toBe("Employee");
    expect(refs[0]!.elementId).toBe(employee.id);
    expect(refs[1]!.text).toBe("Person");
    expect(refs[1]!.elementId).toBe(person.id);
  });

  it("handles multiple subtype facts", () => {
    const model = new OrmModel({ name: "Test" });
    const person = model.addObjectType({
      name: "Person",
      kind: "entity",
      referenceMode: "person_id",
    });
    const employee = model.addObjectType({
      name: "Employee",
      kind: "entity",
      referenceMode: "employee_id",
    });
    const manager = model.addObjectType({
      name: "Manager",
      kind: "entity",
      referenceMode: "manager_id",
    });

    model.addSubtypeFact({ subtypeId: employee.id, supertypeId: person.id });
    model.addSubtypeFact({ subtypeId: manager.id, supertypeId: person.id });

    const all = verbalizer.verbalizeModel(model);
    const subtypeVerbs = all.filter((v) => v.category === "subtype");

    expect(subtypeVerbs).toHaveLength(2);
  });
});
