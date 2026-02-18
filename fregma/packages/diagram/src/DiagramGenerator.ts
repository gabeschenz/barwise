import type { OrmModel } from "@fregma/core";
import { modelToGraph } from "./graph/ModelToGraph.js";
import { layoutGraph } from "./layout/ElkLayoutEngine.js";
import { renderSvg } from "./render/SvgRenderer.js";
import type { PositionedGraph } from "./layout/LayoutTypes.js";
import type { OrmGraph } from "./graph/GraphTypes.js";

/**
 * The result of diagram generation, containing both the SVG output
 * and the intermediate representations for further processing.
 */
export interface DiagramResult {
  /** The complete SVG document string. */
  readonly svg: string;
  /** The positioned graph (for hit testing, overlays, etc.). */
  readonly layout: PositionedGraph;
  /** The unpositioned graph (for analysis). */
  readonly graph: OrmGraph;
}

/**
 * Generate a complete ORM diagram from a model.
 *
 * This is the main entry point for the diagram package. It runs the
 * full pipeline: model -> graph -> layout -> SVG.
 */
export async function generateDiagram(
  model: OrmModel,
): Promise<DiagramResult> {
  const graph = modelToGraph(model);
  const layout = await layoutGraph(graph);
  const svg = renderSvg(layout);
  return { svg, layout, graph };
}
