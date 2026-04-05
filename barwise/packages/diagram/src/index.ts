// Graph types and conversion.
export type {
  ConstraintEdge,
  ConstraintKind,
  ConstraintNode,
  FactTypeNode,
  GraphEdge,
  GraphNode,
  ObjectTypeNode,
  OrmGraph,
  RingTypeLabel,
  RoleBox,
  SubtypeEdge,
} from "./graph/GraphTypes.js";
export { modelToGraph, type ModelToGraphOptions } from "./graph/ModelToGraph.js";

// Layout types and engine.
export { layoutGraph, type OrientationOverrides, type PositionOverrides } from "./layout/ElkLayoutEngine.js";
export type {
  Dimensions,
  FactTypeOrientation,
  Position,
  PositionedConstraintEdge,
  PositionedConstraintNode,
  PositionedEdge,
  PositionedFactTypeNode,
  PositionedGraph,
  PositionedNode,
  PositionedObjectTypeNode,
  PositionedRoleBox,
  PositionedSubtypeEdge,
} from "./layout/LayoutTypes.js";

// SVG rendering.
export { renderSvg } from "./render/SvgRenderer.js";

// Theme constants.
export * as theme from "./render/theme.js";

// Main entry point.
export { generateDiagram } from "./DiagramGenerator.js";
export type { DiagramOptions, DiagramResult } from "./DiagramGenerator.js";
