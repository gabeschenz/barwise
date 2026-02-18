import { describe, it, expect } from "vitest";
import { ModelBuilder } from "../helpers/ModelBuilder.js";
import { diffModels } from "../../src/diff/ModelDiff.js";

function baseModel() {
  return new ModelBuilder("Test")
    .withEntityType("Customer", { referenceMode: "customer_id" })
    .withEntityType("Order", { referenceMode: "order_number" })
    .withValueType("Name")
    .withBinaryFactType("Customer places Order", {
      role1: { player: "Customer", name: "places" },
      role2: { player: "Order", name: "is placed by" },
      uniqueness: "role2",
      mandatory: "role2",
    })
    .withDefinition("Customer", "A person or organization that purchases goods.")
    .build();
}

describe("diffModels", () => {
  it("reports no changes when models are identical", () => {
    const a = baseModel();
    const b = baseModel();
    const result = diffModels(a, b);

    expect(result.hasChanges).toBe(false);
    expect(result.deltas.every((d) => d.kind === "unchanged")).toBe(true);
  });

  it("detects an added object type", () => {
    const existing = baseModel();
    const incoming = new ModelBuilder("Test")
      .withEntityType("Customer", { referenceMode: "customer_id" })
      .withEntityType("Order", { referenceMode: "order_number" })
      .withValueType("Name")
      .withEntityType("Product", { referenceMode: "product_id" })
      .withBinaryFactType("Customer places Order", {
        role1: { player: "Customer", name: "places" },
        role2: { player: "Order", name: "is placed by" },
        uniqueness: "role2",
        mandatory: "role2",
      })
      .withDefinition("Customer", "A person or organization that purchases goods.")
      .build();

    const result = diffModels(existing, incoming);
    expect(result.hasChanges).toBe(true);

    const added = result.deltas.filter((d) => d.kind === "added");
    expect(added).toHaveLength(1);
    expect(added[0]!.elementType).toBe("object_type");
    expect(added[0]!.name).toBe("Product");
  });

  it("detects a removed object type", () => {
    const existing = baseModel();
    const incoming = new ModelBuilder("Test")
      .withEntityType("Customer", { referenceMode: "customer_id" })
      .withEntityType("Order", { referenceMode: "order_number" })
      .withBinaryFactType("Customer places Order", {
        role1: { player: "Customer", name: "places" },
        role2: { player: "Order", name: "is placed by" },
        uniqueness: "role2",
        mandatory: "role2",
      })
      .withDefinition("Customer", "A person or organization that purchases goods.")
      .build();

    const result = diffModels(existing, incoming);
    expect(result.hasChanges).toBe(true);

    const removed = result.deltas.filter((d) => d.kind === "removed");
    expect(removed).toHaveLength(1);
    expect(removed[0]!.elementType).toBe("object_type");
    expect(removed[0]!.name).toBe("Name");
  });

  it("detects a modified object type (kind changed)", () => {
    const existing = baseModel();
    // Rebuild with Name as entity instead of value.
    const incoming = new ModelBuilder("Test")
      .withEntityType("Customer", { referenceMode: "customer_id" })
      .withEntityType("Order", { referenceMode: "order_number" })
      .withEntityType("Name", { referenceMode: "name_id" })
      .withBinaryFactType("Customer places Order", {
        role1: { player: "Customer", name: "places" },
        role2: { player: "Order", name: "is placed by" },
        uniqueness: "role2",
        mandatory: "role2",
      })
      .withDefinition("Customer", "A person or organization that purchases goods.")
      .build();

    const result = diffModels(existing, incoming);
    expect(result.hasChanges).toBe(true);

    const modified = result.deltas.filter((d) => d.kind === "modified");
    expect(modified.length).toBeGreaterThanOrEqual(1);
    const nameDelta = modified.find((d) => d.name === "Name");
    expect(nameDelta).toBeDefined();
    expect(nameDelta!.changes).toContain("kind: value -> entity");
  });

  it("detects an added fact type", () => {
    const existing = baseModel();
    const incoming = new ModelBuilder("Test")
      .withEntityType("Customer", { referenceMode: "customer_id" })
      .withEntityType("Order", { referenceMode: "order_number" })
      .withValueType("Name")
      .withBinaryFactType("Customer places Order", {
        role1: { player: "Customer", name: "places" },
        role2: { player: "Order", name: "is placed by" },
        uniqueness: "role2",
        mandatory: "role2",
      })
      .withBinaryFactType("Customer has Name", {
        role1: { player: "Customer", name: "has" },
        role2: { player: "Name", name: "is of" },
        uniqueness: "role1",
      })
      .withDefinition("Customer", "A person or organization that purchases goods.")
      .build();

    const result = diffModels(existing, incoming);
    expect(result.hasChanges).toBe(true);

    const added = result.deltas.filter(
      (d) => d.kind === "added" && d.elementType === "fact_type",
    );
    expect(added).toHaveLength(1);
    expect(added[0]!.name).toBe("Customer has Name");
  });

  it("detects a removed fact type", () => {
    const existing = baseModel();
    const incoming = new ModelBuilder("Test")
      .withEntityType("Customer", { referenceMode: "customer_id" })
      .withEntityType("Order", { referenceMode: "order_number" })
      .withValueType("Name")
      .withDefinition("Customer", "A person or organization that purchases goods.")
      .build();

    const result = diffModels(existing, incoming);
    expect(result.hasChanges).toBe(true);

    const removed = result.deltas.filter(
      (d) => d.kind === "removed" && d.elementType === "fact_type",
    );
    expect(removed).toHaveLength(1);
    expect(removed[0]!.name).toBe("Customer places Order");
  });

  it("detects modified fact type readings", () => {
    const existing = baseModel();
    const incoming = new ModelBuilder("Test")
      .withEntityType("Customer", { referenceMode: "customer_id" })
      .withEntityType("Order", { referenceMode: "order_number" })
      .withValueType("Name")
      .withBinaryFactType("Customer places Order", {
        role1: { player: "Customer", name: "places" },
        role2: { player: "Order", name: "is placed by" },
        readings: ["{0} submits {1}", "{1} is submitted by {0}"],
        uniqueness: "role2",
        mandatory: "role2",
      })
      .withDefinition("Customer", "A person or organization that purchases goods.")
      .build();

    const result = diffModels(existing, incoming);
    const modified = result.deltas.find(
      (d) => d.kind === "modified" && d.elementType === "fact_type",
    );
    expect(modified).toBeDefined();
    expect(modified!.changes).toContain("readings changed");
  });

  it("detects added and removed definitions", () => {
    const existing = baseModel();
    const incoming = new ModelBuilder("Test")
      .withEntityType("Customer", { referenceMode: "customer_id" })
      .withEntityType("Order", { referenceMode: "order_number" })
      .withValueType("Name")
      .withBinaryFactType("Customer places Order", {
        role1: { player: "Customer", name: "places" },
        role2: { player: "Order", name: "is placed by" },
        uniqueness: "role2",
        mandatory: "role2",
      })
      // Customer definition removed, Order definition added.
      .withDefinition("Order", "A request to purchase goods.")
      .build();

    const result = diffModels(existing, incoming);
    expect(result.hasChanges).toBe(true);

    const removedDef = result.deltas.find(
      (d) => d.kind === "removed" && d.elementType === "definition",
    );
    expect(removedDef).toBeDefined();
    expect(removedDef!.term).toBe("Customer");

    const addedDef = result.deltas.find(
      (d) => d.kind === "added" && d.elementType === "definition",
    );
    expect(addedDef).toBeDefined();
    expect(addedDef!.term).toBe("Order");
  });

  it("detects modified definition text", () => {
    const existing = baseModel();
    const incoming = new ModelBuilder("Test")
      .withEntityType("Customer", { referenceMode: "customer_id" })
      .withEntityType("Order", { referenceMode: "order_number" })
      .withValueType("Name")
      .withBinaryFactType("Customer places Order", {
        role1: { player: "Customer", name: "places" },
        role2: { player: "Order", name: "is placed by" },
        uniqueness: "role2",
        mandatory: "role2",
      })
      .withDefinition("Customer", "A buyer of products or services.")
      .build();

    const result = diffModels(existing, incoming);
    const modified = result.deltas.find(
      (d) => d.kind === "modified" && d.elementType === "definition",
    );
    expect(modified).toBeDefined();
    expect(modified!.changes).toContain("definition text changed");
  });
});
