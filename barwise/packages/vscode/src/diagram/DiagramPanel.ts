import * as fs from "node:fs";
import * as path from "node:path";
import { OrmYamlSerializer, type DiagramLayout, type OrmModel } from "@barwise/core";
import {
  generateDiagram,
  type OrientationOverrides,
  type PositionOverrides,
  type PositionedGraph,
} from "@barwise/diagram";
import * as vscode from "vscode";

const saveSerializer = new OrmYamlSerializer();

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
  private filePath: string | undefined;
  private currentLayout: PositionedGraph | undefined;
  private positionOverrides: Record<string, { x: number; y: number }> = {};
  private orientationOverrides: Record<string, "horizontal" | "vertical"> = {};
  private hasUnsavedChanges = false;
  private focusEntityId: string | undefined;
  private hopCount: number | undefined;

  private constructor(
    panel: vscode.WebviewPanel,
    svg: string,
    fileName: string,
    model?: OrmModel,
  ) {
    this.panel = panel;
    this.model = model;
    this.filePath = fileName;
    this.update(svg, fileName);

    this.panel.onDidDispose(() => {
      this.disposed = true;
      DiagramPanel.currentPanel = undefined;
    });

    this.panel.webview.onDidReceiveMessage(
      (message: { command: string; nodeId: string; x: number; y: number }) => {
        if (message.command === "nodeMoved" && this.model) {
          this.pinAllEntitiesIfNeeded();

          this.positionOverrides[message.nodeId] = {
            x: message.x,
            y: message.y,
          };
          this.hasUnsavedChanges = true;
          void this.rerender();
        } else if (message.command === "toggleOrientation" && this.model) {
          this.pinAllEntitiesIfNeeded();

          // Toggle orientation for the clicked fact type.
          const ftId = message.nodeId;
          const current = this.orientationOverrides[ftId];
          const ftNode = this.currentLayout?.nodes.find(
            (n): n is import("@barwise/diagram").PositionedFactTypeNode =>
              n.id === ftId && n.kind === "fact_type",
          );
          const layoutOrientation = ftNode?.orientation ?? "horizontal";
          const effectiveCurrent = current ?? layoutOrientation;
          this.orientationOverrides[ftId] =
            effectiveCurrent === "horizontal" ? "vertical" : "horizontal";
          this.hasUnsavedChanges = true;
          void this.rerender();
        } else if (message.command === "saveLayout") {
          void this.saveLayout();
        } else if (message.command === "focusEntity") {
          this.focusEntityId = message.nodeId;
          this.hopCount = message.x; // x field reused for hop count
          // Clear position overrides so the subset gets a fresh layout.
          this.positionOverrides = {};
          void this.rerender();
        } else if (message.command === "clearFocus") {
          this.focusEntityId = undefined;
          this.hopCount = undefined;
          this.positionOverrides = {};
          void this.rerender();
        }
      },
    );
  }

  /**
   * On first interaction, pin all entities at their current layout positions
   * so only the interacted element changes.
   */
  private pinAllEntitiesIfNeeded(): void {
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
    savedLayout?: DiagramLayout,
  ): void {
    const column = vscode.ViewColumn.Beside;

    if (DiagramPanel.currentPanel) {
      DiagramPanel.currentPanel.panel.reveal(column);
      DiagramPanel.currentPanel.model = model;
      DiagramPanel.currentPanel.filePath = fileName;
      DiagramPanel.currentPanel.currentLayout = layout;
      if (model) {
        DiagramPanel.currentPanel.seedOverridesFromSavedLayout(model, savedLayout);
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

    const dp = new DiagramPanel(panel, svg, fileName, model);
    dp.currentLayout = layout;
    if (model) {
      dp.seedOverridesFromSavedLayout(model, savedLayout);
    }
    DiagramPanel.currentPanel = dp;
  }

  /**
   * Seed position/orientation overrides from a saved DiagramLayout so that
   * subsequent drags only move the dragged entity (all others are pinned).
   */
  private seedOverridesFromSavedLayout(
    model: OrmModel,
    saved?: DiagramLayout,
  ): void {
    this.positionOverrides = {};
    this.orientationOverrides = {};
    this.hasUnsavedChanges = false;

    if (!saved) return;

    // Convert name-keyed positions to id-keyed overrides.
    for (const [name, pos] of Object.entries(saved.positions)) {
      const ot = model.getObjectTypeByName(name);
      if (ot) {
        this.positionOverrides[ot.id] = { x: pos.x, y: pos.y };
      }
    }

    // Convert name-keyed orientations to id-keyed overrides.
    for (const [name, ori] of Object.entries(saved.orientations)) {
      const ft = model.getFactTypeByName(name);
      if (ft) {
        this.orientationOverrides[ft.id] = ori;
      }
    }
  }

  /**
   * Highlight an element and its connections in the diagram.
   * Called from the sidebar tree view or other commands.
   */
  static highlightElement(elementId: string, kind: string): void {
    if (!DiagramPanel.currentPanel || DiagramPanel.currentPanel.disposed) return;
    void DiagramPanel.currentPanel.panel.webview.postMessage({
      command: "highlight",
      elementId,
      kind,
    });
  }

  /**
   * Clear any active highlighting in the diagram.
   */
  static clearHighlight(): void {
    if (!DiagramPanel.currentPanel || DiagramPanel.currentPanel.disposed) return;
    void DiagramPanel.currentPanel.panel.webview.postMessage({
      command: "clearHighlight",
    });
  }

  /**
   * Update the diagram content.
   */
  update(svg: string, fileName: string): void {
    if (this.disposed) return;
    const baseName = path.basename(fileName, ".orm.yaml");
    this.panel.title = `Diagram: ${baseName}`;
    this.panel.webview.html = buildHtml(svg, this.buildFocusState());
  }

  private buildFocusState(): FocusState | undefined {
    if (!this.focusEntityId || !this.model) return undefined;
    const ot = this.model.getObjectType(this.focusEntityId);
    return {
      entityId: this.focusEntityId,
      entityName: ot?.name ?? "Entity",
      hopCount: this.hopCount ?? 1,
    };
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
        focusEntityId: this.focusEntityId,
        hopCount: this.hopCount,
      });
      this.currentLayout = result.layout;
      this.panel.webview.html = buildHtml(result.svg, this.buildFocusState());
    } catch {
      // Silently ignore re-render errors during drag.
    }
  }

  /**
   * Save the current diagram layout (positions + orientations) back to the
   * .orm.yaml file's `diagrams` section.
   */
  private async saveLayout(): Promise<void> {
    if (!this.model || !this.filePath || !this.currentLayout) return;

    // Build name-keyed positions from current id-keyed overrides.
    const positions: Record<string, { x: number; y: number }> = {};
    for (const node of this.currentLayout.nodes) {
      if (node.kind === "object_type") {
        const ot = this.model.getObjectType(node.id);
        if (ot) {
          positions[ot.name] = {
            x: Math.round(node.x),
            y: Math.round(node.y),
          };
        }
      }
    }

    // Build name-keyed orientations from current id-keyed overrides.
    const orientations: Record<string, "horizontal" | "vertical"> = {};
    for (const [ftId, ori] of Object.entries(this.orientationOverrides)) {
      const ft = this.model.getFactType(ftId);
      if (ft) {
        orientations[ft.name] = ori;
      }
    }

    const layoutName = "Default";
    const layout: DiagramLayout = { name: layoutName, positions, orientations };

    // Re-read the file to get the latest content, then update the model.
    try {
      const fileContent = fs.readFileSync(this.filePath, "utf-8");
      const freshModel = saveSerializer.deserialize(fileContent);

      const existing = freshModel.getDiagramLayout(layoutName);
      if (existing) {
        freshModel.updateDiagramLayout(layout);
      } else {
        freshModel.addDiagramLayout(layout);
      }

      const yaml = saveSerializer.serialize(freshModel);
      fs.writeFileSync(this.filePath, yaml, "utf-8");
      this.hasUnsavedChanges = false;
      vscode.window.showInformationMessage("Diagram layout saved.");
    } catch (err) {
      vscode.window.showErrorMessage(
        `Failed to save diagram layout: ${(err as Error).message}`,
      );
    }
  }
}

