/**
 * Tests for objectified fact type verbalization.
 *
 * Verifies that the Verbalizer produces correct FORML verbalizations
 * for objectified fact types, following the pattern:
 * "{EntityType} is where {primary reading of underlying fact type}."
 */
import { describe, it, expect } from "vitest";
import { Verbalizer } from "../../src/verbalization/Verbalizer.js";
import { ModelBuilder } from "../helpers/ModelBuilder.js";

describe("objectified fact type verbalization", () => {
  const verbalizer = new Verbalizer();

  it("verbalizes as 'EntityType is where reading.'", () => {
    const model = new ModelBuilder("Marriage Domain")
      .withEntityType("Person", { referenceMode: "person_id" })
      .withEntityType("Marriage", { referenceMode: "marriage_id" })
      .withBinaryFactType("Person marries Person", {
        role1: { player: "Person", name: "marries" },
        role2: { player: "Person", name: "is married to" },
        uniqueness: "spanning",
      })
      .withObjectifiedFactType("Person marries Person", "Marriage")
      .build();

    const oft = model.objectifiedFactTypes[0]!;
    const v = verbalizer.verbalizeObjectifiedFactType(oft, model);

    expect(v.text).toBe("Marriage is where Person marries Person.");
    expect(v.category).toBe("objectification");
    expect(v.sourceElementId).toBe(oft.id);
  });

  it("includes entity type name as a reference segment", () => {
    const model = new ModelBuilder("Test")
      .withEntityType("Person")
      .withEntityType("Marriage")
      .withBinaryFactType("Person marries Person", {
        role1: { player: "Person", name: "marries" },
        role2: { player: "Person", name: "is married to" },
      })
      .withObjectifiedFactType("Person marries Person", "Marriage")
      .build();

    const oft = model.objectifiedFactTypes[0]!;
    const v = verbalizer.verbalizeObjectifiedFactType(oft, model);

    const firstSeg = v.segments[0]!;
    expect(firstSeg.text).toBe("Marriage");
    expect(firstSeg.kind).toBe("object_type_ref");
    expect(firstSeg.elementId).toBe(model.getObjectTypeByName("Marriage")!.id);
  });

  it("verbalizeModel includes objectification verbalizations", () => {
    const model = new ModelBuilder("Test")
      .withEntityType("Person")
      .withEntityType("Marriage")
      .withBinaryFactType("Person marries Person", {
        role1: { player: "Person", name: "marries" },
        role2: { player: "Person", name: "is married to" },
        uniqueness: "spanning",
      })
      .withObjectifiedFactType("Person marries Person", "Marriage")
      .build();

    const all = verbalizer.verbalizeModel(model);
    const objectificationVerbs = all.filter(
      (v) => v.category === "objectification",
    );
    expect(objectificationVerbs).toHaveLength(1);
    expect(objectificationVerbs[0]!.text).toBe(
      "Marriage is where Person marries Person.",
    );
  });

  it("handles fact type with different role players", () => {
    const model = new ModelBuilder("Employment")
      .withEntityType("Company")
      .withEntityType("Person")
      .withEntityType("Employment")
      .withBinaryFactType("Company employs Person", {
        role1: { player: "Company", name: "employs" },
        role2: { player: "Person", name: "works for" },
      })
      .withObjectifiedFactType("Company employs Person", "Employment")
      .build();

    const oft = model.objectifiedFactTypes[0]!;
    const v = verbalizer.verbalizeObjectifiedFactType(oft, model);
    expect(v.text).toBe("Employment is where Company employs Person.");
  });
});
