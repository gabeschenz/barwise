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
import { describe, expect, it } from "vitest";
import type { PositionedGraph } from "../src/layout/LayoutTypes.js";
import { renderSvg } from "../src/render/SvgRenderer.js";

/** A positioned graph with one entity type, one value type, and one fact type. */
function makeMinimalGraph(): PositionedGraph {
  return {
    width: 400,
    height: 300,
    constraintEdges: [],
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
        isMandatory: true,
        points: [
          { x: 110, y: 90 },
          { x: 118, y: 164 },
        ],
      },
      {
        sourceNodeId: "ot-2",
        targetNodeId: "ft-1",
        roleId: "r-2",
        isMandatory: false,
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
      constraintEdges: [],
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
      constraintEdges: [],
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
      constraintEdges: [],
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

  it("renders constraint nodes as circled bars", () => {
    const graph: PositionedGraph = {
      width: 400,
      height: 300,
      nodes: [
        {
          kind: "constraint",
          id: "ext-uniq-0",
          constraintKind: "external_uniqueness",
          roleIds: ["r-1", "r-2"],
          x: 100,
          y: 100,
          width: 20,
          height: 20,
        },
      ],
      edges: [],
      constraintEdges: [],
      subtypeEdges: [],
    };
    const svg = renderSvg(graph);

    // Should render a circle for the constraint symbol.
    expect(svg).toContain('data-kind="constraint"');
    expect(svg).toContain("<circle");
    // Should use constraint stroke color.
    expect(svg).toContain('stroke="#8a3ac8"');
    // Should have a uniqueness bar (rect) inside.
    expect(svg).toContain("<rect");
  });

  it("renders constraint edges as dashed paths", () => {
    const graph: PositionedGraph = {
      width: 400,
      height: 300,
      nodes: [],
      edges: [],
      constraintEdges: [
        {
          constraintNodeId: "ext-uniq-0",
          factTypeNodeId: "ft-1",
          roleId: "r-1",
          points: [
            { x: 110, y: 110 },
            { x: 200, y: 164 },
          ],
        },
      ],
      subtypeEdges: [],
    };
    const svg = renderSvg(graph);

    // Should render a dashed path.
    expect(svg).toContain('data-kind="constraint-edge"');
    expect(svg).toContain('stroke-dasharray="4,3"');
    expect(svg).toContain('stroke="#8a3ac8"');
  });

  it("skips constraint edge rendering when points are insufficient", () => {
    const graph: PositionedGraph = {
      width: 200,
      height: 200,
      nodes: [],
      edges: [],
      constraintEdges: [
        {
          constraintNodeId: "ext-uniq-0",
          factTypeNodeId: "ft-1",
          roleId: "r-1",
          points: [{ x: 50, y: 50 }], // Only 1 point, needs 2.
        },
      ],
      subtypeEdges: [],
    };
    const svg = renderSvg(graph);
    // No constraint edge path should be rendered.
    expect(svg).not.toContain('data-kind="constraint-edge"');
  });

  it("renders exclusion constraint as X symbol", () => {
    const graph: PositionedGraph = {
      width: 200,
      height: 200,
      nodes: [
        {
          kind: "constraint",
          id: "c-0",
          constraintKind: "exclusion",
          roleIds: ["r-1", "r-2"],
          x: 50,
          y: 50,
          width: 20,
          height: 20,
        },
      ],
      edges: [],
      constraintEdges: [],
      subtypeEdges: [],
    };
    const svg = renderSvg(graph);
    expect(svg).toContain('data-constraint-kind="exclusion"');
    // X is drawn with two <line> elements.
    expect(svg).toContain("<line");
  });

  it("renders exclusive-or constraint as X with mandatory dot", () => {
    const graph: PositionedGraph = {
      width: 200,
      height: 200,
      nodes: [
        {
          kind: "constraint",
          id: "c-0",
          constraintKind: "exclusive_or",
          roleIds: ["r-1", "r-2"],
          x: 50,
          y: 50,
          width: 20,
          height: 20,
        },
      ],
      edges: [],
      constraintEdges: [],
      subtypeEdges: [],
    };
    const svg = renderSvg(graph);
    expect(svg).toContain('data-constraint-kind="exclusive_or"');
    // X lines + mandatory dot circle (besides the outer circle).
    const circles = svg.match(/<circle/g) ?? [];
    expect(circles.length).toBeGreaterThanOrEqual(2);
    expect(svg).toContain("<line");
  });

  it("renders disjunctive mandatory constraint as filled dot", () => {
    const graph: PositionedGraph = {
      width: 200,
      height: 200,
      nodes: [
        {
          kind: "constraint",
          id: "c-0",
          constraintKind: "disjunctive_mandatory",
          roleIds: ["r-1", "r-2"],
          x: 50,
          y: 50,
          width: 20,
          height: 20,
        },
      ],
      edges: [],
      constraintEdges: [],
      subtypeEdges: [],
    };
    const svg = renderSvg(graph);
    expect(svg).toContain('data-constraint-kind="disjunctive_mandatory"');
    // Outer circle + inner filled circle.
    const circles = svg.match(/<circle/g) ?? [];
    expect(circles.length).toBeGreaterThanOrEqual(2);
  });

  it("renders subset constraint as arrow symbol", () => {
    const graph: PositionedGraph = {
      width: 200,
      height: 200,
      nodes: [
        {
          kind: "constraint",
          id: "c-0",
          constraintKind: "subset",
          roleIds: ["r-1"],
          supersetRoleIds: ["r-2"],
          x: 50,
          y: 50,
          width: 20,
          height: 20,
        },
      ],
      edges: [],
      constraintEdges: [],
      subtypeEdges: [],
    };
    const svg = renderSvg(graph);
    expect(svg).toContain('data-constraint-kind="subset"');
    // Arrow is drawn with paths.
    expect(svg).toContain("<path");
  });

  it("renders equality constraint as equals sign", () => {
    const graph: PositionedGraph = {
      width: 200,
      height: 200,
      nodes: [
        {
          kind: "constraint",
          id: "c-0",
          constraintKind: "equality",
          roleIds: ["r-1"],
          supersetRoleIds: ["r-2"],
          x: 50,
          y: 50,
          width: 20,
          height: 20,
        },
      ],
      edges: [],
      constraintEdges: [],
      subtypeEdges: [],
    };
    const svg = renderSvg(graph);
    expect(svg).toContain('data-constraint-kind="equality"');
    // Two horizontal lines.
    const lines = svg.match(/<line/g) ?? [];
    expect(lines.length).toBeGreaterThanOrEqual(2);
  });

  it("renders frequency labels on role boxes", () => {
    const graph: PositionedGraph = {
      width: 400,
      height: 300,
      nodes: [
        {
          kind: "fact_type",
          id: "ft-1",
          name: "Test",
          hasSpanningUniqueness: false,
          x: 100,
          y: 100,
          width: 72,
          height: 28,
          roles: [
            {
              roleId: "r-1",
              roleName: "has",
              playerName: "A",
              hasUniqueness: false,
              isMandatory: false,
              frequencyMin: 1,
              frequencyMax: 3,
              x: 0,
              y: 0,
              width: 36,
              height: 28,
            },
            {
              roleId: "r-2",
              roleName: "is of",
              playerName: "B",
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
      edges: [],
      constraintEdges: [],
      subtypeEdges: [],
    };
    const svg = renderSvg(graph);
    // Should contain the frequency label "1..3".
    expect(svg).toContain("1..3");
  });

  it("renders unbounded frequency as range with asterisk", () => {
    const graph: PositionedGraph = {
      width: 400,
      height: 300,
      nodes: [
        {
          kind: "fact_type",
          id: "ft-1",
          name: "Test",
          hasSpanningUniqueness: false,
          x: 100,
          y: 100,
          width: 36,
          height: 28,
          roles: [
            {
              roleId: "r-1",
              roleName: "has",
              playerName: "A",
              hasUniqueness: false,
              isMandatory: false,
              frequencyMin: 2,
              frequencyMax: "unbounded",
              x: 0,
              y: 0,
              width: 36,
              height: 28,
            },
          ],
        },
      ],
      edges: [],
      constraintEdges: [],
      subtypeEdges: [],
    };
    const svg = renderSvg(graph);
    expect(svg).toContain("2..*");
  });

  it("renders equal frequency as single number", () => {
    const graph: PositionedGraph = {
      width: 400,
      height: 300,
      nodes: [
        {
          kind: "fact_type",
          id: "ft-1",
          name: "Test",
          hasSpanningUniqueness: false,
          x: 100,
          y: 100,
          width: 36,
          height: 28,
          roles: [
            {
              roleId: "r-1",
              roleName: "has",
              playerName: "A",
              hasUniqueness: false,
              isMandatory: false,
              frequencyMin: 5,
              frequencyMax: 5,
              x: 0,
              y: 0,
              width: 36,
              height: 28,
            },
          ],
        },
      ],
      edges: [],
      constraintEdges: [],
      subtypeEdges: [],
    };
    const svg = renderSvg(graph);
    // When min === max, just show the number.
    expect(svg).toContain(">5</text>");
  });

  it("renders ring constraint label below fact type", () => {
    const graph: PositionedGraph = {
      width: 400,
      height: 300,
      nodes: [
        {
          kind: "fact_type",
          id: "ft-1",
          name: "Parent of",
          hasSpanningUniqueness: false,
          ringConstraint: {
            label: "ir",
            roleId1: "r-1",
            roleId2: "r-2",
          },
          x: 100,
          y: 100,
          width: 72,
          height: 28,
          roles: [
            {
              roleId: "r-1",
              roleName: "is parent of",
              playerName: "Person",
              hasUniqueness: false,
              isMandatory: false,
              x: 0,
              y: 0,
              width: 36,
              height: 28,
            },
            {
              roleId: "r-2",
              roleName: "is child of",
              playerName: "Person",
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
      edges: [],
      constraintEdges: [],
      subtypeEdges: [],
    };
    const svg = renderSvg(graph);
    // Ring label should appear in the SVG.
    expect(svg).toContain("ir");
    // Should use annotation color.
    expect(svg).toContain("#8a3ac8");
  });

  it("handles empty graphs", () => {
    const graph: PositionedGraph = {
      width: 0,
      height: 0,
      nodes: [],
      edges: [],
      constraintEdges: [],
      subtypeEdges: [],
    };
    const svg = renderSvg(graph);
    expect(svg).toContain("<svg");
    expect(svg).toContain("</svg>");
  });

  it("renders alias text below entity name", () => {
    const graph: PositionedGraph = {
      width: 400,
      height: 300,
      nodes: [
        {
          kind: "object_type",
          id: "ot-1",
          name: "Customer",
          objectTypeKind: "entity",
          referenceMode: "customer_id",
          aliases: ["Client", "Buyer"],
          x: 50,
          y: 50,
          width: 160,
          height: 55,
        },
      ],
      edges: [],
      constraintEdges: [],
      subtypeEdges: [],
    };
    const svg = renderSvg(graph);
    // Should contain the a.k.a. line with single-quoted aliases.
    expect(svg).toContain("a.k.a.");
    expect(svg).toContain("Client");
    expect(svg).toContain("Buyer");
  });

  it("formats aliases with a.k.a. prefix and single quotes", () => {
    const graph: PositionedGraph = {
      width: 400,
      height: 300,
      nodes: [
        {
          kind: "object_type",
          id: "ot-1",
          name: "Customer",
          objectTypeKind: "entity",
          referenceMode: "customer_id",
          aliases: ["Client"],
          x: 50,
          y: 50,
          width: 160,
          height: 55,
        },
      ],
      edges: [],
      constraintEdges: [],
      subtypeEdges: [],
    };
    const svg = renderSvg(graph);
    // Should format as (a.k.a. 'Client')
    expect(svg).toContain("(a.k.a. &#x27;Client&#x27;)");
  });

  it("escapes special XML characters in aliases", () => {
    const graph: PositionedGraph = {
      width: 400,
      height: 300,
      nodes: [
        {
          kind: "object_type",
          id: "ot-1",
          name: "Item",
          objectTypeKind: "entity",
          aliases: ["A<B"],
          x: 50,
          y: 50,
          width: 160,
          height: 55,
        },
      ],
      edges: [],
      constraintEdges: [],
      subtypeEdges: [],
    };
    const svg = renderSvg(graph);
    expect(svg).toContain("A&lt;B");
    expect(svg).not.toContain("A<B");
  });

  it("omits alias line when aliases are not present", () => {
    const svg = renderSvg(makeMinimalGraph());
    expect(svg).not.toContain("a.k.a.");
  });

  it("omits alias line when aliases array is empty", () => {
    const graph: PositionedGraph = {
      width: 400,
      height: 300,
      nodes: [
        {
          kind: "object_type",
          id: "ot-1",
          name: "Customer",
          objectTypeKind: "entity",
          aliases: [],
          x: 50,
          y: 50,
          width: 120,
          height: 40,
        },
      ],
      edges: [],
      constraintEdges: [],
      subtypeEdges: [],
    };
    const svg = renderSvg(graph);
    expect(svg).not.toContain("a.k.a.");
  });

  it("renders objectified fact type with rounded enclosing box", () => {
    const graph: PositionedGraph = {
      width: 400,
      height: 300,
      nodes: [
        {
          kind: "fact_type",
          id: "ft-1",
          name: "Person marries Person",
          hasSpanningUniqueness: false,
          isObjectified: true,
          objectifiedEntityName: "Marriage",
          x: 100,
          y: 100,
          width: 72,
          height: 28,
          roles: [
            {
              roleId: "r-1",
              roleName: "marries",
              playerName: "Person",
              hasUniqueness: false,
              isMandatory: false,
              x: 0,
              y: 0,
              width: 36,
              height: 28,
            },
            {
              roleId: "r-2",
              roleName: "is married to",
              playerName: "Person",
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
      edges: [],
      constraintEdges: [],
      subtypeEdges: [],
    };
    const svg = renderSvg(graph);

    // Should have an objectification enclosing rectangle.
    expect(svg).toContain('data-kind="objectification"');
    // Should use entity stroke color for the box.
    expect(svg).toContain('stroke="#3a86c8"');
    // Should have rounded corners.
    expect(svg).toContain('rx="8"');
    // Should show the entity name label.
    expect(svg).toContain("Marriage");
  });

  it("does not render objectification box for non-objectified fact types", () => {
    const svg = renderSvg(makeMinimalGraph());
    expect(svg).not.toContain('data-kind="objectification"');
  });

  it("renders annotated entity type with dashed border and title", () => {
    const graph: PositionedGraph = {
      width: 400,
      height: 300,
      nodes: [
        {
          kind: "object_type",
          id: "ot-1",
          name: "Customer",
          objectTypeKind: "entity",
          referenceMode: "customer_id",
          annotations: ["No model description", "Review definition"],
          x: 50,
          y: 50,
          width: 120,
          height: 40,
        },
      ],
      edges: [],
      constraintEdges: [],
      subtypeEdges: [],
    };
    const svg = renderSvg(graph);

    // Should have annotation stroke color (amber).
    expect(svg).toContain('stroke="#d97706"');
    // Should have dashed border (entity types normally have solid).
    expect(svg).toContain('stroke-dasharray="4,3"');
    // Should have a <title> element with annotation text.
    expect(svg).toContain("<title>");
    expect(svg).toContain("No model description");
    expect(svg).toContain("Review definition");
    // Should have annotation marker dot.
    expect(svg).toContain('data-kind="annotation-marker"');
  });

  it("renders annotated value type with annotation stroke color", () => {
    const graph: PositionedGraph = {
      width: 400,
      height: 300,
      nodes: [
        {
          kind: "object_type",
          id: "ot-1",
          name: "Status",
          objectTypeKind: "value",
          annotations: ["Data type defaulted to TEXT"],
          x: 50,
          y: 50,
          width: 90,
          height: 40,
        },
      ],
      edges: [],
      constraintEdges: [],
      subtypeEdges: [],
    };
    const svg = renderSvg(graph);

    // Should use annotation stroke color instead of value type stroke.
    expect(svg).toContain('stroke="#d97706"');
    expect(svg).toContain("<title>");
    expect(svg).toContain("Data type defaulted to TEXT");
  });

  it("renders annotated fact type with title element", () => {
    const graph: PositionedGraph = {
      width: 400,
      height: 300,
      nodes: [
        {
          kind: "fact_type",
          id: "ft-1",
          name: "Test fact",
          hasSpanningUniqueness: false,
          annotations: ["Review constraint coverage"],
          x: 100,
          y: 100,
          width: 72,
          height: 28,
          roles: [
            {
              roleId: "r-1",
              roleName: "has",
              playerName: "A",
              hasUniqueness: false,
              isMandatory: false,
              x: 0,
              y: 0,
              width: 36,
              height: 28,
            },
          ],
        },
      ],
      edges: [],
      constraintEdges: [],
      subtypeEdges: [],
    };
    const svg = renderSvg(graph);

    expect(svg).toContain("<title>");
    expect(svg).toContain("Review constraint coverage");
  });

  it("does not render annotation markers for unannotated nodes", () => {
    const svg = renderSvg(makeMinimalGraph());
    expect(svg).not.toContain('data-kind="annotation-marker"');
    expect(svg).not.toContain("<title>");
  });
});
