import * as path from "node:path";
import type { OrmModel } from "@barwise/core";
import {
  generateDiagram,
  type OrientationOverrides,
  type PositionOverrides,
  type PositionedGraph,
} from "@barwise/diagram";
import * as vscode from "vscode";

/**
 * Manages the ORM diagram webview panel.
 *
 * The panel displays a generated SVG diagram of the active .orm.yaml
 * model. It supports pan, zoom, and drag-to-reposition entity nodes.
 * When an entity is dragged, fact types and edges are re-routed around
 * the new position.
 */
export class DiagramPanel {
  private static currentPanel: DiagramPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private disposed = false;
  private model: OrmModel | undefined;
  private currentLayout: PositionedGraph | undefined;
  private positionOverrides: Record<string, { x: number; y: number }> = {};
  private orientationOverrides: Record<string, "horizontal" | "vertical"> = {};

  private constructor(
    panel: vscode.WebviewPanel,
    svg: string,
    fileName: string,
    model?: OrmModel,
  ) {
    this.panel = panel;
    this.model = model;
    this.update(svg, fileName);

    this.panel.onDidDispose(() => {
      this.disposed = true;
      DiagramPanel.currentPanel = undefined;
    });

    this.panel.webview.onDidReceiveMessage(
      (message: { command: string; nodeId: string; x: number; y: number }) => {
        if (message.command === "nodeMoved" && this.model) {
          // On first drag, pin all entities at their current positions
          // so only the dragged entity moves.
          if (
            Object.keys(this.positionOverrides).length === 0 &&
            this.currentLayout
          ) {
            for (const node of this.currentLayout.nodes) {
              if (node.kind === "object_type") {
                this.positionOverrides[node.id] = {
                  x: node.x,
                  y: node.y,
                };
              }
            }
          }

          this.positionOverrides[message.nodeId] = {
            x: message.x,
            y: message.y,
          };
          void this.rerender();
        } else if (message.command === "toggleOrientation" && this.model) {
          // Pin all entities on first interaction (same as drag).
          if (
            Object.keys(this.positionOverrides).length === 0 &&
            this.currentLayout
          ) {
            for (const node of this.currentLayout.nodes) {
              if (node.kind === "object_type") {
                this.positionOverrides[node.id] = {
                  x: node.x,
                  y: node.y,
                };
              }
            }
          }

          // Toggle orientation for the clicked fact type.
          const ftId = message.nodeId;
          const current = this.orientationOverrides[ftId];
          // Find the current orientation from the layout.
          const ftNode = this.currentLayout?.nodes.find(
            (n): n is import("@barwise/diagram").PositionedFactTypeNode =>
              n.id === ftId && n.kind === "fact_type",
          );
          const layoutOrientation = ftNode?.orientation ?? "horizontal";
          const effectiveCurrent = current ?? layoutOrientation;
          this.orientationOverrides[ftId] =
            effectiveCurrent === "horizontal" ? "vertical" : "horizontal";
          void this.rerender();
        }
      },
    );
  }

  /**
   * Create a new panel or reveal the existing one with updated content.
   */
  static createOrShow(
    extensionUri: vscode.Uri,
    svg: string,
    fileName: string,
    model?: OrmModel,
    layout?: PositionedGraph,
  ): void {
    const column = vscode.ViewColumn.Beside;

    if (DiagramPanel.currentPanel) {
      DiagramPanel.currentPanel.panel.reveal(column);
      DiagramPanel.currentPanel.model = model;
      DiagramPanel.currentPanel.currentLayout = layout;
      // Reset overrides when a new model is loaded.
      if (model) {
        DiagramPanel.currentPanel.positionOverrides = {};
        DiagramPanel.currentPanel.orientationOverrides = {};
      }
      DiagramPanel.currentPanel.update(svg, fileName);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      "ormDiagram",
      "Barwise Diagram",
      column,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [extensionUri],
      },
    );

