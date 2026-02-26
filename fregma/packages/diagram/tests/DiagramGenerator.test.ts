/**
 * Tests for the end-to-end diagram generator.
 *
 * generateDiagram takes an OrmModel and produces an SVG string plus
 * layout metadata, composing the ModelToGraph -> ElkLayoutEngine ->
 * SvgRenderer pipeline. These tests verify:
 *   - Valid SVG output for various model shapes
 *   - Correct node counts (one per object type + one per fact type)
 *   - Edge counts matching role counts
 *   - Layout dimensions are positive and reasonable
 */
import { describe, it, expect } from "vitest";
import { generateDiagram } from "../src/DiagramGenerator.js";
import { ModelBuilder } from "../../core/tests/helpers/ModelBuilder.js";

describe("DiagramGenerator (end-to-end)", () => {
  it("generates a complete SVG from a model", async () => {
    const model = new ModelBuilder("Order Management")
      .withEntityType("Customer", { referenceMode: "customer_id" })
      .withEntityType("Order", { referenceMode: "order_number" })
      .withBinaryFactType("Customer places Order", {
        role1: { player: "Customer", name: "places" },
        role2: { player: "Order", name: "is placed by" },
        uniqueness: "role2",
        mandatory: "role2",
      })
      .build();

    const result = await generateDiagram(model);

    // SVG should be a valid document.
    expect(result.svg).toContain("<svg");
    expect(result.svg).toContain("</svg>");

    // Should contain the object type names.
    expect(result.svg).toContain("Customer");
    expect(result.svg).toContain("Order");

    // Should contain the fact type name.
    expect(result.svg).toContain("Customer places Order");

    // Layout should have positioned nodes.
    expect(result.layout.nodes).toHaveLength(3);
    expect(result.layout.edges).toHaveLength(2);
    expect(result.layout.width).toBeGreaterThan(0);
    expect(result.layout.height).toBeGreaterThan(0);

    // Graph should be available.
    expect(result.graph.nodes).toHaveLength(3);
    expect(result.graph.edges).toHaveLength(2);
  });

  it("generates a diagram with value types", async () => {
    const model = new ModelBuilder("Test")
      .withEntityType("Customer", { referenceMode: "cid" })
      .withValueType("Name")
      .withBinaryFactType("Customer has Name", {
        role1: { player: "Customer", name: "has" },
        role2: { player: "Name", name: "is of" },
        uniqueness: "role1",
        mandatory: "role1",
      })
      .build();

    const result = await generateDiagram(model);

    // Should contain entity-style rendering (rounded rect).
    expect(result.svg).toContain("Customer");
    // Should contain value-style rendering (ellipse).
    expect(result.svg).toContain("<ellipse");
    expect(result.svg).toContain("Name");
  });

  it("generates a diagram for a model with multiple fact types", async () => {
    const model = new ModelBuilder("Complex")
      .withEntityType("Customer", { referenceMode: "cid" })
      .withEntityType("Order", { referenceMode: "oid" })
      .withValueType("Name")
      .withValueType("Date")
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
        mandatory: "role1",
      })
      .withBinaryFactType("Order placed on Date", {
        role1: { player: "Order", name: "is placed on" },
        role2: { player: "Date", name: "is date of" },
        uniqueness: "role1",
        mandatory: "role1",
      })
      .build();

    const result = await generateDiagram(model);

    expect(result.layout.nodes).toHaveLength(7); // 4 OTs + 3 FTs
    expect(result.layout.edges).toHaveLength(6); // 2 per FT

    // All nodes should have positive positions.
    for (const node of result.layout.nodes) {
      expect(node.x).toBeGreaterThanOrEqual(0);
      expect(node.y).toBeGreaterThanOrEqual(0);
      expect(node.width).toBeGreaterThan(0);
      expect(node.height).toBeGreaterThan(0);
    }
  });

  it("handles an empty model", async () => {
    const model = new ModelBuilder("Empty").build();
    const result = await generateDiagram(model);

    expect(result.svg).toContain("<svg");
    expect(result.layout.nodes).toHaveLength(0);
    expect(result.layout.edges).toHaveLength(0);
  });

  it("generates a diagram with subtype relationships", async () => {
    const model = new ModelBuilder("Subtypes")
      .withEntityType("Person", { referenceMode: "person_id" })
      .withEntityType("Employee", { referenceMode: "employee_id" })
      .withEntityType("Manager", { referenceMode: "manager_id" })
      .withSubtypeFact("Employee", "Person")
      .withSubtypeFact("Manager", "Employee")
      .build();

    const result = await generateDiagram(model);

    // SVG should contain all entity names.
    expect(result.svg).toContain("Person");
    expect(result.svg).toContain("Employee");
    expect(result.svg).toContain("Manager");

    // Graph should have 3 nodes, 0 role edges, 2 subtype edges.
    expect(result.graph.nodes).toHaveLength(3);
    expect(result.graph.edges).toHaveLength(0);
    expect(result.graph.subtypeEdges).toHaveLength(2);

    // Layout should position 2 subtype edges with routing points.
    expect(result.layout.subtypeEdges).toHaveLength(2);
    for (const se of result.layout.subtypeEdges) {
      expect(se.points.length).toBeGreaterThanOrEqual(2);
    }

    // SVG should contain subtype arrow marker.
    expect(result.svg).toContain("subtype-arrow");
    expect(result.svg).toContain('data-kind="subtype"');
  });

  it("generates a diagram with subtypes and fact types together", async () => {
    const model = new ModelBuilder("Mixed")
      .withEntityType("Person", { referenceMode: "person_id" })
      .withEntityType("Employee", { referenceMode: "employee_id" })
      .withValueType("Name")
      .withSubtypeFact("Employee", "Person")
      .withBinaryFactType("Person has Name", {
        role1: { player: "Person", name: "has" },
        role2: { player: "Name", name: "is of" },
        uniqueness: "role1",
        mandatory: "role1",
      })
      .build();

    const result = await generateDiagram(model);

    // 3 OT nodes + 1 FT node = 4 nodes.
    expect(result.graph.nodes).toHaveLength(4);
    // 2 role edges + 1 subtype edge.
    expect(result.graph.edges).toHaveLength(2);
    expect(result.graph.subtypeEdges).toHaveLength(1);

    // Layout should include both edge types.
    expect(result.layout.edges).toHaveLength(2);
    expect(result.layout.subtypeEdges).toHaveLength(1);

    // SVG should contain both role edges and subtype arrows.
    expect(result.svg).toContain('data-kind="subtype"');
    expect(result.svg).toContain("Person");
    expect(result.svg).toContain("Employee");
    expect(result.svg).toContain("Name");
  });

  it("generates a diagram with external uniqueness constraints", async () => {
    const model = new ModelBuilder("External Uniqueness")
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

    // Add external uniqueness across FirstName and LastName roles.
    const ft1 = model.getFactTypeByName("Employee has FirstName")!;
    const ft2 = model.getFactTypeByName("Employee has LastName")!;
    ft1.addConstraint({
      type: "external_uniqueness",
      roleIds: [ft1.roles[1]!.id, ft2.roles[1]!.id],
    });

    const result = await generateDiagram(model);

    // Graph: 3 OTs + 2 FTs + 1 constraint node = 6 nodes.
    expect(result.graph.nodes).toHaveLength(6);
    expect(result.graph.constraintEdges).toHaveLength(2);

    // Layout should position constraint node and edges.
    const constraintNodes = result.layout.nodes.filter(
      (n) => n.kind === "constraint",
    );
    expect(constraintNodes).toHaveLength(1);
    expect(result.layout.constraintEdges).toHaveLength(2);

    // SVG should contain constraint rendering.
    expect(result.svg).toContain('data-kind="constraint"');
    expect(result.svg).toContain('data-kind="constraint-edge"');
    expect(result.svg).toContain('stroke-dasharray="4,3"');
  });

  it("includes constraint markers in the SVG", async () => {
    const model = new ModelBuilder("Constraints")
      .withEntityType("Customer", { referenceMode: "cid" })
      .withEntityType("Order", { referenceMode: "oid" })
      .withBinaryFactType("Customer places Order", {
        role1: { player: "Customer", name: "places" },
        role2: { player: "Order", name: "is placed by" },
        uniqueness: "both",  // Both roles unique.
        mandatory: "both",   // Both roles mandatory.
      })
      .build();

    const result = await generateDiagram(model);

    // Uniqueness bars (blue fill).
    const uniquenessBars = (result.svg.match(/#3a86c8/g) ?? []).length;
    expect(uniquenessBars).toBeGreaterThanOrEqual(2);

    // Mandatory dots (circles).
    const mandatoryDots = (result.svg.match(/<circle/g) ?? []).length;
    expect(mandatoryDots).toBeGreaterThanOrEqual(2);
  });
});
