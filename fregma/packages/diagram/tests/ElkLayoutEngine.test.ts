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

// Mock elkjs to control the layout output and trigger fallback paths.
vi.mock("elkjs", () => {
  return {
    default: class MockELK {
      async layout(graph: Record<string, unknown>) {
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
    };

    const result = await layoutGraph(graph);
    const edge = result.edges[0]!;
    // Neither source nor target found -> empty points array.
    expect(edge.points).toHaveLength(0);
  });
});
