/**
 * Tests for diagram layout serialization and deserialization.
 *
 * Diagram layouts store element positions (keyed by name, integer pixels)
 * and fact type orientation overrides in the .orm.yaml file.
 */
import { describe, expect, it } from "vitest";
import { OrmModel } from "../../src/model/OrmModel.js";
import { OrmYamlSerializer } from "../../src/serialization/OrmYamlSerializer.js";

describe("DiagramLayout Serialization", () => {
  const serializer = new OrmYamlSerializer();

  describe("serialize", () => {
    it("omits diagrams section when no layouts exist", () => {
      const model = new OrmModel({ name: "Test" });
      const yaml = serializer.serialize(model);
      expect(yaml).not.toContain("diagrams:");
    });

    it("serializes a diagram layout with positions", () => {
      const model = new OrmModel({ name: "Test" });
      model.addDiagramLayout({
        name: "Default",
        positions: {
          Customer: { x: 100, y: 200 },
          Order: { x: 400, y: 200 },
        },
        orientations: {},
      });

      const yaml = serializer.serialize(model);
      expect(yaml).toContain("diagrams:");
      expect(yaml).toContain("name: Default");
      expect(yaml).toContain("Customer:");
      expect(yaml).toContain("x: 100");
      expect(yaml).toContain("y: 200");
      expect(yaml).toContain("Order:");
      expect(yaml).toContain("x: 400");
    });

    it("serializes orientation overrides", () => {
      const model = new OrmModel({ name: "Test" });
      model.addDiagramLayout({
        name: "Default",
        positions: {},
        orientations: {
          "Customer places Order": "vertical",
        },
      });

      const yaml = serializer.serialize(model);
      expect(yaml).toContain("orientations:");
      expect(yaml).toContain("Customer places Order: vertical");
    });

    it("rounds fractional positions to integers", () => {
      const model = new OrmModel({ name: "Test" });
      model.addDiagramLayout({
        name: "Default",
        positions: {
          Customer: { x: 99.7, y: 200.3 },
        },
        orientations: {},
      });

      const yaml = serializer.serialize(model);
      expect(yaml).toContain("x: 100");
      expect(yaml).toContain("y: 200");
    });

    it("omits empty positions and orientations", () => {
      const model = new OrmModel({ name: "Test" });
      model.addDiagramLayout({
        name: "Default",
        positions: {},
        orientations: {},
      });

      const yaml = serializer.serialize(model);
      expect(yaml).toContain("name: Default");
      expect(yaml).not.toContain("positions:");
      expect(yaml).not.toContain("orientations:");
    });
  });

  describe("deserialize", () => {
    it("deserializes a diagram layout with positions and orientations", () => {
      const yaml = `
orm_version: "1.0"
model:
  name: Test
  diagrams:
    - name: Default
      positions:
        Customer:
          x: 100
          y: 200
        Order:
          x: 400
          y: 200
      orientations:
        Customer places Order: vertical
`;
      const model = serializer.deserialize(yaml);
      const layouts = model.diagramLayouts;
      expect(layouts).toHaveLength(1);

      const layout = layouts[0]!;
      expect(layout.name).toBe("Default");
      expect(layout.positions).toEqual({
        Customer: { x: 100, y: 200 },
        Order: { x: 400, y: 200 },
      });
      expect(layout.orientations).toEqual({
        "Customer places Order": "vertical",
      });
    });

    it("deserializes a layout with no positions or orientations", () => {
      const yaml = `
orm_version: "1.0"
model:
  name: Test
  diagrams:
    - name: Overview
`;
      const model = serializer.deserialize(yaml);
      const layout = model.getDiagramLayout("Overview");
      expect(layout).toBeDefined();
      expect(layout!.positions).toEqual({});
      expect(layout!.orientations).toEqual({});
    });
  });

  describe("round-trip", () => {
    it("preserves diagram layout through serialize/deserialize", () => {
      const model = new OrmModel({ name: "RoundTrip" });
      model.addDiagramLayout({
        name: "Default",
        positions: {
          Customer: { x: 100, y: 200 },
          Order: { x: 400, y: 200 },
          Product: { x: 250, y: 500 },
        },
        orientations: {
          "Customer places Order": "vertical",
          "Order contains Product": "horizontal",
        },
      });

      const yaml = serializer.serialize(model);
      const restored = serializer.deserialize(yaml);

      expect(restored.diagramLayouts).toHaveLength(1);
      const layout = restored.getDiagramLayout("Default")!;
      expect(layout.positions).toEqual({
        Customer: { x: 100, y: 200 },
        Order: { x: 400, y: 200 },
        Product: { x: 250, y: 500 },
      });
      expect(layout.orientations).toEqual({
        "Customer places Order": "vertical",
        "Order contains Product": "horizontal",
      });
    });

    it("preserves multiple diagram layouts", () => {
      const model = new OrmModel({ name: "MultiView" });
      model.addDiagramLayout({
        name: "Overview",
        positions: { Customer: { x: 100, y: 100 } },
        orientations: {},
      });
      model.addDiagramLayout({
        name: "Detail",
        positions: { Order: { x: 200, y: 300 } },
        orientations: { "Customer places Order": "vertical" },
      });

      const yaml = serializer.serialize(model);
      const restored = serializer.deserialize(yaml);

      expect(restored.diagramLayouts).toHaveLength(2);
      expect(restored.getDiagramLayout("Overview")).toBeDefined();
      expect(restored.getDiagramLayout("Detail")).toBeDefined();
    });
  });
});
