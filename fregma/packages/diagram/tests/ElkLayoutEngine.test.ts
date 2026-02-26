/**
 * Tests for the ELK layout engine's fallback routing paths.
 *
 * In normal operation, ELK returns edge sections with bend points. But
 * if ELK omits sections (e.g. due to degenerate graph geometry), the
 * layout engine falls back to straight-line routing between node centers.
 * These tests mock ELK to return edges without sections, verifying that
 * the fallback produces valid point arrays rather than crashing.
 */
import { describe, it, expect, vi } from "vitest";
import type { OrmGraph } from "../src/graph/GraphTypes.js";

// Controls what the mock ELK returns. Tests can override this per-test.
let mockLayoutImpl: (graph: Record<string, unknown>) => Promise<Record<string, unknown>>;

// Default implementation: returns positioned nodes but edges without sections.
const defaultMockLayout = async (graph: Record<string, unknown>) => {
  const children = (graph.children as Array<{ id: string; width: number; height: number }>)
    ?? [];
  const edges = (graph.edges as Array<{ id: string; sources: string[]; targets: string[] }>)
    ?? [];

  return {
    children: children.map((c, i) => ({
      id: c.id,
      x: i * 200,
      y: i * 100,
      width: c.width,
      height: c.height,
    })),
    // Return edges WITHOUT sections to trigger the fallback routing.
    edges: edges.map((e) => ({
      id: e.id,
    })),
    width: 800,
    height: 600,
  };
};

mockLayoutImpl = defaultMockLayout;

// Mock elkjs to control the layout output and trigger fallback paths.
vi.mock("elkjs", () => {
  return {
    default: class MockELK {
      async layout(graph: Record<string, unknown>) {
        return mockLayoutImpl(graph);
      }
    },
  };
});

// Import after mock is set up.
const { layoutGraph } = await import("../src/layout/ElkLayoutEngine.js");

