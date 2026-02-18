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
