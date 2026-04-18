import type { OrmModel } from "@barwise/core";
import type { OrmGraph } from "./graph/GraphTypes.js";
import { modelToGraph, type ModelToGraphOptions } from "./graph/ModelToGraph.js";
import { computeNeighborhood } from "./graph/NeighborhoodFilter.js";
import {
  layoutGraph,
  type OrientationOverrides,
  type PositionOverrides,
} from "./layout/ElkLayoutEngine.js";
import type { PositionedGraph } from "./layout/LayoutTypes.js";
import { type RenderOptions, renderSvg } from "./render/SvgRenderer.js";

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
export interface DiagramOptions extends ModelToGraphOptions {
  /** Manual position overrides for entity nodes (from drag). */
  readonly positionOverrides?: PositionOverrides;
  /** Manual orientation overrides for fact type nodes (from click toggle). */
  readonly orientationOverrides?: OrientationOverrides;
  /** Focus entity ID for neighborhood filtering. */
  readonly focusEntityId?: string;
  /** Number of hops from the focus entity (1, 2, 3, ...). Requires focusEntityId. */
  readonly hopCount?: number;
  /** Node IDs to render as ghost (preview) nodes in the SVG. */
  readonly ghostNodeIds?: ReadonlySet<string>;
}

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
  // Compute neighborhood filter if a focus entity is specified.
  let graphOptions: ModelToGraphOptions | undefined = options;
  if (options?.focusEntityId) {
    const hops = options.hopCount ?? 1;
    const neighborhood = computeNeighborhood(model, options.focusEntityId, hops);
    graphOptions = {
      ...options,
      includeFilter: neighborhood,
    };
  }

  const graph = modelToGraph(model, graphOptions);
  const layout = await layoutGraph(
    graph,
    options?.positionOverrides,
    options?.orientationOverrides,
  );
  const renderOpts: RenderOptions | undefined = options?.ghostNodeIds
    ? { ghostNodeIds: options.ghostNodeIds }
    : undefined;
  const svg = renderSvg(layout, renderOpts);
  return { svg, layout, graph };
}
