import type {
  Position,
  PositionedConstraintEdge,
  PositionedConstraintNode,
  PositionedEdge,
  PositionedFactTypeNode,
  PositionedGraph,
  PositionedObjectTypeNode,
  PositionedRoleBox,
  PositionedSubtypeEdge,
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

  const hasSubtypeEdges = graph.subtypeEdges.length > 0;

  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" `
      + `width="${svgWidth}" height="${svgHeight}" `
      + `viewBox="${-padding} ${-padding} ${svgWidth} ${svgHeight}" `
      + `style="font-family: ${theme.FONT_FAMILY}; background: #fafafa;">`,
  );

  // Define arrowhead marker for subtype edges.
  if (hasSubtypeEdges) {
    parts.push(renderSubtypeArrowDef());
  }

  // Render role edges first (behind nodes).
  for (const edge of graph.edges) {
    parts.push(renderEdge(edge));
  }

  // Render constraint edges (dashed lines, behind nodes).
  for (const ce of graph.constraintEdges) {
    parts.push(renderConstraintEdge(ce));
  }

  // Render subtype edges (behind nodes, on top of role edges).
  for (const se of graph.subtypeEdges) {
    parts.push(renderSubtypeEdge(se));
  }

  // Render nodes.
  for (const node of graph.nodes) {
    if (node.kind === "object_type") {
      parts.push(renderObjectType(node));
    } else if (node.kind === "fact_type") {
      parts.push(renderFactType(node));
    } else {
      parts.push(renderConstraintNode(node));
    }
  }

  parts.push("</svg>");
  return parts.join("\n");
}

function renderObjectType(node: PositionedObjectTypeNode): string {
  const isEntity = node.objectTypeKind === "entity";
  const hasAnnotations = node.annotations !== undefined && node.annotations.length > 0;
  const fill = isEntity ? theme.COLOR_ENTITY_FILL : theme.COLOR_VALUE_FILL;
  const stroke = hasAnnotations
    ? theme.COLOR_ANNOTATION_STROKE
    : isEntity
    ? theme.COLOR_ENTITY_STROKE
    : theme.COLOR_VALUE_STROKE;
  const dashArray = hasAnnotations
    ? theme.ANNOTATION_DASH
    : isEntity
    ? undefined
    : "4,3";
  const cx = node.x + node.width / 2;
  const cy = node.y + node.height / 2;

  const parts: string[] = [];
  parts.push(`<g data-id="${esc(node.id)}" data-kind="object_type">`);

  // Add hover title with annotation messages.
  if (hasAnnotations) {
    parts.push(`<title>${esc(node.annotations!.join("\n"))}</title>`);
  }

  if (isEntity) {
    // Entity types are rounded rectangles (soft corners).
    const dashAttr = dashArray ? ` stroke-dasharray="${dashArray}"` : "";
    parts.push(
      `<rect x="${node.x}" y="${node.y}" `
        + `width="${node.width}" height="${node.height}" `
        + `rx="${theme.OT_CORNER_RADIUS}" ry="${theme.OT_CORNER_RADIUS}" `
        + `fill="${fill}" stroke="${stroke}" stroke-width="1.5"${dashAttr}/>`,
    );
  } else {
    // Value types are rendered as dashed-border ovals.
    const rx = node.width / 2;
    const ry = node.height / 2;
    parts.push(
      `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" `
        + `fill="${fill}" stroke="${stroke}" stroke-width="1.5" `
        + `stroke-dasharray="${dashArray ?? "4,3"}"/>`,
    );
  }

  // Annotation marker (small warning dot at top-right corner).
  if (hasAnnotations) {
    const markerX = node.x + node.width - 4;
    const markerY = node.y + 4;
    parts.push(
      `<circle data-kind="annotation-marker" `
        + `cx="${markerX}" cy="${markerY}" `
        + `r="${theme.ANNOTATION_MARKER_RADIUS}" `
        + `fill="${theme.COLOR_ANNOTATION_MARKER}"/>`,
    );
  }

  // Compute vertical offsets for name, reference mode, and aliases.
  // Lines are stacked vertically and centered within the node.
  const hasAliases = node.aliases !== undefined && node.aliases.length > 0;
  const hasRefMode = node.referenceMode !== undefined;
  // Shift name upward when additional lines exist below it.
  const nameOffset = hasAliases && hasRefMode
    ? -8
    : hasAliases || hasRefMode
    ? -3
    : 0;

  // Name label.
  parts.push(
    `<text x="${cx}" y="${cy + nameOffset}" `
      + `text-anchor="middle" dominant-baseline="central" `
      + `fill="${theme.COLOR_TEXT}" font-size="${theme.FONT_SIZE_LABEL}" `
      + `font-weight="600">${esc(node.name)}</text>`,
  );

  // Reference mode (below name for entity types).
  if (hasRefMode) {
    const refModeY = hasAliases ? cy + 5 : cy + 12;
    parts.push(
      `<text x="${cx}" y="${refModeY}" `
        + `text-anchor="middle" dominant-baseline="central" `
        + `fill="${theme.COLOR_REF_MODE}" font-size="${theme.FONT_SIZE_REF_MODE}">`
        + `(${esc(node.referenceMode!)})</text>`,
    );
  }

  // Aliases (below reference mode, or below name if no reference mode).
  if (hasAliases) {
    const aliasLabel = `(a.k.a. ${node.aliases!.map((a) => `'${a}'`).join(", ")})`;
    const aliasY = hasRefMode ? cy + 18 : cy + 12;
    parts.push(
      `<text x="${cx}" y="${aliasY}" `
        + `text-anchor="middle" dominant-baseline="central" `
        + `fill="${theme.COLOR_ALIAS}" font-size="${theme.FONT_SIZE_ALIAS}" `
        + `font-style="italic">${esc(aliasLabel)}</text>`,
    );
  }

  parts.push("</g>");
  return parts.join("\n");
}

