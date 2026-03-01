/**
 * Tests for the model diff engine.
 *
 * diffModels compares two OrmModels and produces a list of deltas
 * (added, removed, modified, unchanged) for object types, fact types,
 * and definitions. This is used by the LLM re-extraction workflow to
 * show users what changed between the existing model and the new
 * extraction. These tests verify detection of:
 *   - Added, removed, and unchanged elements
 *   - Modified properties (kind, referenceMode, definition, sourceContext,
 *     valueConstraint, readings, role names, role players, constraints)
 */
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

  it("detects modified object type source context", () => {
    const existing = new ModelBuilder("Test")
      .withEntityType("Customer", {
        referenceMode: "customer_id",
        sourceContext: "CRM",
      })
      .build();
    const incoming = new ModelBuilder("Test")
      .withEntityType("Customer", {
        referenceMode: "customer_id",
        sourceContext: "Sales",
      })
      .build();

    const result = diffModels(existing, incoming);
    const delta = result.deltas.find((d) => d.name === "Customer");
    expect(delta!.kind).toBe("modified");
    expect(delta!.changes).toContain('source context: "CRM" -> "Sales"');
  });

  it("detects modified value constraint", () => {
    const existing = new ModelBuilder("Test")
      .withValueType("Rating", { valueConstraint: { values: ["A", "B", "C"] } })
      .build();
    const incoming = new ModelBuilder("Test")
      .withValueType("Rating", { valueConstraint: { values: ["A", "B", "C", "D"] } })
      .build();

    const result = diffModels(existing, incoming);
    const delta = result.deltas.find((d) => d.name === "Rating");
    expect(delta!.kind).toBe("modified");
    expect(delta!.changes).toContain("value constraint changed");
  });

  it("detects fact type definition change", () => {
    const existing = new ModelBuilder("Test")
      .withEntityType("Customer", { referenceMode: "customer_id" })
      .withEntityType("Order", { referenceMode: "order_number" })
      .withBinaryFactType("Customer places Order", {
        role1: { player: "Customer", name: "places" },
        role2: { player: "Order", name: "is placed by" },
        definition: "A customer submits an order.",
      })
      .build();
    const incoming = new ModelBuilder("Test")
      .withEntityType("Customer", { referenceMode: "customer_id" })
      .withEntityType("Order", { referenceMode: "order_number" })
      .withBinaryFactType("Customer places Order", {
        role1: { player: "Customer", name: "places" },
        role2: { player: "Order", name: "is placed by" },
        definition: "A customer creates an order.",
      })
      .build();

    const result = diffModels(existing, incoming);
    const delta = result.deltas.find(
      (d) => d.elementType === "fact_type" && d.kind === "modified",
    );
    expect(delta).toBeDefined();
    expect(delta!.changes).toContain("definition changed");
  });

  it("detects fact type role player changes", () => {
    const existing = new ModelBuilder("Test")
      .withEntityType("Customer", { referenceMode: "customer_id" })
      .withEntityType("Order", { referenceMode: "order_number" })
      .withEntityType("Agent", { referenceMode: "agent_id" })
      .withBinaryFactType("Customer places Order", {
        role1: { player: "Customer", name: "places" },
        role2: { player: "Order", name: "is placed by" },
      })
      .build();
    const incoming = new ModelBuilder("Test")
      .withEntityType("Customer", { referenceMode: "customer_id" })
      .withEntityType("Order", { referenceMode: "order_number" })
      .withEntityType("Agent", { referenceMode: "agent_id" })
      .withBinaryFactType("Customer places Order", {
        role1: { player: "Agent", name: "places" },
        role2: { player: "Order", name: "is placed by" },
      })
      .build();

    const result = diffModels(existing, incoming);
    const delta = result.deltas.find(
      (d) => d.elementType === "fact_type" && d.kind === "modified",
    );
    expect(delta).toBeDefined();
    expect(delta!.changes.some((c) => c.includes("player Customer -> Agent"))).toBe(true);
  });

  it("detects fact type role name changes", () => {
    const existing = new ModelBuilder("Test")
      .withEntityType("Customer", { referenceMode: "customer_id" })
      .withEntityType("Order", { referenceMode: "order_number" })
      .withBinaryFactType("Customer places Order", {
        role1: { player: "Customer", name: "places" },
        role2: { player: "Order", name: "is placed by" },
      })
      .build();
    const incoming = new ModelBuilder("Test")
      .withEntityType("Customer", { referenceMode: "customer_id" })
      .withEntityType("Order", { referenceMode: "order_number" })
      .withBinaryFactType("Customer places Order", {
        role1: { player: "Customer", name: "submits" },
        role2: { player: "Order", name: "is submitted by" },
      })
      .build();

    const result = diffModels(existing, incoming);
    const delta = result.deltas.find(
      (d) => d.elementType === "fact_type" && d.kind === "modified",
    );
    expect(delta).toBeDefined();
    expect(delta!.changes.some((c) => c.includes('"places" -> "submits"'))).toBe(true);
    expect(delta!.changes.some((c) => c.includes('"is placed by" -> "is submitted by"'))).toBe(true);
  });

  it("detects constraint additions and removals on fact types", () => {
    const existing = new ModelBuilder("Test")
      .withEntityType("Customer", { referenceMode: "customer_id" })
      .withEntityType("Order", { referenceMode: "order_number" })
      .withBinaryFactType("Customer places Order", {
        role1: { player: "Customer", name: "places" },
        role2: { player: "Order", name: "is placed by" },
        uniqueness: "role2",
      })
      .build();
    const incoming = new ModelBuilder("Test")
      .withEntityType("Customer", { referenceMode: "customer_id" })
      .withEntityType("Order", { referenceMode: "order_number" })
      .withBinaryFactType("Customer places Order", {
        role1: { player: "Customer", name: "places" },
        role2: { player: "Order", name: "is placed by" },
        mandatory: "role2",
      })
      .build();

    const result = diffModels(existing, incoming);
    const delta = result.deltas.find(
      (d) => d.elementType === "fact_type" && d.kind === "modified",
    );
    expect(delta).toBeDefined();
    expect(delta!.changes.some((c) => c.includes("constraints added"))).toBe(true);
    expect(delta!.changes.some((c) => c.includes("constraints removed"))).toBe(true);
  });

  it("detects definition context change", () => {
    const existing = new ModelBuilder("Test")
      .withDefinition("Customer", "A buyer.", "CRM")
      .build();
    const incoming = new ModelBuilder("Test")
      .withDefinition("Customer", "A buyer.", "Sales")
      .build();

    const result = diffModels(existing, incoming);
    const delta = result.deltas.find(
      (d) => d.elementType === "definition" && d.kind === "modified",
    );
    expect(delta).toBeDefined();
    expect(delta!.changes).toContain('context: "CRM" -> "Sales"');
  });

  it("detects added data type on value type", () => {
    const existing = new ModelBuilder("Test")
      .withValueType("Price")
      .build();
    const incoming = new ModelBuilder("Test")
      .withValueType("Price", { dataType: { name: "decimal", length: 10, scale: 2 } })
      .build();

    const result = diffModels(existing, incoming);
    const delta = result.deltas.find((d) => d.name === "Price");
    expect(delta!.kind).toBe("modified");
    expect(delta!.changes.some((c) => c.includes("data type added"))).toBe(true);
  });

  it("detects changed data type on value type", () => {
    const existing = new ModelBuilder("Test")
      .withValueType("Age", { dataType: { name: "text" } })
      .build();
    const incoming = new ModelBuilder("Test")
      .withValueType("Age", { dataType: { name: "integer" } })
      .build();

    const result = diffModels(existing, incoming);
    const delta = result.deltas.find((d) => d.name === "Age");
    expect(delta!.kind).toBe("modified");
    expect(delta!.changes.some((c) => c.includes("data type: text -> integer"))).toBe(true);
  });

  it("detects removed data type on value type", () => {
    const existing = new ModelBuilder("Test")
      .withValueType("Code", { dataType: { name: "text", length: 10 } })
      .build();
    const incoming = new ModelBuilder("Test")
      .withValueType("Code")
      .build();

    const result = diffModels(existing, incoming);
    const delta = result.deltas.find((d) => d.name === "Code");
    expect(delta!.kind).toBe("modified");
    expect(delta!.changes.some((c) => c.includes("data type removed"))).toBe(true);
  });

  it("reports no change when data types are identical", () => {
    const existing = new ModelBuilder("Test")
      .withValueType("Price", { dataType: { name: "decimal", length: 10, scale: 2 } })
      .build();
    const incoming = new ModelBuilder("Test")
      .withValueType("Price", { dataType: { name: "decimal", length: 10, scale: 2 } })
      .build();

    const result = diffModels(existing, incoming);
    const delta = result.deltas.find((d) => d.name === "Price");
    expect(delta!.kind).toBe("unchanged");
  });

  // --- Alias diff tests ---

  it("detects added aliases on an object type", () => {
    const existing = new ModelBuilder("Test")
      .withEntityType("Customer", { referenceMode: "customer_id" })
      .build();
    const incoming = new ModelBuilder("Test")
      .withEntityType("Customer", {
        referenceMode: "customer_id",
        aliases: ["Client"],
      })
      .build();

    const result = diffModels(existing, incoming);
    const delta = result.deltas.find((d) => d.name === "Customer");
    expect(delta!.kind).toBe("modified");
    expect(delta!.changes.some((c) => c.includes("aliases"))).toBe(true);
  });

  it("detects removed aliases on an object type", () => {
    const existing = new ModelBuilder("Test")
      .withEntityType("Customer", {
        referenceMode: "customer_id",
        aliases: ["Client", "Account"],
      })
      .build();
    const incoming = new ModelBuilder("Test")
      .withEntityType("Customer", { referenceMode: "customer_id" })
      .build();

    const result = diffModels(existing, incoming);
    const delta = result.deltas.find((d) => d.name === "Customer");
    expect(delta!.kind).toBe("modified");
    expect(delta!.changes.some((c) => c.includes("aliases"))).toBe(true);
  });

  it("detects changed aliases on an object type", () => {
    const existing = new ModelBuilder("Test")
      .withEntityType("Customer", {
        referenceMode: "customer_id",
        aliases: ["Client"],
      })
      .build();
    const incoming = new ModelBuilder("Test")
      .withEntityType("Customer", {
        referenceMode: "customer_id",
        aliases: ["Account"],
      })
      .build();

    const result = diffModels(existing, incoming);
    const delta = result.deltas.find((d) => d.name === "Customer");
    expect(delta!.kind).toBe("modified");
    expect(delta!.changes.some((c) => c.includes("aliases"))).toBe(true);
  });

  it("reports no change when aliases are the same but in different order", () => {
    const existing = new ModelBuilder("Test")
      .withEntityType("Customer", {
        referenceMode: "customer_id",
        aliases: ["Client", "Account"],
      })
      .build();
    const incoming = new ModelBuilder("Test")
      .withEntityType("Customer", {
        referenceMode: "customer_id",
        aliases: ["Account", "Client"],
      })
      .build();

    const result = diffModels(existing, incoming);
    const delta = result.deltas.find((d) => d.name === "Customer");
    expect(delta!.kind).toBe("unchanged");
  });

  it("reports no change when both have no aliases", () => {
    const existing = new ModelBuilder("Test")
      .withEntityType("Customer", { referenceMode: "customer_id" })
      .build();
    const incoming = new ModelBuilder("Test")
      .withEntityType("Customer", { referenceMode: "customer_id" })
      .build();

    const result = diffModels(existing, incoming);
    const delta = result.deltas.find((d) => d.name === "Customer");
    expect(delta!.kind).toBe("unchanged");
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
