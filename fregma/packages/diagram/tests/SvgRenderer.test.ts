/**
 * Tests for the SVG renderer.
 *
 * renderSvg takes a PositionedGraph (nodes with x/y coordinates, edges
 * with point arrays) and produces an SVG document string. These tests
 * verify correct rendering of:
 *   - Entity types (rounded rectangles with reference modes)
 *   - Value types (dashed ellipses)
 *   - Role boxes within fact type nodes
 *   - Uniqueness bars and mandatory dots on roles
 *   - Spanning uniqueness bars across all roles
 *   - Edge paths connecting nodes
 *   - XML character escaping in names
 *   - Empty graphs
 */
import { describe, it, expect } from "vitest";
import { renderSvg } from "../src/render/SvgRenderer.js";
import type { PositionedGraph } from "../src/layout/LayoutTypes.js";

/** A positioned graph with one entity type, one value type, and one fact type. */
function makeMinimalGraph(): PositionedGraph {
  return {
    width: 400,
    height: 300,
    subtypeEdges: [],
    nodes: [
      {
        kind: "object_type",
        id: "ot-1",
        name: "Customer",
        objectTypeKind: "entity",
        referenceMode: "customer_id",
        x: 50,
        y: 50,
        width: 120,
        height: 40,
      },
      {
        kind: "object_type",
        id: "ot-2",
        name: "Name",
        objectTypeKind: "value",
        x: 250,
        y: 50,
        width: 90,
        height: 40,
      },
      {
        kind: "fact_type",
        id: "ft-1",
        name: "Customer has Name",
        hasSpanningUniqueness: false,
        x: 100,
        y: 150,
        width: 72,
        height: 28,
        roles: [
          {
            roleId: "r-1",
            roleName: "has",
            playerName: "Customer",
            hasUniqueness: true,
            isMandatory: true,
            x: 0,
            y: 0,
            width: 36,
            height: 28,
          },
          {
            roleId: "r-2",
            roleName: "is of",
            playerName: "Name",
            hasUniqueness: false,
            isMandatory: false,
            x: 36,
            y: 0,
            width: 36,
            height: 28,
          },
        ],
      },
    ],
    edges: [
      {
        sourceNodeId: "ot-1",
        targetNodeId: "ft-1",
        roleId: "r-1",
        points: [
          { x: 110, y: 90 },
          { x: 118, y: 164 },
        ],
      },
      {
        sourceNodeId: "ot-2",
        targetNodeId: "ft-1",
        roleId: "r-2",
        points: [
          { x: 295, y: 90 },
          { x: 154, y: 164 },
        ],
      },
    ],
  };
}