describe("ElkLayoutEngine", () => {
  it("uses fallback straight-line routing when ELK returns no sections", async () => {
    const graph: OrmGraph = {
      nodes: [
        {
          kind: "object_type",
          id: "ot-1",
          name: "Customer",
          objectTypeKind: "entity",
          referenceMode: "cid",
        },
        {
          kind: "fact_type",
          id: "ft-1",
          name: "Customer exists",
          roles: [
            {
              roleId: "r-1",
              roleName: "exists",
              playerId: "ot-1",
              playerName: "Customer",
              hasUniqueness: false,
              isMandatory: false,
            },
          ],
          hasSpanningUniqueness: false,
        },
      ],
      edges: [
        { sourceNodeId: "ot-1", targetNodeId: "ft-1", roleId: "r-1" },
      ],
      constraintEdges: [],
      subtypeEdges: [],
    };

    const result = await layoutGraph(graph);

    // Should have positioned nodes.
    expect(result.nodes).toHaveLength(2);
    expect(result.edges).toHaveLength(1);

    // The fallback routing should produce a straight line (2 points).
    const edge = result.edges[0]!;
    expect(edge.points).toHaveLength(2);
    // Start point should be center of source node.
    expect(edge.points[0]!.x).toBeGreaterThan(0);
    expect(edge.points[0]!.y).toBeGreaterThan(0);
    // End point should be center of target node.
    expect(edge.points[1]!.x).toBeGreaterThan(0);
    expect(edge.points[1]!.y).toBeGreaterThan(0);
  });

  it("returns empty points when neither source nor target are found", async () => {
    const graph: OrmGraph = {
      nodes: [
        {
          kind: "object_type",
          id: "ot-1",
          name: "Customer",
          objectTypeKind: "entity",
          referenceMode: "cid",
        },
      ],
      edges: [
        // Edge references a target node that does not exist in the layout.
        { sourceNodeId: "ot-missing", targetNodeId: "ft-missing", roleId: "r-1" },
      ],
      constraintEdges: [],
      subtypeEdges: [],
    };

    const result = await layoutGraph(graph);
    const edge = result.edges[0]!;
    // Neither source nor target found -> empty points array.
    expect(edge.points).toHaveLength(0);
  });

  it("uses fallback straight-line routing for subtype edges when ELK returns no sections", async () => {
    const graph: OrmGraph = {
      nodes: [
        {
          kind: "object_type",
          id: "ot-person",
          name: "Person",
          objectTypeKind: "entity",
          referenceMode: "pid",
        },
        {
          kind: "object_type",
          id: "ot-employee",
          name: "Employee",
          objectTypeKind: "entity",
          referenceMode: "eid",
        },
      ],
      edges: [],
      constraintEdges: [],
      subtypeEdges: [
        {
          subtypeNodeId: "ot-employee",
          supertypeNodeId: "ot-person",
          providesIdentification: true,
        },
      ],
    };

    const result = await layoutGraph(graph);

    expect(result.subtypeEdges).toHaveLength(1);
    const se = result.subtypeEdges[0]!;
    expect(se.subtypeNodeId).toBe("ot-employee");
    expect(se.supertypeNodeId).toBe("ot-person");
    expect(se.providesIdentification).toBe(true);

    // Fallback should produce a straight line (2 points).
    expect(se.points).toHaveLength(2);
    expect(se.points[0]!.x).toBeGreaterThanOrEqual(0);
    expect(se.points[1]!.x).toBeGreaterThanOrEqual(0);
  });

  it("handles ELK returning minimal result with no children or edges", async () => {
    // Override mock to return a bare-bones result missing children, edges, width, height.
    mockLayoutImpl = async () => ({});

    const graph: OrmGraph = {
      nodes: [
        {
          kind: "object_type",
          id: "ot-1",
          name: "A",
          objectTypeKind: "entity",
        },
      ],
      edges: [],
      constraintEdges: [],
      subtypeEdges: [],
    };

    const result = await layoutGraph(graph);

    // Node should get default 0 positions from ?? fallbacks.
    expect(result.nodes).toHaveLength(1);
    const node = result.nodes[0]!;
    expect(node.x).toBe(0);
    expect(node.y).toBe(0);

    // Graph dimensions should use defaults.
    expect(result.width).toBe(800);
    expect(result.height).toBe(600);

    // Restore default mock.
    mockLayoutImpl = defaultMockLayout;
  });

  it("handles ELK returning nodes without position properties", async () => {
    // Override mock to return children that lack x/y/width/height.
    mockLayoutImpl = async (graph) => {
      const children = (graph.children as Array<{ id: string }>) ?? [];
      return {
        children: children.map((c) => ({ id: c.id })),
        edges: [],
        width: 500,
        height: 400,
      };
    };

    const graph: OrmGraph = {
      nodes: [
        {
          kind: "object_type",
          id: "ot-1",
          name: "B",
          objectTypeKind: "value",
        },
        {
          kind: "fact_type",
          id: "ft-1",
          name: "B exists",
          roles: [
            {
              roleId: "r-1",
              roleName: "exists",
              playerId: "ot-1",
              playerName: "B",
              hasUniqueness: false,
              isMandatory: false,
            },
          ],
          hasSpanningUniqueness: false,
        },
      ],
      edges: [
        { sourceNodeId: "ot-1", targetNodeId: "ft-1", roleId: "r-1" },
      ],
      constraintEdges: [],
      subtypeEdges: [],
    };

    const result = await layoutGraph(graph);

    // Both nodes should fallback to 0 positions.
    for (const node of result.nodes) {
      expect(node.x).toBe(0);
      expect(node.y).toBe(0);
      expect(node.width).toBe(0);
      expect(node.height).toBe(0);
    }

    // Restore default mock.
    mockLayoutImpl = defaultMockLayout;
  });

  it("handles ELK returning edges with sections and bend points", async () => {
    // Override mock to return edges WITH sections (the non-fallback path).
    mockLayoutImpl = async (graph) => {
      const children = (graph.children as Array<{ id: string; width: number; height: number }>) ?? [];
      const edges = (graph.edges as Array<{ id: string }>) ?? [];
      return {
        children: children.map((c, i) => ({
          id: c.id,
          x: i * 200,
          y: i * 100,
          width: c.width,
          height: c.height,
        })),
        edges: edges.map((e) => ({
          id: e.id,
          sections: [
            {
              startPoint: { x: 10, y: 20 },
              bendPoints: [{ x: 50, y: 60 }],
              endPoint: { x: 90, y: 100 },
            },
          ],
        })),
        width: 800,
        height: 600,
      };
    };

    const graph: OrmGraph = {
      nodes: [
        {
          kind: "object_type",
          id: "ot-1",
          name: "Customer",
          objectTypeKind: "entity",
          referenceMode: "cid",
        },
        {
          kind: "fact_type",
          id: "ft-1",
          name: "Customer exists",
          roles: [
            {
              roleId: "r-1",
              roleName: "exists",
              playerId: "ot-1",
              playerName: "Customer",
              hasUniqueness: false,
              isMandatory: false,
            },
          ],
          hasSpanningUniqueness: false,
        },
      ],
      edges: [
        { sourceNodeId: "ot-1", targetNodeId: "ft-1", roleId: "r-1" },
      ],
      constraintEdges: [],
      subtypeEdges: [],
    };

    const result = await layoutGraph(graph);

    // Edge should have 3 points: start, bend, end.
    const edge = result.edges[0]!;
    expect(edge.points).toHaveLength(3);
    expect(edge.points[0]).toEqual({ x: 10, y: 20 });
    expect(edge.points[1]).toEqual({ x: 50, y: 60 });
    expect(edge.points[2]).toEqual({ x: 90, y: 100 });

    // Restore default mock.
    mockLayoutImpl = defaultMockLayout;
  });

  it("handles ELK sections with no bend points", async () => {
    // Override mock to return sections without bendPoints key.
    mockLayoutImpl = async (graph) => {
      const children = (graph.children as Array<{ id: string; width: number; height: number }>) ?? [];
      const edges = (graph.edges as Array<{ id: string }>) ?? [];
      return {
        children: children.map((c, i) => ({
          id: c.id,
          x: i * 200,
          y: i * 100,
          width: c.width,
          height: c.height,
        })),
        edges: edges.map((e) => ({
          id: e.id,
          sections: [
            {
              startPoint: { x: 10, y: 20 },
              endPoint: { x: 90, y: 100 },
              // No bendPoints key at all.
            },
          ],
        })),
        width: 800,
        height: 600,
      };
    };

    const graph: OrmGraph = {
      nodes: [
        {
          kind: "object_type",
          id: "ot-1",
          name: "X",
          objectTypeKind: "entity",
        },
        {
          kind: "object_type",
          id: "ot-2",
          name: "Y",
          objectTypeKind: "entity",
        },
      ],
      edges: [],
      constraintEdges: [],
      subtypeEdges: [
        {
          subtypeNodeId: "ot-2",
          supertypeNodeId: "ot-1",
          providesIdentification: true,
        },
      ],
    };

    const result = await layoutGraph(graph);

    // Subtype edge should have 2 points: start and end (no bends).
    const se = result.subtypeEdges[0]!;
    expect(se.points).toHaveLength(2);
    expect(se.points[0]).toEqual({ x: 10, y: 20 });
    expect(se.points[1]).toEqual({ x: 90, y: 100 });

    // Restore default mock.
    mockLayoutImpl = defaultMockLayout;
  });

  it("returns empty points for subtype edges when nodes are missing", async () => {
    const graph: OrmGraph = {
      nodes: [],
      edges: [],
      constraintEdges: [],
      subtypeEdges: [
        {
          subtypeNodeId: "ot-missing-sub",
          supertypeNodeId: "ot-missing-super",
          providesIdentification: false,
        },
      ],
    };

    const result = await layoutGraph(graph);
    expect(result.subtypeEdges).toHaveLength(1);
    expect(result.subtypeEdges[0]!.points).toHaveLength(0);
  });
});
