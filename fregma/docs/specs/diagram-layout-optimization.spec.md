# Diagram Layout Optimization

**Issue:** FREGMA-8zy
**Status:** Complete

## Problem

The current ELK layout engine uses default settings that produce
diagrams with excessive edge crossings and long connector lines. In
the order-management diagram, entity types like Product and Customer
are placed far from their associated fact types, causing connector
lines to span the full diagram width and cross other lines.

## Root Cause

The graph is bipartite: entity/value types form one ELK layer, fact
types form another. ELK's default thoroughness (7 iterations) and
default node placement (BRANDES_KOEPF) do not aggressively optimize
the ordering of nodes within each layer to minimize crossings and edge
length.

## Goals

1. Minimize edge crossings between layers.
2. Place fact type boxes near their participating object types.
3. Reduce total connector line length.

## Approach

Two complementary strategies:

### Strategy 1: Tune ELK layout options

Add the following options to the ELK graph configuration in
`ElkLayoutEngine.ts`:

| Option | Value | Rationale |
|--------|-------|-----------|
| `crossingMinimization.strategy` | `LAYER_SWEEP` | Explicit; standard for layered |
| `crossingMinimization.greedySwitch.type` | `TWO_SIDED` | Post-processing pass from both directions |
| `thoroughness` | `40` | More iterations (default 7 is too low) |
| `nodePlacement.strategy` | `NETWORK_SIMPLEX` | Minimizes total edge length |
| `nodePlacement.networkSimplex.nodeFlexibility.default` | `NODE_SIZE_WHERE_SPACE_PERMITS` | Allows node flex for straighter edges |
| `considerModelOrder.strategy` | `NODES_AND_EDGES` | Uses input order as initial hint |

### Strategy 2: Pre-sort nodes by connectivity

Before passing nodes to ELK, reorder them using a greedy adjacency
heuristic so the `considerModelOrder` hint is effective:

1. Build an adjacency map (which object types share fact types).
2. Order object types greedily: start with the highest-degree entity,
   then repeatedly append the entity most connected to already-placed
   ones.
3. Order fact types by the average position of their connected entity
   types.

## Files Changed

- `packages/diagram/src/layout/ElkLayoutEngine.ts` -- ELK options and
  node pre-sorting logic
- `packages/diagram/tests/ElkLayoutEngine.test.ts` -- new test for
  crossing reduction

## Risks

- `NETWORK_SIMPLEX` had a known bug with partitioning in ELK 0.9.0,
  but we do not use partitioning.
- Higher thoroughness increases layout time; 40 is a reasonable
  balance for diagrams under 50 nodes.

## Stages

### Stage 1: Spec -- COMPLETE

This document.

### Stage 2: Tune ELK layout options -- COMPLETE

Added 6 layout options to `buildElkGraph()`: LAYER_SWEEP crossing
minimization with TWO_SIDED greedy switch, thoroughness 40,
NETWORK_SIMPLEX node placement with node flexibility, and
NODES_AND_EDGES model order consideration.

### Stage 3: Pre-sort nodes by connectivity -- COMPLETE

Implemented `sortNodesByConnectivity()` with greedy adjacency ordering
for object types and average-position sorting for fact types.

### Stage 4: Tests -- COMPLETE

Added 4 new tests for `sortNodesByConnectivity`: small graph passthrough,
order-management topology, disconnected nodes, and constraint node
preservation. 78 total tests passing (up from 74).

### Stage 5: Visual verification -- COMPLETE

Regenerated order-management SVG. Each fact type now sits directly
between its connected entity types. Only 1 edge crossing remains
(Order-to-OrderStatus passes over Product), down from multiple severe
crossings in the original layout.