function renderFactType(node: PositionedFactTypeNode): string {
  const hasAnnotations = node.annotations !== undefined && node.annotations.length > 0;
  const parts: string[] = [];
  parts.push(`<g data-id="${esc(node.id)}" data-kind="fact_type">`);

  // Add hover title with annotation messages.
  if (hasAnnotations) {
    parts.push(`<title>${esc(node.annotations!.join("\n"))}</title>`);
  }

  // Objectification box: rounded rectangle enclosing the role boxes.
  if (node.isObjectified) {
    const pad = theme.OBJECTIFICATION_PADDING;
    parts.push(
      `<rect data-kind="objectification" `
        + `x="${node.x - pad}" y="${node.y - pad}" `
        + `width="${node.width + pad * 2}" height="${node.height + pad * 2}" `
        + `rx="${theme.OBJECTIFICATION_CORNER_RADIUS}" `
        + `ry="${theme.OBJECTIFICATION_CORNER_RADIUS}" `
        + `fill="${theme.COLOR_OBJECTIFICATION_FILL}" `
        + `stroke="${theme.COLOR_OBJECTIFICATION_STROKE}" `
        + `stroke-width="${theme.OBJECTIFICATION_STROKE_WIDTH}"/>`,
    );
  }

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
      `<rect x="${barX}" y="${barY}" `
        + `width="${barWidth}" height="${theme.UNIQUENESS_BAR_HEIGHT}" `
        + `fill="${theme.COLOR_SPANNING}" rx="1"/>`,
    );
  }

  // Fact type name label (below the bar).
  const cx = node.x + node.width / 2;
  const labelY = node.y + node.height + 14;
  parts.push(
    `<text x="${cx}" y="${labelY}" `
      + `text-anchor="middle" fill="${theme.COLOR_TEXT}" `
      + `font-size="${theme.FONT_SIZE_ROLE}" font-style="italic">`
      + `${esc(node.name)}</text>`,
  );

  // Ring constraint label (below the fact type name).
  if (node.ringConstraint) {
    const ringY = labelY + 14;
    parts.push(
      `<text x="${cx}" y="${ringY}" `
        + `text-anchor="middle" `
        + `font-size="${theme.FONT_SIZE_ANNOTATION}" `
        + `fill="${theme.COLOR_ANNOTATION}">${esc(node.ringConstraint.label)}</text>`,
    );
  }

  // Objectified entity name label (below all other labels).
  if (node.isObjectified && node.objectifiedEntityName) {
    const objLabelY = node.ringConstraint ? labelY + 28 : labelY + 14;
    parts.push(
      `<text x="${cx}" y="${objLabelY}" `
        + `text-anchor="middle" fill="${theme.COLOR_OBJECTIFICATION_STROKE}" `
        + `font-size="${theme.FONT_SIZE_LABEL}" font-weight="600">`
        + `${esc(node.objectifiedEntityName)}</text>`,
    );
  }

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
    `<rect x="${x}" y="${y}" `
      + `width="${role.width}" height="${role.height}" `
      + `fill="${theme.COLOR_ROLE_FILL}" `
      + `stroke="${theme.COLOR_ROLE_STROKE}" stroke-width="1"/>`,
  );

  // Single-role uniqueness bar (above the role box).
  if (role.hasUniqueness) {
    const barX = x + 4;
    const barWidth = role.width - 8;
    const barY = y - theme.UNIQUENESS_BAR_OFFSET - theme.UNIQUENESS_BAR_HEIGHT;
    parts.push(
      `<rect x="${barX}" y="${barY}" `
        + `width="${barWidth}" height="${theme.UNIQUENESS_BAR_HEIGHT}" `
        + `fill="${theme.COLOR_UNIQUENESS}" rx="1"/>`,
    );
  }

  // Mandatory dot (on the connection side of the role box).
  if (role.isMandatory) {
    const dotX = x + role.width / 2;
    const dotY = y + role.height + theme.MANDATORY_DOT_RADIUS + 2;
    parts.push(
      `<circle cx="${dotX}" cy="${dotY}" `
        + `r="${theme.MANDATORY_DOT_RADIUS}" `
        + `fill="${theme.COLOR_MANDATORY}"/>`,
    );
  }

  // Frequency label (below the role box, after mandatory dot if present).
  if (role.frequencyMin !== undefined) {
    const freqX = x + role.width / 2;
    const freqY = y + role.height + (role.isMandatory ? 18 : 12);
    const maxStr = role.frequencyMax === "unbounded" ? "*" : String(role.frequencyMax);
    const label = role.frequencyMin === role.frequencyMax
      ? String(role.frequencyMin)
      : `${role.frequencyMin}..${maxStr}`;
    parts.push(
      `<text x="${freqX}" y="${freqY}" text-anchor="middle" `
        + `font-size="${theme.FONT_SIZE_ANNOTATION}" `
        + `fill="${theme.COLOR_ANNOTATION}">${esc(label)}</text>`,
    );
  }

  return parts.join("\n");
}

