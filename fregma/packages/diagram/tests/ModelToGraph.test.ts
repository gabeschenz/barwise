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
    expect(graph.subtypeEdges).toHaveLength(0);
  });

  it("creates subtype edges from SubtypeFacts", () => {
    const model = new ModelBuilder("Subtypes")
      .withEntityType("Person", { referenceMode: "person_id" })
      .withEntityType("Employee", { referenceMode: "employee_id" })
      .withSubtypeFact("Employee", "Person")
      .build();

    const graph = modelToGraph(model);

    // 2 object type nodes, no fact types.
    expect(graph.nodes).toHaveLength(2);
    expect(graph.edges).toHaveLength(0);

    // 1 subtype edge.
    expect(graph.subtypeEdges).toHaveLength(1);

    const se = graph.subtypeEdges[0]!;
    const employee = model.getObjectTypeByName("Employee")!;
    const person = model.getObjectTypeByName("Person")!;
    expect(se.subtypeNodeId).toBe(employee.id);
    expect(se.supertypeNodeId).toBe(person.id);
    expect(se.providesIdentification).toBe(true);
  });

  it("creates subtype edges with providesIdentification false", () => {
    const model = new ModelBuilder("Subtypes")
      .withEntityType("Animal", { referenceMode: "animal_id" })
      .withEntityType("Pet", { referenceMode: "pet_id" })
      .withSubtypeFact("Pet", "Animal", { providesIdentification: false })
      .build();

    const graph = modelToGraph(model);
    expect(graph.subtypeEdges).toHaveLength(1);
    expect(graph.subtypeEdges[0]!.providesIdentification).toBe(false);
  });

  it("creates constraint nodes and edges for external uniqueness", () => {
    const model = new ModelBuilder("ExtUniq")
      .withEntityType("Employee", { referenceMode: "emp_id" })
      .withValueType("FirstName")
      .withValueType("LastName")
      .withBinaryFactType("Employee has FirstName", {
        role1: { player: "Employee", name: "has" },
        role2: { player: "FirstName", name: "is of" },
      })
      .withBinaryFactType("Employee has LastName", {
        role1: { player: "Employee", name: "has" },
        role2: { player: "LastName", name: "is of" },
      })
      .build();

    // Add an external uniqueness across the two "name" roles.
    const ft1 = model.getFactTypeByName("Employee has FirstName")!;
    const ft2 = model.getFactTypeByName("Employee has LastName")!;
    const fnameRoleId = ft1.roles[1]!.id; // FirstName role
    const lnameRoleId = ft2.roles[1]!.id; // LastName role
    ft1.addConstraint({
      type: "external_uniqueness",
      roleIds: [fnameRoleId, lnameRoleId],
    });

    const graph = modelToGraph(model);

    // Should have a constraint node.
    const constraintNodes = graph.nodes.filter((n) => n.kind === "constraint");
    expect(constraintNodes).toHaveLength(1);

    const cNode = constraintNodes[0]!;
    expect(cNode.kind).toBe("constraint");
    if (cNode.kind === "constraint") {
      expect(cNode.constraintKind).toBe("external_uniqueness");
      expect(cNode.roleIds).toEqual([fnameRoleId, lnameRoleId]);
    }

    // Should have 2 constraint edges (one per covered role).
    expect(graph.constraintEdges).toHaveLength(2);

    const ce1 = graph.constraintEdges.find((e) => e.roleId === fnameRoleId);
    expect(ce1).toBeDefined();
    expect(ce1!.constraintNodeId).toBe(cNode.id);
    expect(ce1!.factTypeNodeId).toBe(ft1.id);

    const ce2 = graph.constraintEdges.find((e) => e.roleId === lnameRoleId);
    expect(ce2).toBeDefined();
    expect(ce2!.constraintNodeId).toBe(cNode.id);
    expect(ce2!.factTypeNodeId).toBe(ft2.id);
  });

  it("produces empty constraintEdges when no external uniqueness exists", () => {
    const model = new ModelBuilder("NoExtUniq")
      .withEntityType("Customer", { referenceMode: "cid" })
      .withEntityType("Order", { referenceMode: "oid" })
      .withBinaryFactType("Customer places Order", {
        role1: { player: "Customer", name: "places" },
        role2: { player: "Order", name: "is placed by" },
        uniqueness: "role2",
      })
      .build();

    const graph = modelToGraph(model);
    expect(graph.constraintEdges).toHaveLength(0);

    const constraintNodes = graph.nodes.filter((n) => n.kind === "constraint");
    expect(constraintNodes).toHaveLength(0);
  });

  it("skips constraint edges for roles not found in any fact type", () => {
    const model = new ModelBuilder("Orphan")
      .withEntityType("A", { referenceMode: "a_id" })
      .withValueType("B")
      .withBinaryFactType("A has B", {
        role1: { player: "A", name: "has" },
        role2: { player: "B", name: "is of" },
      })
      .build();

    // Add an external uniqueness referencing a non-existent role.
    const ft = model.getFactTypeByName("A has B")!;
    const realRoleId = ft.roles[0]!.id;
    ft.addConstraint({
      type: "external_uniqueness",
      roleIds: [realRoleId, "non-existent-role"],
    });

    const graph = modelToGraph(model);

    // Constraint node still created.
    const constraintNodes = graph.nodes.filter((n) => n.kind === "constraint");
    expect(constraintNodes).toHaveLength(1);

    // Only 1 constraint edge (for the real role), not 2.
    expect(graph.constraintEdges).toHaveLength(1);
    expect(graph.constraintEdges[0]!.roleId).toBe(realRoleId);
  });

  it("creates multiple subtype edges for a type hierarchy", () => {
    const model = new ModelBuilder("Hierarchy")
      .withEntityType("Person", { referenceMode: "person_id" })
      .withEntityType("Employee", { referenceMode: "employee_id" })
      .withEntityType("Manager", { referenceMode: "manager_id" })
      .withSubtypeFact("Employee", "Person")
      .withSubtypeFact("Manager", "Employee")
      .build();

    const graph = modelToGraph(model);

    // 3 object type nodes, 2 subtype edges.
    expect(graph.nodes).toHaveLength(3);
    expect(graph.subtypeEdges).toHaveLength(2);

    const employee = model.getObjectTypeByName("Employee")!;
    const person = model.getObjectTypeByName("Person")!;
    const manager = model.getObjectTypeByName("Manager")!;

    // Employee -> Person.
    const empToPerson = graph.subtypeEdges.find(
      (e) => e.subtypeNodeId === employee.id,
    );
    expect(empToPerson).toBeDefined();
    expect(empToPerson!.supertypeNodeId).toBe(person.id);

    // Manager -> Employee.
    const mgrToEmp = graph.subtypeEdges.find(
      (e) => e.subtypeNodeId === manager.id,
    );
    expect(mgrToEmp).toBeDefined();
    expect(mgrToEmp!.supertypeNodeId).toBe(employee.id);
  });
});
