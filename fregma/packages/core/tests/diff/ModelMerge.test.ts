/**
 * Tests for the selective model merge engine.
 *
 * mergeModels takes an existing model, an incoming model, a list of
 * deltas (from diffModels), and a set of accepted delta indices. It
 * produces a new OrmModel that applies only the accepted changes.
 * This powers the "review and accept changes" UI for LLM re-extraction.
 * These tests verify:
 *   - No changes when nothing is accepted
 *   - Adding/removing/modifying object types, fact types, and definitions
 *   - UUID preservation (existing elements keep their IDs after merge)
 *   - Player-ID remapping (new fact types reference existing OT IDs)
 *   - Full replacement (accept all deltas)
 */
import { describe, it, expect } from "vitest";
import { ModelBuilder } from "../helpers/ModelBuilder.js";
import { diffModels } from "../../src/diff/ModelDiff.js";
import { mergeModels } from "../../src/diff/ModelMerge.js";

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

describe("mergeModels", () => {
  it("returns existing model unchanged when no deltas are accepted", () => {
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

    const diff = diffModels(existing, incoming);
    const accepted = new Set<number>(); // Nothing accepted.
    const merged = mergeModels(existing, incoming, diff.deltas, accepted);

    expect(merged.objectTypes.map((o) => o.name).sort()).toEqual(
      ["Customer", "Name", "Order"],
    );
    expect(merged.factTypes.map((f) => f.name)).toEqual(
      ["Customer places Order"],
    );
  });

  it("adds new object type when its delta is accepted", () => {
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

    const diff = diffModels(existing, incoming);
    const addedIdx = diff.deltas.findIndex(
      (d) => d.kind === "added" && d.name === "Product",
    );
    expect(addedIdx).toBeGreaterThanOrEqual(0);

    const accepted = new Set([addedIdx]);
    const merged = mergeModels(existing, incoming, diff.deltas, accepted);

    expect(merged.objectTypes.map((o) => o.name).sort()).toEqual(
      ["Customer", "Name", "Order", "Product"],
    );
  });

  it("removes object type when removal delta is accepted", () => {
    const existing = baseModel();
    // Incoming does not have Name.
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

    const diff = diffModels(existing, incoming);
    const removedIdx = diff.deltas.findIndex(
      (d) => d.kind === "removed" && d.name === "Name",
    );
    expect(removedIdx).toBeGreaterThanOrEqual(0);

    const accepted = new Set([removedIdx]);
    const merged = mergeModels(existing, incoming, diff.deltas, accepted);

    expect(merged.objectTypes.map((o) => o.name).sort()).toEqual(
      ["Customer", "Order"],
    );
  });

  it("keeps existing object type when removal delta is rejected", () => {
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

    const diff = diffModels(existing, incoming);
    const accepted = new Set<number>(); // Reject everything.
    const merged = mergeModels(existing, incoming, diff.deltas, accepted);

    expect(merged.objectTypes.map((o) => o.name).sort()).toEqual(
      ["Customer", "Name", "Order"],
    );
  });

  it("preserves existing UUIDs for modified object types", () => {
    const existing = baseModel();
    const existingCustomer = existing.getObjectTypeByName("Customer")!;

    const incoming = new ModelBuilder("Test")
      .withEntityType("Customer", {
        referenceMode: "customer_id",
        definition: "A buyer of goods",
      })
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

    const diff = diffModels(existing, incoming);
    const modifiedIdx = diff.deltas.findIndex(
      (d) => d.kind === "modified" && d.name === "Customer",
    );
    expect(modifiedIdx).toBeGreaterThanOrEqual(0);

    const accepted = new Set([modifiedIdx]);
    const merged = mergeModels(existing, incoming, diff.deltas, accepted);

    const mergedCustomer = merged.getObjectTypeByName("Customer")!;
    // UUID should be preserved from existing.
    expect(mergedCustomer.id).toBe(existingCustomer.id);
    // Content should come from incoming.
    expect(mergedCustomer.definition).toBe("A buyer of goods");
  });

  it("adds new fact type with correct role player references", () => {
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

    const diff = diffModels(existing, incoming);
    const addedIdx = diff.deltas.findIndex(
      (d) => d.kind === "added" && d.name === "Customer has Name",
    );
    const accepted = new Set([addedIdx]);
    const merged = mergeModels(existing, incoming, diff.deltas, accepted);

    expect(merged.factTypes).toHaveLength(2);
    const newFt = merged.getFactTypeByName("Customer has Name")!;
    expect(newFt).toBeDefined();

    // The role player ids should reference object types that exist in the merged model.
    for (const role of newFt.roles) {
      expect(merged.getObjectType(role.playerId)).toBeDefined();
    }
  });

  it("handles definition additions and removals independently", () => {
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
      // Replace Customer definition with Order definition.
      .withDefinition("Order", "A request to purchase goods.")
      .build();

    const diff = diffModels(existing, incoming);

    // Accept the new definition but reject the removal.
    const addedDefIdx = diff.deltas.findIndex(
      (d) => d.kind === "added" && d.elementType === "definition",
    );
    const accepted = new Set([addedDefIdx]);
    const merged = mergeModels(existing, incoming, diff.deltas, accepted);

    // Both definitions should be present.
    const terms = merged.definitions.map((d) => d.term).sort();
    expect(terms).toEqual(["Customer", "Order"]);
  });

  it("removes fact type when removal delta is accepted", () => {
    const existing = baseModel();
    const incoming = new ModelBuilder("Test")
      .withEntityType("Customer", { referenceMode: "customer_id" })
      .withEntityType("Order", { referenceMode: "order_number" })
      .withValueType("Name")
      .withDefinition("Customer", "A person or organization that purchases goods.")
      .build();

    const diff = diffModels(existing, incoming);
    const removedIdx = diff.deltas.findIndex(
      (d) => d.kind === "removed" && d.elementType === "fact_type",
    );
    expect(removedIdx).toBeGreaterThanOrEqual(0);

    const accepted = new Set([removedIdx]);
    const merged = mergeModels(existing, incoming, diff.deltas, accepted);

    expect(merged.factTypes).toHaveLength(0);
  });

  it("keeps fact type when removal delta is rejected", () => {
    const existing = baseModel();
    const incoming = new ModelBuilder("Test")
      .withEntityType("Customer", { referenceMode: "customer_id" })
      .withEntityType("Order", { referenceMode: "order_number" })
      .withValueType("Name")
      .withDefinition("Customer", "A person or organization that purchases goods.")
      .build();

    const diff = diffModels(existing, incoming);
    const accepted = new Set<number>(); // Reject everything.
    const merged = mergeModels(existing, incoming, diff.deltas, accepted);

    expect(merged.factTypes).toHaveLength(1);
    expect(merged.factTypes[0]!.name).toBe("Customer places Order");
  });

  it("applies accepted definition modification", () => {
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
      .withDefinition("Customer", "A buyer of products.")
      .build();

    const diff = diffModels(existing, incoming);
    const modIdx = diff.deltas.findIndex(
      (d) => d.kind === "modified" && d.elementType === "definition",
    );
    expect(modIdx).toBeGreaterThanOrEqual(0);

    const accepted = new Set([modIdx]);
    const merged = mergeModels(existing, incoming, diff.deltas, accepted);

    expect(merged.definitions).toHaveLength(1);
    expect(merged.definitions[0]!.definition).toBe("A buyer of products.");
  });

  it("applies modified fact type when accepted", () => {
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

    const diff = diffModels(existing, incoming);
    const modIdx = diff.deltas.findIndex(
      (d) => d.kind === "modified" && d.elementType === "fact_type",
    );
    expect(modIdx).toBeGreaterThanOrEqual(0);

    // Accept the modification.
    const accepted = new Set([modIdx]);
    const merged = mergeModels(existing, incoming, diff.deltas, accepted);

    const ft = merged.getFactTypeByName("Customer places Order")!;
    // Should keep the existing id.
    expect(ft.id).toBe(existing.getFactTypeByName("Customer places Order")!.id);
    // Should take the incoming content.
    expect(ft.roles[0]!.name).toBe("submits");
  });

  it("keeps existing fact type when modified delta is rejected", () => {
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

    const diff = diffModels(existing, incoming);
    // Reject everything.
    const merged = mergeModels(existing, incoming, diff.deltas, new Set<number>());

    const ft = merged.getFactTypeByName("Customer places Order")!;
    expect(ft.roles[0]!.name).toBe("places");
  });

  it("remaps incoming player ids when adding a fact type for existing object types", () => {
    // This exercises the resolvePlayerId incoming-id mapping path.
    const existing = new ModelBuilder("Test")
      .withEntityType("Customer", { referenceMode: "customer_id" })
      .withValueType("Name")
      .build();

    const incoming = new ModelBuilder("Test")
      .withEntityType("Customer", { referenceMode: "customer_id" })
      .withValueType("Name")
      .withBinaryFactType("Customer has Name", {
        role1: { player: "Customer", name: "has" },
        role2: { player: "Name", name: "is of" },
        uniqueness: "role1",
      })
      .build();

    const diff = diffModels(existing, incoming);
    const addedFtIdx = diff.deltas.findIndex(
      (d) => d.kind === "added" && d.elementType === "fact_type",
    );
    const accepted = new Set([addedFtIdx]);
    const merged = mergeModels(existing, incoming, diff.deltas, accepted);

    const ft = merged.getFactTypeByName("Customer has Name")!;
    expect(ft).toBeDefined();
    // Player ids should reference the existing model's object type ids.
    const existingCustomerId = existing.getObjectTypeByName("Customer")!.id;
    const existingNameId = existing.getObjectTypeByName("Name")!.id;
    expect(ft.roles[0]!.playerId).toBe(existingCustomerId);
    expect(ft.roles[1]!.playerId).toBe(existingNameId);
  });

  it("accepts all deltas to fully replace the model", () => {
    const existing = baseModel();
    const incoming = new ModelBuilder("Test")
      .withEntityType("Person", { referenceMode: "person_id" })
      .withValueType("Email")
      .withBinaryFactType("Person has Email", {
        role1: { player: "Person", name: "has" },
        role2: { player: "Email", name: "belongs to" },
        uniqueness: "role1",
      })
      .withDefinition("Person", "A human user.")
      .build();

    const diff = diffModels(existing, incoming);
    // Accept everything.
    const allIndices = new Set(diff.deltas.map((_, i) => i));
    const merged = mergeModels(existing, incoming, diff.deltas, allIndices);

    expect(merged.objectTypes.map((o) => o.name).sort()).toEqual(
      ["Email", "Person"],
    );
    expect(merged.factTypes.map((f) => f.name)).toEqual(["Person has Email"]);
    expect(merged.definitions.map((d) => d.term)).toEqual(["Person"]);
  });

  it("preserves dataType on unchanged object types", () => {
    const existing = new ModelBuilder("Test")
      .withValueType("Price", { dataType: { name: "decimal", length: 10, scale: 2 } })
      .build();
    const incoming = new ModelBuilder("Test")
      .withValueType("Price", { dataType: { name: "decimal", length: 10, scale: 2 } })
      .build();

    const diff = diffModels(existing, incoming);
    const merged = mergeModels(existing, incoming, diff.deltas, new Set());
    const price = merged.getObjectTypeByName("Price")!;
    expect(price.dataType).toBeDefined();
    expect(price.dataType!.name).toBe("decimal");
    expect(price.dataType!.length).toBe(10);
    expect(price.dataType!.scale).toBe(2);
  });

  it("propagates dataType when accepting added object type", () => {
    const existing = new ModelBuilder("Test").build();
    const incoming = new ModelBuilder("Test")
      .withValueType("Amount", { dataType: { name: "money" } })
      .build();

    const diff = diffModels(existing, incoming);
    const allIndices = new Set(diff.deltas.map((_, i) => i));
    const merged = mergeModels(existing, incoming, diff.deltas, allIndices);
    const amount = merged.getObjectTypeByName("Amount")!;
    expect(amount.dataType).toBeDefined();
    expect(amount.dataType!.name).toBe("money");
  });

  // --- Alias merge tests ---

  it("preserves aliases on unchanged object types", () => {
    const existing = new ModelBuilder("Test")
      .withEntityType("Customer", {
        referenceMode: "customer_id",
        aliases: ["Client"],
      })
      .build();
    const incoming = new ModelBuilder("Test")
      .withEntityType("Customer", {
        referenceMode: "customer_id",
        aliases: ["Client"],
      })
      .build();

    const diff = diffModels(existing, incoming);
    const merged = mergeModels(existing, incoming, diff.deltas, new Set());

    const customer = merged.getObjectTypeByName("Customer")!;
    expect(customer.aliases).toEqual(["Client"]);
  });

  it("unions aliases when accepting modified object type", () => {
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

    const diff = diffModels(existing, incoming);
    const modIdx = diff.deltas.findIndex(
      (d) => d.name === "Customer" && d.kind === "modified",
    );
    expect(modIdx).toBeGreaterThanOrEqual(0);

    const merged = mergeModels(
      existing,
      incoming,
      diff.deltas,
      new Set([modIdx]),
    );

    const customer = merged.getObjectTypeByName("Customer")!;
    // Should contain both existing and incoming aliases, deduplicated.
    expect(customer.aliases).toContain("Client");
    expect(customer.aliases).toContain("Account");
    expect(customer.aliases).toHaveLength(2);
  });

  it("keeps existing aliases when rejecting modification", () => {
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

    const diff = diffModels(existing, incoming);
    // Reject everything.
    const merged = mergeModels(existing, incoming, diff.deltas, new Set());

    const customer = merged.getObjectTypeByName("Customer")!;
    expect(customer.aliases).toEqual(["Client"]);
  });

  it("carries aliases on added object types", () => {
    const existing = new ModelBuilder("Test").build();
    const incoming = new ModelBuilder("Test")
      .withEntityType("Customer", {
        referenceMode: "customer_id",
        aliases: ["Client", "Account"],
      })
      .build();

    const diff = diffModels(existing, incoming);
    const addedIdx = diff.deltas.findIndex(
      (d) => d.kind === "added" && d.name === "Customer",
    );
    const merged = mergeModels(
      existing,
      incoming,
      diff.deltas,
      new Set([addedIdx]),
    );

    const customer = merged.getObjectTypeByName("Customer")!;
    expect(customer.aliases).toEqual(["Client", "Account"]);
  });

  it("deduplicates when unioning overlapping aliases", () => {
    const existing = new ModelBuilder("Test")
      .withEntityType("Customer", {
        referenceMode: "customer_id",
        aliases: ["Client", "Buyer"],
      })
      .build();
    const incoming = new ModelBuilder("Test")
      .withEntityType("Customer", {
        referenceMode: "customer_id",
        aliases: ["Client", "Account"],
      })
      .build();

    const diff = diffModels(existing, incoming);
    const modIdx = diff.deltas.findIndex(
      (d) => d.name === "Customer" && d.kind === "modified",
    );

    const merged = mergeModels(
      existing,
      incoming,
      diff.deltas,
      new Set([modIdx]),
    );

    const customer = merged.getObjectTypeByName("Customer")!;
    const aliases = customer.aliases!;
    // All three unique aliases should be present.
    expect(aliases).toContain("Client");
    expect(aliases).toContain("Buyer");
    expect(aliases).toContain("Account");
    expect(aliases).toHaveLength(3);
  });

  it("takes incoming dataType when accepting modification", () => {
    const existing = new ModelBuilder("Test")
      .withValueType("Code", { dataType: { name: "text" } })
      .build();
    const incoming = new ModelBuilder("Test")
      .withValueType("Code", { dataType: { name: "text", length: 10 } })
      .build();

    const diff = diffModels(existing, incoming);
    const modifiedIdx = diff.deltas.findIndex(
      (d) => d.name === "Code" && d.kind === "modified",
    );
    expect(modifiedIdx).toBeGreaterThanOrEqual(0);

    const merged = mergeModels(existing, incoming, diff.deltas, new Set([modifiedIdx]));
    const code = merged.getObjectTypeByName("Code")!;
    expect(code.dataType).toBeDefined();
    expect(code.dataType!.length).toBe(10);
  });
});
