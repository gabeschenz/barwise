import { describe, it, expect } from "vitest";
import { OrmModel } from "../../src/model/OrmModel.js";
import { ConstraintVerbalizer } from "../../src/verbalization/ConstraintVerbalizer.js";
import type { Constraint } from "../../src/model/Constraint.js";
import type { FactType } from "../../src/model/FactType.js";

const verbalizer = new ConstraintVerbalizer();

function buildBinaryModel(): { model: OrmModel; ft: FactType } {
  const model = new OrmModel({ name: "Test" });
  const customer = model.addObjectType({ name: "Customer", kind: "entity", referenceMode: "customer_id" });
  const order = model.addObjectType({ name: "Order", kind: "entity", referenceMode: "order_id" });
  const ft = model.addFactType({
    name: "Customer places Order",
    roles: [
      { id: "r1", name: "places", playerId: customer.id },
      { id: "r2", name: "is placed by", playerId: order.id },
    ],
    readings: ["{0} places {1}", "{1} is placed by {0}"],
    constraints: [],
  });
  return { model, ft };
}

function buildSelfRefModel(): { model: OrmModel; ft: FactType } {
  const model = new OrmModel({ name: "Test" });
  const person = model.addObjectType({ name: "Person", kind: "entity", referenceMode: "person_id" });
  const ft = model.addFactType({
    name: "Person is parent of Person",
    roles: [
      { id: "r1", name: "is parent of", playerId: person.id },
      { id: "r2", name: "is child of", playerId: person.id },
    ],
    readings: ["{0} is parent of {1}"],
    constraints: [],
  });
  return { model, ft };
}

describe("Phase 2 constraint verbalization", () => {
  it("verbalizes disjunctive mandatory", () => {
    const { model, ft } = buildBinaryModel();
    const c: Constraint = { type: "disjunctive_mandatory", roleIds: ["r1", "r2"] };
    const v = verbalizer.verbalize(c, ft, model);
    expect(v.text).toContain("Each");
    expect(v.text).toContain("or");
    expect(v.category).toBe("constraint");
  });

  it("verbalizes exclusion", () => {
    const { model, ft } = buildBinaryModel();
    const c: Constraint = { type: "exclusion", roleIds: ["r1", "r2"] };
    const v = verbalizer.verbalize(c, ft, model);
    expect(v.text).toContain("No");
    expect(v.text).toContain("both");
    expect(v.text).toContain("and");
  });

  it("verbalizes exclusive-or", () => {
    const { model, ft } = buildBinaryModel();
    const c: Constraint = { type: "exclusive_or", roleIds: ["r1", "r2"] };
    const v = verbalizer.verbalize(c, ft, model);
    expect(v.text).toContain("Each");
    expect(v.text).toContain("either");
    expect(v.text).toContain("but not both");
  });

  it("verbalizes subset", () => {
    const { model, ft } = buildBinaryModel();
    const c: Constraint = { type: "subset", subsetRoleIds: ["r1"], supersetRoleIds: ["r2"] };
    const v = verbalizer.verbalize(c, ft, model);
    expect(v.text).toContain("If");
    expect(v.text).toContain("then");
  });

  it("verbalizes equality", () => {
    const { model, ft } = buildBinaryModel();
    const c: Constraint = { type: "equality", roleIds1: ["r1"], roleIds2: ["r2"] };
    const v = verbalizer.verbalize(c, ft, model);
    expect(v.text).toContain("if and only if");
  });

  it("verbalizes ring (irreflexive)", () => {
    const { model, ft } = buildSelfRefModel();
    const c: Constraint = { type: "ring", roleId1: "r1", roleId2: "r2", ringType: "irreflexive" };
    const v = verbalizer.verbalize(c, ft, model);
    expect(v.text).toContain("No");
    expect(v.text).toContain("Person");
    expect(v.text).toContain("that same");
  });

  it("verbalizes ring (asymmetric)", () => {
    const { model, ft } = buildSelfRefModel();
    const c: Constraint = { type: "ring", roleId1: "r1", roleId2: "r2", ringType: "asymmetric" };
    const v = verbalizer.verbalize(c, ft, model);
    expect(v.text).toContain("If");
    expect(v.text).toContain("does not");
  });

  it("verbalizes ring (other types)", () => {
    const { model, ft } = buildSelfRefModel();
    const c: Constraint = { type: "ring", roleId1: "r1", roleId2: "r2", ringType: "acyclic" };
    const v = verbalizer.verbalize(c, ft, model);
    expect(v.text).toContain("Acyclic:");
  });

  it("verbalizes frequency with range", () => {
    const { model, ft } = buildBinaryModel();
    const c: Constraint = { type: "frequency", roleId: "r1", min: 2, max: 5 };
    const v = verbalizer.verbalize(c, ft, model);
    expect(v.text).toContain("at least 2 and at most 5");
    expect(v.text).toContain("Customer");
  });

  it("verbalizes frequency unbounded", () => {
    const { model, ft } = buildBinaryModel();
    const c: Constraint = { type: "frequency", roleId: "r1", min: 3, max: "unbounded" };
    const v = verbalizer.verbalize(c, ft, model);
    expect(v.text).toContain("at least 3");
    expect(v.text).not.toContain("at most");
  });

  it("verbalizes frequency with exact count", () => {
    const { model, ft } = buildBinaryModel();
    const c: Constraint = { type: "frequency", roleId: "r1", min: 3, max: 3 };
    const v = verbalizer.verbalize(c, ft, model);
    expect(v.text).toContain("exactly 3");
  });
});