interface FocusState {
  entityId: string;
  entityName: string;
  hopCount: number;
}

function buildHtml(svg: string, focus?: FocusState): string {
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
    #controls button, #hopBar button {
      background: var(--vscode-button-background, #0078d4);
      color: var(--vscode-button-foreground, #fff);
      border: none;
      padding: 4px 10px;
      cursor: pointer;
      font-size: 13px;
      border-radius: 3px;
    }
    #controls button:hover, #hopBar button:hover {
      background: var(--vscode-button-hoverBackground, #106ebe);
    }
    #hopBar {
      position: fixed;
      top: 12px;
      left: 50%;
      transform: translateX(-50%);
      display: none;
      gap: 4px;
      align-items: center;
      z-index: 10;
      background: var(--vscode-editor-background, #fff);
      padding: 6px 12px;
      border-radius: 6px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      font-size: 13px;
      color: var(--vscode-foreground, #333);
    }
    #hopBar.visible { display: flex; }
    #hopBar button.active {
      background: var(--vscode-button-hoverBackground, #106ebe);
      outline: 2px solid var(--vscode-focusBorder, #007fd4);
    }
    g[data-kind="object_type"] { cursor: move; }
    g[data-kind="fact_type"] { cursor: pointer; }

    /* Highlight system: when .highlighting is on the SVG, dim everything
       then un-dim elements with .highlighted */
    svg.highlighting g[data-id],
    svg.highlighting path[data-kind="edge"],
    svg.highlighting path[data-kind="subtype"],
    svg.highlighting path[data-kind="constraint-edge"] {
      opacity: 0.15;
      transition: opacity 0.2s;
    }
    svg.highlighting .highlighted {
      opacity: 1 !important;
      transition: opacity 0.2s;
    }
  </style>
</head>
<body>
  <div id="viewport">
    <div id="diagram">
      ${svg}
    </div>
  </div>
  <div id="hopBar">
    <span id="hopLabel">Focus:</span>
    <button class="hop-btn" data-hops="1">1 hop</button>
    <button class="hop-btn" data-hops="2">2 hops</button>
    <button class="hop-btn" data-hops="3">3 hops</button>
    <button class="hop-btn" data-hops="0">All</button>
    <button id="clearFocus" title="Show full model">Clear</button>
  </div>
  <div id="controls">
    <button id="saveLayout" title="Save positions to .orm.yaml">Save</button>
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

      // --- Highlight system ---
      // Receives messages from the extension host to highlight elements.
      function clearHighlight() {
        var svg = diagram.querySelector('svg');
        if (!svg) return;
        svg.classList.remove('highlighting');
        var highlighted = svg.querySelectorAll('.highlighted');
        for (var i = 0; i < highlighted.length; i++) {
          highlighted[i].classList.remove('highlighted');
        }
      }

      function highlightElement(elementId, kind) {
        var svg = diagram.querySelector('svg');
        if (!svg) return;

        clearHighlight();
        svg.classList.add('highlighting');

        // Highlight the element itself.
        var el = svg.querySelector('[data-id="' + elementId + '"]');
        if (el) el.classList.add('highlighted');

        if (kind === 'entity_type' || kind === 'value_type') {
          // Highlight edges connected to this entity.
          var edges = svg.querySelectorAll('path[data-source="' + elementId + '"]');
          for (var i = 0; i < edges.length; i++) {
            edges[i].classList.add('highlighted');
            // Also highlight the connected node on the other end.
            var targetId = edges[i].getAttribute('data-target');
            if (targetId) {
              var target = svg.querySelector('[data-id="' + targetId + '"]');
              if (target) target.classList.add('highlighted');
            }
          }
          // Also check edges where this entity is the target (subtype edges).
          var targetEdges = svg.querySelectorAll('path[data-target="' + elementId + '"]');
          for (var j = 0; j < targetEdges.length; j++) {
            targetEdges[j].classList.add('highlighted');
            var srcId = targetEdges[j].getAttribute('data-source');
            if (srcId) {
              var src = svg.querySelector('[data-id="' + srcId + '"]');
              if (src) src.classList.add('highlighted');
            }
          }
        } else if (kind === 'fact_type') {
          // Highlight edges connected to this fact type.
          var ftEdges = svg.querySelectorAll('path[data-target="' + elementId + '"]');
          for (var k = 0; k < ftEdges.length; k++) {
            ftEdges[k].classList.add('highlighted');
            var srcNodeId = ftEdges[k].getAttribute('data-source');
            if (srcNodeId) {
              var srcNode = svg.querySelector('[data-id="' + srcNodeId + '"]');
              if (srcNode) srcNode.classList.add('highlighted');
            }
          }
        } else if (kind === 'subtype_fact') {
          // Highlight both entities in the subtype relationship.
          var subEdges = svg.querySelectorAll(
            'path[data-kind="subtype"][data-source="' + elementId + '"],'
            + 'path[data-kind="subtype"][data-target="' + elementId + '"]'
          );
          for (var m = 0; m < subEdges.length; m++) {
            subEdges[m].classList.add('highlighted');
            var s = subEdges[m].getAttribute('data-source');
            var t = subEdges[m].getAttribute('data-target');
            if (s) { var sn = svg.querySelector('[data-id="' + s + '"]'); if (sn) sn.classList.add('highlighted'); }
            if (t) { var tn = svg.querySelector('[data-id="' + t + '"]'); if (tn) tn.classList.add('highlighted'); }
          }
        }
      }

      // Listen for messages from the extension host.
      window.addEventListener('message', function(e) {
        var msg = e.data;
        if (msg.command === 'highlight') {
          highlightElement(msg.elementId, msg.kind);
        } else if (msg.command === 'clearHighlight') {
          clearHighlight();
        }
      });

      // Click on diagram background clears highlight.
      viewport.addEventListener('click', function(e) {
        if (!findNodeGroup(e.target) && !findFactTypeGroup(e.target)) {
          clearHighlight();
        }
      });

      // Single-click on an entity in the diagram highlights its connections.
      viewport.addEventListener('click', function(e) {
        var nodeGroup = findNodeGroup(e.target);
        if (nodeGroup) {
          var nid = nodeGroup.getAttribute('data-id');
          if (nid) highlightElement(nid, 'entity_type');
          return;
        }
        var ftGroup = findFactTypeGroup(e.target);
        if (ftGroup) {
          var fid = ftGroup.getAttribute('data-id');
          if (fid) highlightElement(fid, 'fact_type');
        }
      });

      // --- Hop selector ---
      var hopBar = document.getElementById('hopBar');
      var hopLabel = document.getElementById('hopLabel');
      var focusNodeId = ${focus ? `'${focus.entityId}'` : "null"};

      // Double-click on an entity opens the hop selector.
      // (Single click still highlights; double-click enters focus mode.)
      viewport.addEventListener('dblclick', function(e) {
        var nodeGroup = findNodeGroup(e.target);
        if (nodeGroup && vscodeApi) {
          e.preventDefault();
          e.stopPropagation();
          focusNodeId = nodeGroup.getAttribute('data-id');
          var nameEl = nodeGroup.querySelector('text');
          var name = nameEl ? nameEl.textContent : 'Entity';
          hopLabel.textContent = name + ':';
          hopBar.classList.add('visible');
          // Default to 1 hop.
          setActiveHop(1);
          vscodeApi.postMessage({
            command: 'focusEntity',
            nodeId: focusNodeId,
            x: 1, // hop count
            y: 0
          });
          return;
        }
        // Double-click on fact type toggles orientation (existing behavior).
        var ftGroup = findFactTypeGroup(e.target);
        if (ftGroup && vscodeApi) {
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

      function setActiveHop(hops) {
        var btns = hopBar.querySelectorAll('.hop-btn');
        for (var i = 0; i < btns.length; i++) {
          var btnHops = parseInt(btns[i].getAttribute('data-hops'));
          if (btnHops === hops) {
            btns[i].classList.add('active');
          } else {
            btns[i].classList.remove('active');
          }
        }
      }

      // Hop buttons.
      var hopBtns = document.querySelectorAll('.hop-btn');
      for (var i = 0; i < hopBtns.length; i++) {
        hopBtns[i].addEventListener('click', function() {
          if (!focusNodeId || !vscodeApi) return;
          var hops = parseInt(this.getAttribute('data-hops'));
          setActiveHop(hops);
          vscodeApi.postMessage({
            command: 'focusEntity',
            nodeId: focusNodeId,
            x: hops === 0 ? 999 : hops, // 0 means "all" -> use large number
            y: 0
          });
        });
      }

      // Clear focus.
      document.getElementById('clearFocus').addEventListener('click', function() {
        focusNodeId = null;
        hopBar.classList.remove('visible');
        if (vscodeApi) {
          vscodeApi.postMessage({ command: 'clearFocus', nodeId: '', x: 0, y: 0 });
        }
      });

      // Initialize hop bar if we're in focus mode (after rerender).
      if (focusNodeId) {
        hopLabel.textContent = ${focus ? `'${focus.entityName}:'` : "'Entity:'"};
        hopBar.classList.add('visible');
        setActiveHop(${focus?.hopCount ?? 1});
      }

      // Save layout button.
      document.getElementById('saveLayout').addEventListener('click', function() {
        if (vscodeApi) {
          vscodeApi.postMessage({ command: 'saveLayout', nodeId: '', x: 0, y: 0 });
        }
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
