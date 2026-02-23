/**
 * Tests for ModelToGraph, which converts an OrmModel into an OrmGraph
 * (an intermediate representation suitable for layout engines).
 *
 * The graph has two node kinds (object_type and fact_type) connected
 * by edges (one per role). Each fact_type node carries metadata about
 * its roles (uniqueness, mandatory). These tests verify:
 *   - Correct node and edge counts
 *   - Entity vs value type annotation on object_type nodes
 *   - Uniqueness and mandatory flags on role metadata
 *   - Spanning uniqueness detection
 *   - Empty models produce empty graphs
 */
import { describe, it, expect } from "vitest";
import { modelToGraph } from "../src/graph/ModelToGraph.js";
import { ModelBuilder } from "../../core/tests/helpers/ModelBuilder.js";

describe("ModelToGraph", () => {
  it("converts a simple model to graph nodes and edges", () => {
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

    const graph = modelToGraph(model);

    // 2 object types + 1 fact type = 3 nodes.
    expect(graph.nodes).toHaveLength(3);

    const otNodes = graph.nodes.filter((n) => n.kind === "object_type");
    expect(otNodes).toHaveLength(2);

    const ftNodes = graph.nodes.filter((n) => n.kind === "fact_type");
    expect(ftNodes).toHaveLength(1);

    // 2 roles = 2 edges.
    expect(graph.edges).toHaveLength(2);
  });

  it("marks entity and value types correctly", () => {
    const model = new ModelBuilder("Test")
      .withEntityType("Customer", { referenceMode: "customer_id" })
      .withValueType("Name")
      .withBinaryFactType("Customer has Name", {
        role1: { player: "Customer", name: "has" },
        role2: { player: "Name", name: "is of" },
        uniqueness: "role1",
        mandatory: "role1",
      })
      .build();

    const graph = modelToGraph(model);
    const otNodes = graph.nodes.filter((n) => n.kind === "object_type");

    const customerNode = otNodes.find(
      (n) => n.kind === "object_type" && n.name === "Customer",
    );
    expect(customerNode).toBeDefined();
    if (customerNode?.kind === "object_type") {
      expect(customerNode.objectTypeKind).toBe("entity");
      expect(customerNode.referenceMode).toBe("customer_id");
    }

    const nameNode = otNodes.find(
      (n) => n.kind === "object_type" && n.name === "Name",
    );
    expect(nameNode).toBeDefined();
    if (nameNode?.kind === "object_type") {
      expect(nameNode.objectTypeKind).toBe("value");
      expect(nameNode.referenceMode).toBeUndefined();
    }
  });

  it("detects single-role uniqueness on role boxes", () => {
    const model = new ModelBuilder("Test")
      .withEntityType("Customer", { referenceMode: "cid" })
      .withEntityType("Order", { referenceMode: "oid" })
      .withBinaryFactType("Customer places Order", {
        role1: { player: "Customer", name: "places" },
        role2: { player: "Order", name: "is placed by" },
        uniqueness: "role2",
      })
      .build();

    const graph = modelToGraph(model);
    const ftNode = graph.nodes.find((n) => n.kind === "fact_type");
    expect(ftNode).toBeDefined();
    if (ftNode?.kind === "fact_type") {
      // role1 (Customer places) has no uniqueness.
      expect(ftNode.roles[0]?.hasUniqueness).toBe(false);
      // role2 (Order is placed by) has uniqueness.
      expect(ftNode.roles[1]?.hasUniqueness).toBe(true);
    }
  });

  it("detects mandatory roles", () => {
    const model = new ModelBuilder("Test")
      .withEntityType("Customer", { referenceMode: "cid" })
      .withEntityType("Order", { referenceMode: "oid" })
      .withBinaryFactType("Customer places Order", {
        role1: { player: "Customer", name: "places" },
        role2: { player: "Order", name: "is placed by" },
        uniqueness: "role2",
        mandatory: "role2",
      })
      .build();

    const graph = modelToGraph(model);
    const ftNode = graph.nodes.find((n) => n.kind === "fact_type");
    expect(ftNode).toBeDefined();
    if (ftNode?.kind === "fact_type") {
      expect(ftNode.roles[0]?.isMandatory).toBe(false);
      expect(ftNode.roles[1]?.isMandatory).toBe(true);
    }
  });

  it("detects spanning uniqueness", () => {
    const model = new ModelBuilder("Test")
      .withEntityType("Customer", { referenceMode: "cid" })
      .withEntityType("Product", { referenceMode: "pid" })
      .withBinaryFactType("Customer reviews Product", {
        role1: { player: "Customer", name: "reviews" },
        role2: { player: "Product", name: "is reviewed by" },
        uniqueness: "spanning",
      })
      .build();

    const graph = modelToGraph(model);
    const ftNode = graph.nodes.find((n) => n.kind === "fact_type");
    expect(ftNode).toBeDefined();
    if (ftNode?.kind === "fact_type") {
      expect(ftNode.hasSpanningUniqueness).toBe(true);
      expect(ftNode.roles[0]?.hasUniqueness).toBe(false);
      expect(ftNode.roles[1]?.hasUniqueness).toBe(false);
    }
  });

  it("handles models with multiple fact types", () => {
    const model = new ModelBuilder("Test")
      .withEntityType("Customer", { referenceMode: "cid" })
      .withEntityType("Order", { referenceMode: "oid" })
      .withValueType("Name")
      .withBinaryFactType("Customer places Order", {
        role1: { player: "Customer", name: "places" },
        role2: { player: "Order", name: "is placed by" },
        uniqueness: "role2",
      })
      .withBinaryFactType("Customer has Name", {
        role1: { player: "Customer", name: "has" },
        role2: { player: "Name", name: "is of" },
        uniqueness: "role1",
      })
      .build();

    const graph = modelToGraph(model);
    expect(graph.nodes).toHaveLength(5); // 3 OTs + 2 FTs
    expect(graph.edges).toHaveLength(4); // 2 roles per FT

    // Customer should have 2 edges (one per fact type).
    const customerOt = model.getObjectTypeByName("Customer")!;
    const customerEdges = graph.edges.filter(
      (e) => e.sourceNodeId === customerOt.id,
    );
    expect(customerEdges).toHaveLength(2);
  });

  it("creates an empty graph for an empty model", () => {
    const model = new ModelBuilder("Empty").build();
    const graph = modelToGraph(model);
    expect(graph.nodes).toHaveLength(0);
    expect(graph.edges).toHaveLength(0);
  });
});
