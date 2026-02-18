import type {
  PositionedGraph,
  PositionedObjectTypeNode,
  PositionedFactTypeNode,
  PositionedRoleBox,
  PositionedEdge,
  Position,
} from "../layout/LayoutTypes.js";
import * as theme from "./theme.js";

/**
 * Render a positioned ORM graph as an SVG string.
 *
 * The output is a complete, self-contained SVG document that can be
 * embedded directly in an HTML page or saved as a file.
 */
export function renderSvg(graph: PositionedGraph): string {
  const padding = 20;
  const svgWidth = graph.width + padding * 2;
  const svgHeight = graph.height + padding * 2;

  const parts: string[] = [];

  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" ` +
    `width="${svgWidth}" height="${svgHeight}" ` +
    `viewBox="${-padding} ${-padding} ${svgWidth} ${svgHeight}" ` +
    `style="font-family: ${theme.FONT_FAMILY}; background: #fafafa;">`,
  );

  // Render edges first (behind nodes).
  for (const edge of graph.edges) {
    parts.push(renderEdge(edge));
  }

  // Render nodes.
  for (const node of graph.nodes) {
    if (node.kind === "object_type") {
      parts.push(renderObjectType(node));
    } else {
      parts.push(renderFactType(node));
    }
  }

  parts.push("</svg>");
  return parts.join("\n");
}

function renderObjectType(node: PositionedObjectTypeNode): string {
  const isEntity = node.objectTypeKind === "entity";
  const fill = isEntity ? theme.COLOR_ENTITY_FILL : theme.COLOR_VALUE_FILL;
  const stroke = isEntity ? theme.COLOR_ENTITY_STROKE : theme.COLOR_VALUE_STROKE;
  const cx = node.x + node.width / 2;
  const cy = node.y + node.height / 2;

  const parts: string[] = [];
  parts.push(`<g data-id="${esc(node.id)}" data-kind="object_type">`);

  if (isEntity) {
    // Entity types are rounded rectangles (soft corners).
    parts.push(
      `<rect x="${node.x}" y="${node.y}" ` +
      `width="${node.width}" height="${node.height}" ` +
      `rx="${theme.OT_CORNER_RADIUS}" ry="${theme.OT_CORNER_RADIUS}" ` +
      `fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>`,
    );
  } else {
    // Value types are rendered as dashed-border ovals.
    const rx = node.width / 2;
    const ry = node.height / 2;
    parts.push(
      `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" ` +
      `fill="${fill}" stroke="${stroke}" stroke-width="1.5" ` +
      `stroke-dasharray="4,3"/>`,
    );
  }

  // Name label.
  parts.push(
    `<text x="${cx}" y="${cy - (node.referenceMode ? 3 : 0)}" ` +
    `text-anchor="middle" dominant-baseline="central" ` +
    `fill="${theme.COLOR_TEXT}" font-size="${theme.FONT_SIZE_LABEL}" ` +
    `font-weight="600">${esc(node.name)}</text>`,
  );

  // Reference mode (below name for entity types).
  if (node.referenceMode) {
    parts.push(
      `<text x="${cx}" y="${cy + 12}" ` +
      `text-anchor="middle" dominant-baseline="central" ` +
      `fill="${theme.COLOR_REF_MODE}" font-size="${theme.FONT_SIZE_REF_MODE}">` +
      `(${esc(node.referenceMode)})</text>`,
    );
  }

  parts.push("</g>");
  return parts.join("\n");
}

function renderFactType(node: PositionedFactTypeNode): string {
  const parts: string[] = [];
  parts.push(`<g data-id="${esc(node.id)}" data-kind="fact_type">`);

  // Render each role box.
  for (const role of node.roles) {
    parts.push(renderRoleBox(node.x, node.y, role));
  }

  // Spanning uniqueness: a bar across all role boxes.
  if (node.hasSpanningUniqueness && node.roles.length > 0) {
    const first = node.roles[0]!;
    const last = node.roles[node.roles.length - 1]!;
    const barX = node.x + first.x + 4;
    const barWidth = last.x + last.width - first.x - 8;
    const barY = node.y - theme.UNIQUENESS_BAR_OFFSET - theme.UNIQUENESS_BAR_HEIGHT;
    parts.push(
      `<rect x="${barX}" y="${barY}" ` +
      `width="${barWidth}" height="${theme.UNIQUENESS_BAR_HEIGHT}" ` +
      `fill="${theme.COLOR_SPANNING}" rx="1"/>`,
    );
  }

  // Fact type name label (below the bar).
  const cx = node.x + node.width / 2;
  const labelY = node.y + node.height + 14;
  parts.push(
    `<text x="${cx}" y="${labelY}" ` +
    `text-anchor="middle" fill="${theme.COLOR_TEXT}" ` +
    `font-size="${theme.FONT_SIZE_ROLE}" font-style="italic">` +
    `${esc(node.name)}</text>`,
  );

  parts.push("</g>");
  return parts.join("\n");
}

function renderRoleBox(
  parentX: number,
  parentY: number,
  role: PositionedRoleBox,
): string {
  const x = parentX + role.x;
  const y = parentY + role.y;
  const parts: string[] = [];

  // Role box rectangle.
  parts.push(
    `<rect x="${x}" y="${y}" ` +
    `width="${role.width}" height="${role.height}" ` +
    `fill="${theme.COLOR_ROLE_FILL}" ` +
    `stroke="${theme.COLOR_ROLE_STROKE}" stroke-width="1"/>`,
  );

  // Single-role uniqueness bar (above the role box).
  if (role.hasUniqueness) {
    const barX = x + 4;
    const barWidth = role.width - 8;
    const barY = y - theme.UNIQUENESS_BAR_OFFSET - theme.UNIQUENESS_BAR_HEIGHT;
    parts.push(
      `<rect x="${barX}" y="${barY}" ` +
      `width="${barWidth}" height="${theme.UNIQUENESS_BAR_HEIGHT}" ` +
      `fill="${theme.COLOR_UNIQUENESS}" rx="1"/>`,
    );
  }

  // Mandatory dot (on the connection side of the role box).
  if (role.isMandatory) {
    const dotX = x + role.width / 2;
    const dotY = y + role.height + theme.MANDATORY_DOT_RADIUS + 2;
    parts.push(
      `<circle cx="${dotX}" cy="${dotY}" ` +
      `r="${theme.MANDATORY_DOT_RADIUS}" ` +
      `fill="${theme.COLOR_MANDATORY}"/>`,
    );
  }

  return parts.join("\n");
}

function renderEdge(edge: PositionedEdge): string {
  if (edge.points.length < 2) return "";

  const d = buildPathData(edge.points);
  return (
    `<path d="${d}" fill="none" ` +
    `stroke="${theme.COLOR_EDGE}" stroke-width="1.2"/>`
  );
}

function buildPathData(points: readonly Position[]): string {
  const parts: string[] = [];
  const first = points[0]!;
  parts.push(`M ${first.x} ${first.y}`);
  for (let i = 1; i < points.length; i++) {
    const p = points[i]!;
    parts.push(`L ${p.x} ${p.y}`);
  }
  return parts.join(" ");
}

function esc(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