function renderEdge(edge: PositionedEdge): string {
  if (edge.points.length < 2) return "";

  const d = buildPathData(edge.points);
  return (
    `<path d="${d}" fill="none" `
    + `stroke="${theme.COLOR_EDGE}" stroke-width="1.2"/>`
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

/**
 * SVG <defs> block containing the arrowhead marker for subtype edges.
 *
 * The arrowhead is a filled triangle pointing in the direction of the
 * supertype (the "is-a" target), matching standard ORM 2 notation.
 */
function renderSubtypeArrowDef(): string {
  const s = theme.SUBTYPE_ARROW_SIZE;
  return (
    `<defs>`
    + `<marker id="subtype-arrow" viewBox="0 0 ${s} ${s}" `
    + `refX="${s}" refY="${s / 2}" `
    + `markerWidth="${s}" markerHeight="${s}" orient="auto-start-reverse">`
    + `<path d="M 0 0 L ${s} ${s / 2} L 0 ${s} Z" `
    + `fill="${theme.COLOR_SUBTYPE}"/>`
    + `</marker>`
    + `</defs>`
  );
}

function renderSubtypeEdge(edge: PositionedSubtypeEdge): string {
  if (edge.points.length < 2) return "";

  const d = buildPathData(edge.points);
  return (
    `<path data-kind="subtype" d="${d}" fill="none" `
    + `stroke="${theme.COLOR_SUBTYPE}" `
    + `stroke-width="${theme.SUBTYPE_STROKE_WIDTH}" `
    + `marker-end="url(#subtype-arrow)"/>`
  );
}

/**
 * Render a constraint node as a circled symbol.
 *
 * Each constraintKind maps to a distinct symbol inside the circle:
 * - external_uniqueness: horizontal bar
 * - exclusion: "X"
 * - exclusive_or: "X" with mandatory dot
 * - disjunctive_mandatory: filled dot
 * - subset: arrow
 * - equality: "="
 */
function renderConstraintNode(node: PositionedConstraintNode): string {
  const cx = node.x + node.width / 2;
  const cy = node.y + node.height / 2;
  const r = theme.CONSTRAINT_RADIUS;
  const stroke = theme.COLOR_CONSTRAINT_STROKE;
  const sw = theme.CONSTRAINT_STROKE_WIDTH;

  const parts: string[] = [];
  parts.push(
    `<g data-id="${esc(node.id)}" data-kind="constraint" `
      + `data-constraint-kind="${node.constraintKind}">`,
  );

  // Outer circle.
  parts.push(
    `<circle cx="${cx}" cy="${cy}" r="${r}" `
      + `fill="${theme.COLOR_CONSTRAINT_FILL}" `
      + `stroke="${stroke}" stroke-width="${sw}"/>`,
  );

  // Inner symbol varies by constraint kind.
  const h = r * 0.55; // half-size for inner symbols
  switch (node.constraintKind) {
    case "external_uniqueness": {
      // Horizontal bar.
      const barW = r * 1.2;
      const barH = 2;
      parts.push(
        `<rect x="${cx - barW / 2}" y="${cy - barH / 2}" `
          + `width="${barW}" height="${barH}" fill="${stroke}"/>`,
      );
      break;
    }
    case "exclusion": {
      // "X" shape.
      parts.push(
        `<line x1="${cx - h}" y1="${cy - h}" x2="${cx + h}" y2="${cy + h}" `
          + `stroke="${stroke}" stroke-width="${sw}"/>`
          + `<line x1="${cx + h}" y1="${cy - h}" x2="${cx - h}" y2="${cy + h}" `
          + `stroke="${stroke}" stroke-width="${sw}"/>`,
      );
      break;
    }
    case "exclusive_or": {
      // "X" shape plus mandatory dot below circle.
      parts.push(
        `<line x1="${cx - h}" y1="${cy - h}" x2="${cx + h}" y2="${cy + h}" `
          + `stroke="${stroke}" stroke-width="${sw}"/>`
          + `<line x1="${cx + h}" y1="${cy - h}" x2="${cx - h}" y2="${cy + h}" `
          + `stroke="${stroke}" stroke-width="${sw}"/>`,
      );
      // Mandatory dot below.
      parts.push(
        `<circle cx="${cx}" cy="${cy + r + 5}" r="3" fill="${stroke}"/>`,
      );
      break;
    }
    case "disjunctive_mandatory": {
      // Filled dot inside circle.
      parts.push(
        `<circle cx="${cx}" cy="${cy}" r="${h}" fill="${stroke}"/>`,
      );
      break;
    }
    case "subset": {
      // Subset arrow (right-pointing).
      parts.push(
        `<path d="M ${cx - h} ${cy} L ${cx + h} ${cy}" `
          + `stroke="${stroke}" stroke-width="${sw}"/>`
          + `<path d="M ${cx + h * 0.3} ${cy - h * 0.6} L ${cx + h} ${cy} `
          + `L ${cx + h * 0.3} ${cy + h * 0.6}" `
          + `stroke="${stroke}" stroke-width="${sw}" fill="none"/>`,
      );
      break;
    }
    case "equality": {
      // "=" sign (two horizontal lines).
      const gap = h * 0.4;
      const lineW = r * 1.0;
      parts.push(
        `<line x1="${cx - lineW / 2}" y1="${cy - gap}" `
          + `x2="${cx + lineW / 2}" y2="${cy - gap}" `
          + `stroke="${stroke}" stroke-width="${sw}"/>`
          + `<line x1="${cx - lineW / 2}" y1="${cy + gap}" `
          + `x2="${cx + lineW / 2}" y2="${cy + gap}" `
          + `stroke="${stroke}" stroke-width="${sw}"/>`,
      );
      break;
    }
  }

  parts.push("</g>");
  return parts.join("\n");
}

function renderConstraintEdge(edge: PositionedConstraintEdge): string {
  if (edge.points.length < 2) return "";

  const d = buildPathData(edge.points);
  return (
    `<path data-kind="constraint-edge" d="${d}" fill="none" `
    + `stroke="${theme.COLOR_CONSTRAINT_STROKE}" `
    + `stroke-width="${theme.CONSTRAINT_STROKE_WIDTH}" `
    + `stroke-dasharray="${theme.CONSTRAINT_EDGE_DASH}"/>`
  );
}

function esc(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}
