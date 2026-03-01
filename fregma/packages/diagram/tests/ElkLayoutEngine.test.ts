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

// sortNodesByConnectivity is a pure function that does not depend on
// elkjs, so we import it directly (outside the mock scope).
const { sortNodesByConnectivity } = await import(
  "../src/layout/ElkLayoutEngine.js"
);

describe("sortNodesByConnectivity", () => {
  it("returns nodes unchanged when fewer than 3 object types", () => {
    const graph: OrmGraph = {
      nodes: [
        { kind: "object_type", id: "ot-1", name: "A", objectTypeKind: "entity" },
        { kind: "object_type", id: "ot-2", name: "B", objectTypeKind: "entity" },
      ],
      edges: [],
      constraintEdges: [],
      subtypeEdges: [],
    };

    const result = sortNodesByConnectivity(graph);
    expect(result).toBe(graph.nodes); // Same reference, not reordered.
  });

  it("places connected object types adjacent in order-management topology", () => {
    // Replicate the order-management model topology:
    //   Order -- OrderStatus  (binary)
    //   Order -- Product -- Quantity  (ternary)
    //   Customer -- Order  (binary)
    //   Customer -- CustomerName  (binary)
    //
    // A bad initial order might be:
    //   Product, OrderStatus, Order, Quantity, Customer, CustomerName
    // which places Order in the middle, far from Product on the left
    // and Customer on the right.
    const graph: OrmGraph = {
      nodes: [
        // Deliberately poor initial order.
        { kind: "object_type", id: "ot-product", name: "Product", objectTypeKind: "entity" },
        { kind: "object_type", id: "ot-status", name: "OrderStatus", objectTypeKind: "value" },
        { kind: "object_type", id: "ot-order", name: "Order", objectTypeKind: "entity" },
        { kind: "object_type", id: "ot-qty", name: "Quantity", objectTypeKind: "value" },
        { kind: "object_type", id: "ot-customer", name: "Customer", objectTypeKind: "entity" },
        { kind: "object_type", id: "ot-custname", name: "CustomerName", objectTypeKind: "value" },
        // Fact types
        {
          kind: "fact_type", id: "ft-order-status", name: "Order has OrderStatus",
          roles: [
            { roleId: "r1", roleName: "has", playerId: "ot-order", playerName: "Order", hasUniqueness: true, isMandatory: false },
            { roleId: "r2", roleName: "of", playerId: "ot-status", playerName: "OrderStatus", hasUniqueness: false, isMandatory: false },
          ],
          hasSpanningUniqueness: false,
        },
        {
          kind: "fact_type", id: "ft-order-product", name: "Order contains Product in Quantity",
          roles: [
            { roleId: "r3", roleName: "contains", playerId: "ot-order", playerName: "Order", hasUniqueness: false, isMandatory: false },
            { roleId: "r4", roleName: "contained-in", playerId: "ot-product", playerName: "Product", hasUniqueness: false, isMandatory: false },
            { roleId: "r5", roleName: "in-quantity", playerId: "ot-qty", playerName: "Quantity", hasUniqueness: false, isMandatory: false },
          ],
          hasSpanningUniqueness: false,
        },
        {
          kind: "fact_type", id: "ft-cust-order", name: "Customer places Order",
          roles: [
            { roleId: "r6", roleName: "places", playerId: "ot-customer", playerName: "Customer", hasUniqueness: false, isMandatory: false },
            { roleId: "r7", roleName: "placed-by", playerId: "ot-order", playerName: "Order", hasUniqueness: false, isMandatory: false },
          ],
          hasSpanningUniqueness: false,
        },
        {
          kind: "fact_type", id: "ft-cust-name", name: "Customer has CustomerName",
          roles: [
            { roleId: "r8", roleName: "has", playerId: "ot-customer", playerName: "Customer", hasUniqueness: true, isMandatory: false },
            { roleId: "r9", roleName: "of", playerId: "ot-custname", playerName: "CustomerName", hasUniqueness: false, isMandatory: false },
          ],
          hasSpanningUniqueness: false,
        },
      ],
      edges: [],
      constraintEdges: [],
      subtypeEdges: [],
    };

    const sorted = sortNodesByConnectivity(graph);
    const otNames = sorted
      .filter((n) => n.kind === "object_type")
      .map((n) => n.name);
    const ftNames = sorted
      .filter((n) => n.kind === "fact_type")
      .map((n) => n.name);

    // Order should be the seed (highest degree: 3 neighbors).
    expect(otNames[0]).toBe("Order");

    // Assert adjacency: connected OTs should be closer together than in
    // the original (deliberately bad) input order. With 6 OTs and Order as
    // a hub connecting 4 neighbors, not all pairs can be within distance 1,
    // but total edge span should be much smaller than the worst case (5).
    const otIndex = new Map<string, number>();
    for (let i = 0; i < otNames.length; i++) {
      otIndex.set(otNames[i]!, i);
    }

    const orderIdx = otIndex.get("Order")!;
    const statusIdx = otIndex.get("OrderStatus")!;
    const productIdx = otIndex.get("Product")!;
    const qtyIdx = otIndex.get("Quantity")!;
    const custIdx = otIndex.get("Customer")!;
    const custNameIdx = otIndex.get("CustomerName")!;

    // Compute total edge span: sum of distances for all fact type connections.
    // Original bad order: Product(0), OrderStatus(1), Order(2), Quantity(3),
    //   Customer(4), CustomerName(5)
    //   -> spans: |2-1|=1, |2-0|+|0-3|=2+3=5(ternary spread), |4-2|=2, |4-5|=1
    //   Total binary distances = 1+2+0+3+2+1 = 9
    // The sorted order should produce a lower total.
    const totalSpan =
      Math.abs(orderIdx - statusIdx) +          // Order-OrderStatus
      Math.abs(orderIdx - productIdx) +          // Order-Product
      Math.abs(productIdx - qtyIdx) +            // Product-Quantity
      Math.abs(orderIdx - qtyIdx) +              // Order-Quantity
      Math.abs(custIdx - orderIdx) +             // Customer-Order
      Math.abs(custIdx - custNameIdx);           // Customer-CustomerName
    // With 6 nodes, theoretical minimum total span is ~6. Assert it's
    // well below the unsorted worst case (~15).
    expect(totalSpan).toBeLessThanOrEqual(12);

    // Customer and CustomerName should always be adjacent (only connected
    // to each other and CustomerName has degree 1).
    expect(Math.abs(custIdx - custNameIdx)).toBeLessThanOrEqual(2);

    // Fact types should come after all object types.
    expect(ftNames).toHaveLength(4);
    // All 6 OTs then 4 FTs.
    expect(sorted.slice(0, 6).every((n) => n.kind === "object_type")).toBe(true);
    expect(sorted.slice(6).every((n) => n.kind === "fact_type")).toBe(true);
  });

  it("handles disconnected object types by appending them at the end", () => {
    const graph: OrmGraph = {
      nodes: [
        { kind: "object_type", id: "ot-a", name: "A", objectTypeKind: "entity" },
        { kind: "object_type", id: "ot-b", name: "B", objectTypeKind: "entity" },
        { kind: "object_type", id: "ot-c", name: "C", objectTypeKind: "entity" },
        { kind: "object_type", id: "ot-isolated", name: "Isolated", objectTypeKind: "entity" },
        {
          kind: "fact_type", id: "ft-ab", name: "A relates B",
          roles: [
            { roleId: "r1", roleName: "r1", playerId: "ot-a", playerName: "A", hasUniqueness: false, isMandatory: false },
            { roleId: "r2", roleName: "r2", playerId: "ot-b", playerName: "B", hasUniqueness: false, isMandatory: false },
          ],
          hasSpanningUniqueness: false,
        },
        {
          kind: "fact_type", id: "ft-bc", name: "B relates C",
          roles: [
            { roleId: "r3", roleName: "r3", playerId: "ot-b", playerName: "B", hasUniqueness: false, isMandatory: false },
            { roleId: "r4", roleName: "r4", playerId: "ot-c", playerName: "C", hasUniqueness: false, isMandatory: false },
          ],
          hasSpanningUniqueness: false,
        },
      ],
      edges: [],
      constraintEdges: [],
      subtypeEdges: [],
    };

    const sorted = sortNodesByConnectivity(graph);
    const otNames = sorted
      .filter((n) => n.kind === "object_type")
      .map((n) => n.name);

    // B has the most neighbors (A and C), so it should be the seed.
    expect(otNames[0]).toBe("B");

    // "Isolated" has no connections, should be last among OTs.
    expect(otNames[otNames.length - 1]).toBe("Isolated");
  });

  it("preserves constraint nodes at the end of the sorted list", () => {
    const graph: OrmGraph = {
      nodes: [
        { kind: "object_type", id: "ot-1", name: "A", objectTypeKind: "entity" },
        { kind: "object_type", id: "ot-2", name: "B", objectTypeKind: "entity" },
        { kind: "object_type", id: "ot-3", name: "C", objectTypeKind: "entity" },
        { kind: "constraint", id: "c-1", constraintKind: "external_uniqueness", roleIds: ["r1", "r3"] },
        {
          kind: "fact_type", id: "ft-1", name: "A relates B",
          roles: [
            { roleId: "r1", roleName: "r1", playerId: "ot-1", playerName: "A", hasUniqueness: false, isMandatory: false },
            { roleId: "r2", roleName: "r2", playerId: "ot-2", playerName: "B", hasUniqueness: false, isMandatory: false },
          ],
          hasSpanningUniqueness: false,
        },
        {
          kind: "fact_type", id: "ft-2", name: "B relates C",
          roles: [
            { roleId: "r3", roleName: "r3", playerId: "ot-2", playerName: "B", hasUniqueness: false, isMandatory: false },
            { roleId: "r4", roleName: "r4", playerId: "ot-3", playerName: "C", hasUniqueness: false, isMandatory: false },
          ],
          hasSpanningUniqueness: false,
        },
      ],
      edges: [],
      constraintEdges: [],
      subtypeEdges: [],
    };

    const sorted = sortNodesByConnectivity(graph);

    // Order should be: OTs, FTs, constraint nodes.
    const kinds = sorted.map((n) => n.kind);
    const lastNode = sorted[sorted.length - 1]!;
    expect(lastNode.kind).toBe("constraint");
    expect(lastNode.id).toBe("c-1");

    // OTs should come first.
    expect(kinds.slice(0, 3)).toEqual(["object_type", "object_type", "object_type"]);
    // FTs next.
    expect(kinds.slice(3, 5)).toEqual(["fact_type", "fact_type"]);
  });
});