    DiagramPanel.currentPanel = new DiagramPanel(panel, svg, fileName, model);
    DiagramPanel.currentPanel.currentLayout = layout;
  }

  /**
   * Update the diagram content.
   */
  update(svg: string, fileName: string): void {
    if (this.disposed) return;
    const baseName = path.basename(fileName, ".orm.yaml");
    this.panel.title = `Diagram: ${baseName}`;
    this.panel.webview.html = buildHtml(svg);
  }

  /**
   * Re-generate the diagram with current position overrides.
   */
  private async rerender(): Promise<void> {
    if (!this.model || this.disposed) return;
    try {
      const posOverrides: PositionOverrides = this.positionOverrides;
      const oriOverrides: OrientationOverrides = this.orientationOverrides;
      const result = await generateDiagram(this.model, {
        positionOverrides: posOverrides,
        orientationOverrides: oriOverrides,
      });
      this.currentLayout = result.layout;
      this.panel.webview.html = buildHtml(result.svg);
    } catch {
      // Silently ignore re-render errors during drag.
    }
  }
}

function buildHtml(svg: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Barwise Diagram</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      overflow: hidden;
      background: #fafafa;
      width: 100vw;
      height: 100vh;
    }
    #viewport {
      width: 100%;
      height: 100%;
      cursor: grab;
      overflow: hidden;
    }
    #viewport:active { cursor: grabbing; }
    #viewport.node-dragging { cursor: move; }
    #diagram {
      transform-origin: 0 0;
    }
    #controls {
      position: fixed;
      bottom: 12px;
      right: 12px;
      display: flex;
      gap: 6px;
      z-index: 10;
    }
    #controls button {
      background: var(--vscode-button-background, #0078d4);
      color: var(--vscode-button-foreground, #fff);
      border: none;
      padding: 4px 10px;
      cursor: pointer;
      font-size: 13px;
      border-radius: 3px;
    }
    #controls button:hover {
      background: var(--vscode-button-hoverBackground, #106ebe);
    }
    g[data-kind="object_type"] { cursor: move; }
    g[data-kind="fact_type"] { cursor: pointer; }
  </style>
</head>
<body>
  <div id="viewport">
    <div id="diagram">
      ${svg}
    </div>
  </div>
  <div id="controls">
    <button id="zoomIn" title="Zoom in">+</button>
    <button id="zoomOut" title="Zoom out">-</button>
    <button id="resetView" title="Reset view">Fit</button>
  </div>
  <script>
    (function() {
      var vscodeApi = (typeof acquireVsCodeApi === 'function')
        ? acquireVsCodeApi() : null;

      var viewport = document.getElementById('viewport');
      var diagram = document.getElementById('diagram');
      var scale = 1;
      var panX = 0;
      var panY = 0;

      // Viewport panning state.
      var panning = false;
      var panLastX = 0;
      var panLastY = 0;

      // Node dragging state.
      var dragNode = null;     // The <g> element being dragged
      var dragNodeId = null;   // data-id of the dragged node
      var dragStartX = 0;      // Mouse position at drag start (client coords)
      var dragStartY = 0;
      var dragOffsetX = 0;     // Accumulated drag offset in SVG coords
      var dragOffsetY = 0;
      var dragOrigTransform = '';  // Original transform of the node

      function applyTransform() {
        diagram.style.transform =
          'translate(' + panX + 'px, ' + panY + 'px) scale(' + scale + ')';
      }

      // Find the closest object_type <g> ancestor of a target element.
      function findNodeGroup(el) {
        while (el && el !== viewport) {
          if (el.tagName === 'g' && el.getAttribute('data-kind') === 'object_type') {
            return el;
          }
          el = el.parentElement;
        }
        return null;
      }

      // Find the closest fact_type <g> ancestor of a target element.
      function findFactTypeGroup(el) {
        while (el && el !== viewport) {
          if (el.tagName === 'g' && el.getAttribute('data-kind') === 'fact_type') {
            return el;
          }
          el = el.parentElement;
        }
        return null;
      }

      // Parse the original position of a node from its first child element.
      function getNodePosition(g) {
        var rect = g.querySelector('rect, ellipse');
        if (!rect) return { x: 0, y: 0 };
        if (rect.tagName === 'ellipse') {
          return {
            x: parseFloat(rect.getAttribute('cx')) - parseFloat(rect.getAttribute('rx')),
            y: parseFloat(rect.getAttribute('cy')) - parseFloat(rect.getAttribute('ry'))
          };
        }
        return {
          x: parseFloat(rect.getAttribute('x')),
          y: parseFloat(rect.getAttribute('y'))
        };
      }

      // Mouse wheel zoom.
      viewport.addEventListener('wheel', function(e) {
        e.preventDefault();
        var delta = e.deltaY > 0 ? 0.9 : 1.1;
        var newScale = Math.min(5, Math.max(0.1, scale * delta));

        var rect = viewport.getBoundingClientRect();
        var mx = e.clientX - rect.left;
        var my = e.clientY - rect.top;
        panX = mx - (mx - panX) * (newScale / scale);
        panY = my - (my - panY) * (newScale / scale);
        scale = newScale;
        applyTransform();
      }, { passive: false });

      // Mousedown: check if on a node or viewport.
      viewport.addEventListener('mousedown', function(e) {
        var nodeGroup = findNodeGroup(e.target);

        if (nodeGroup) {
          // Start node drag.
          e.stopPropagation();
          dragNode = nodeGroup;
          dragNodeId = nodeGroup.getAttribute('data-id');
          dragStartX = e.clientX;
          dragStartY = e.clientY;
          dragOffsetX = 0;
          dragOffsetY = 0;
          dragOrigTransform = nodeGroup.getAttribute('transform') || '';
          viewport.classList.add('node-dragging');
        } else {
          // Start viewport pan.
          panning = true;
          panLastX = e.clientX;
          panLastY = e.clientY;
        }
      });

      window.addEventListener('mousemove', function(e) {
        if (dragNode) {
          // Node dragging: translate the node group in SVG coordinates.
          var dx = (e.clientX - dragStartX) / scale;
          var dy = (e.clientY - dragStartY) / scale;
          dragOffsetX = dx;
          dragOffsetY = dy;
          dragNode.setAttribute('transform',
            dragOrigTransform + ' translate(' + dx + ',' + dy + ')');
        } else if (panning) {
          // Viewport panning.
          panX += e.clientX - panLastX;
          panY += e.clientY - panLastY;
          panLastX = e.clientX;
          panLastY = e.clientY;
          applyTransform();
        }
      });

      window.addEventListener('mouseup', function() {
        if (dragNode && dragNodeId && vscodeApi) {
          // Compute final position in SVG coordinates.
          var origPos = getNodePosition(dragNode);
          var finalX = origPos.x + dragOffsetX;
          var finalY = origPos.y + dragOffsetY;

          vscodeApi.postMessage({
            command: 'nodeMoved',
            nodeId: dragNodeId,
            x: finalX,
            y: finalY
          });
        }

        dragNode = null;
        dragNodeId = null;
        panning = false;
        viewport.classList.remove('node-dragging');
      });

      // Double-click on a fact type to toggle its orientation.
      viewport.addEventListener('dblclick', function(e) {
        var ftGroup = findFactTypeGroup(e.target);
        if (ftGroup && vscodeApi) {
          e.preventDefault();
          e.stopPropagation();
          var ftId = ftGroup.getAttribute('data-id');
          if (ftId) {
            vscodeApi.postMessage({
              command: 'toggleOrientation',
              nodeId: ftId,
              x: 0,
              y: 0
            });
          }
        }
      });

      // Zoom controls.
      document.getElementById('zoomIn').addEventListener('click', function() {
        scale = Math.min(5, scale * 1.2);
        applyTransform();
      });
      document.getElementById('zoomOut').addEventListener('click', function() {
        scale = Math.max(0.1, scale * 0.8);
        applyTransform();
      });
      document.getElementById('resetView').addEventListener('click', function() {
        // Fit the diagram to the viewport by computing the actual
        // bounding box of all SVG content, then scaling and positioning
        // so the top-left corner aligns with the viewport's top-left.
        var svg = diagram.querySelector('svg');
        if (svg) {
          var vw = viewport.clientWidth;
          var vh = viewport.clientHeight;
          // Use getBBox to get the actual rendered content bounds,
          // which accounts for all elements regardless of viewBox.
          var bbox = svg.getBBox();
          var sw = bbox.width || 1;
          var sh = bbox.height || 1;
          var margin = 20;
          scale = Math.min((vw - 2 * margin) / sw, (vh - 2 * margin) / sh);
          // Position so the content's top-left aligns with viewport top-left + margin.
          panX = margin - bbox.x * scale;
          panY = margin - bbox.y * scale;
        } else {
          scale = 1;
          panX = 0;
          panY = 0;
        }
        applyTransform();
      });

      // Auto-fit on initial load.
      requestAnimationFrame(function() {
        document.getElementById('resetView').click();
      });
    })();
  </script>
</body>
</html>`;
}
