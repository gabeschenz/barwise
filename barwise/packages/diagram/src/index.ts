// Graph types and conversion.
export type {
  OrmGraph,
  GraphNode,
  GraphEdge,
  ConstraintNode,
  ConstraintKind,
  ConstraintEdge,
  SubtypeEdge,
  ObjectTypeNode,
  FactTypeNode,
  RoleBox,
  RingTypeLabel,
} from "./graph/GraphTypes.js";
export { modelToGraph } from "./graph/ModelToGraph.js";

// Layout types and engine.
export type {
  PositionedGraph,
  PositionedNode,
  PositionedObjectTypeNode,
  PositionedFactTypeNode,
  PositionedConstraintNode,
  PositionedRoleBox,
  PositionedEdge,
  PositionedConstraintEdge,
  PositionedSubtypeEdge,
  Position,
  Dimensions,
} from "./layout/LayoutTypes.js";
export { layoutGraph } from "./layout/ElkLayoutEngine.js";

// SVG rendering.
export { renderSvg } from "./render/SvgRenderer.js";

// Theme constants.
export * as theme from "./render/theme.js";

// Main entry point.
export { generateDiagram } from "./DiagramGenerator.js";
export type { DiagramResult } from "./DiagramGenerator.js";