describe("SvgRenderer", () => {
  it("produces a valid SVG document", () => {
    const svg = renderSvg(makeMinimalGraph());
    expect(svg).toContain("<svg");
    expect(svg).toContain("</svg>");
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
  });

  it("renders entity types as rounded rectangles", () => {
    const svg = renderSvg(makeMinimalGraph());
    // Entity types use <rect> with rx/ry.
    expect(svg).toContain('data-kind="object_type"');
    expect(svg).toMatch(/rx="6"/);
  });

  it("renders value types as dashed ellipses", () => {
    const svg = renderSvg(makeMinimalGraph());
    expect(svg).toContain("<ellipse");
    expect(svg).toContain("stroke-dasharray");
  });

  it("renders the object type name", () => {
    const svg = renderSvg(makeMinimalGraph());
    expect(svg).toContain("Customer");
    expect(svg).toContain("Name");
  });

  it("renders the reference mode for entity types", () => {
    const svg = renderSvg(makeMinimalGraph());
    expect(svg).toContain("(customer_id)");
  });

  it("renders role boxes", () => {
    const svg = renderSvg(makeMinimalGraph());
    // Two role boxes = at least two rect elements with role dimensions.
    const roleRects = svg.match(/width="36" height="28"/g);
    expect(roleRects).not.toBeNull();
    expect(roleRects!.length).toBeGreaterThanOrEqual(2);
  });

  it("renders uniqueness bars for unique roles", () => {
    const svg = renderSvg(makeMinimalGraph());
    // Uniqueness bar is a small rect above the role box.
    // r-1 has uniqueness, so there should be a bar.
    expect(svg).toContain('fill="#3a86c8"');
  });

  it("renders mandatory dots", () => {
    const svg = renderSvg(makeMinimalGraph());
    // r-1 is mandatory, so there should be a circle.
    expect(svg).toContain("<circle");
  });

  it("renders edges as paths", () => {
    const svg = renderSvg(makeMinimalGraph());
    expect(svg).toContain("<path");
    expect(svg).toMatch(/d="M \d/);
  });

  it("renders the fact type name label", () => {
    const svg = renderSvg(makeMinimalGraph());
    expect(svg).toContain("Customer has Name");
  });

  it("renders spanning uniqueness bar across all roles", () => {
    const graph = makeMinimalGraph();
    // Modify the fact type to have spanning uniqueness.
    const mutableNodes = [...graph.nodes];
    const ft = mutableNodes[2];
    if (ft?.kind === "fact_type") {
      mutableNodes[2] = { ...ft, hasSpanningUniqueness: true };
    }
    const modified: PositionedGraph = { ...graph, nodes: mutableNodes };
    const svg = renderSvg(modified);
    // Spanning bar has a distinct color.
    expect(svg).toContain('fill="#e8703a"');
  });

  it("escapes special XML characters in names", () => {
    const graph: PositionedGraph = {
      width: 200,
      height: 100,
      nodes: [
        {
          kind: "object_type",
          id: "ot-x",
          name: "A<B&C",
          objectTypeKind: "entity",
          referenceMode: 'ref "mode"',
          x: 10,
          y: 10,
          width: 100,
          height: 40,
        },
      ],
      edges: [],
      subtypeEdges: [],
    };
    const svg = renderSvg(graph);
    expect(svg).toContain("A&lt;B&amp;C");
    expect(svg).toContain("(ref &quot;mode&quot;)");
    expect(svg).not.toContain("A<B&C");
  });

  it("renders subtype edges with arrow markers", () => {
    const graph: PositionedGraph = {
      width: 400,
      height: 300,
      nodes: [
        {
          kind: "object_type",
          id: "ot-person",
          name: "Person",
          objectTypeKind: "entity",
          referenceMode: "person_id",
          x: 100,
          y: 50,
          width: 120,
          height: 40,
        },
        {
          kind: "object_type",
          id: "ot-employee",
          name: "Employee",
          objectTypeKind: "entity",
          referenceMode: "employee_id",
          x: 100,
          y: 200,
          width: 120,
          height: 40,
        },
      ],
      edges: [],
      subtypeEdges: [
        {
          subtypeNodeId: "ot-employee",
          supertypeNodeId: "ot-person",
          providesIdentification: true,
          points: [
            { x: 160, y: 200 },
            { x: 160, y: 90 },
          ],
        },
      ],
    };
    const svg = renderSvg(graph);

    // Should have an arrowhead marker definition.
    expect(svg).toContain("<defs>");
    expect(svg).toContain('id="subtype-arrow"');
    expect(svg).toContain("</defs>");

    // Should render a path with data-kind="subtype".
    expect(svg).toContain('data-kind="subtype"');
    expect(svg).toContain('marker-end="url(#subtype-arrow)"');

    // Should use the subtype color.
    expect(svg).toContain('stroke="#3a86c8"');
  });

  it("skips subtype edge rendering when points are insufficient", () => {
    const graph: PositionedGraph = {
      width: 200,
      height: 200,
      nodes: [],
      edges: [],
      subtypeEdges: [
        {
          subtypeNodeId: "ot-a",
          supertypeNodeId: "ot-b",
          providesIdentification: true,
          points: [{ x: 50, y: 50 }], // Only 1 point, needs 2.
        },
      ],
    };
    const svg = renderSvg(graph);
    // Arrow defs should still be present (we have subtype edges).
    expect(svg).toContain("subtype-arrow");
    // But no path should be rendered for the degenerate edge.
    expect(svg).not.toContain('data-kind="subtype"');
  });

  it("omits subtype arrow defs when no subtype edges exist", () => {
    const svg = renderSvg(makeMinimalGraph());
    expect(svg).not.toContain("<defs>");
    expect(svg).not.toContain("subtype-arrow");
  });

  it("handles empty graphs", () => {
    const graph: PositionedGraph = {
      width: 0,
      height: 0,
      nodes: [],
      edges: [],
      subtypeEdges: [],
    };
    const svg = renderSvg(graph);
    expect(svg).toContain("<svg");
    expect(svg).toContain("</svg>");
  });
});
