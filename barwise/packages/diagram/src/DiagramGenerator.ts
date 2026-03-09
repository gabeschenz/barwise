import type { OrmModel } from "@barwise/core";
import type { OrmGraph } from "./graph/GraphTypes.js";
import { modelToGraph, type ModelToGraphOptions } from "./graph/ModelToGraph.js";
import { layoutGraph } from "./layout/ElkLayoutEngine.js";
import type { PositionedGraph } from "./layout/LayoutTypes.js";
import { renderSvg } from "./render/SvgRenderer.js";

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
 * Options for diagram generation.
 */
export type DiagramOptions = ModelToGraphOptions;

/**
 * Generate a complete ORM diagram from a model.
 *
 * This is the main entry point for the diagram package. It runs the
 * full pipeline: model -> graph -> layout -> SVG.
 */
export async function generateDiagram(
  model: OrmModel,
  options?: DiagramOptions,
): Promise<DiagramResult> {
  const graph = modelToGraph(model, options);
  const layout = await layoutGraph(graph);
  const svg = renderSvg(layout);
  return { svg, layout, graph };
}
