import * as fs from "node:fs";
import * as path from "node:path";
import { OrmYamlSerializer, type DiagramLayout, type OrmModel } from "@barwise/core";
import {
  computeNeighborhood,
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
  private activeViewFilter: {
    objectTypeIds: Set<string>;
    factTypeIds: Set<string>;
    subtypeFactIds: Set<string>;
  } | undefined;
  private activeViewName: string | undefined;
  private ghostObjectTypeIds = new Set<string>();
  private renderVersion = 0;

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
          this.hopCount = message.x;
          this.activeViewFilter = undefined;
          this.activeViewName = undefined;
          this.ghostObjectTypeIds.clear();
          this.positionOverrides = {};
          void this.rerender();
        } else if (message.command === "saveView") {
          void this.saveView();
        } else if (message.command === "clearFocus") {
          this.focusEntityId = undefined;
          this.hopCount = undefined;
          this.activeViewFilter = undefined;
          this.activeViewName = undefined;
          this.ghostObjectTypeIds.clear();
          this.positionOverrides = {};
          void this.rerender();
        } else if (message.command === "showNeighbors" && this.model) {
          const neighborhood = computeNeighborhood(this.model, message.nodeId, 1);
          const viewIds = this.activeViewFilter?.objectTypeIds ?? new Set<string>();
          for (const otId of neighborhood.objectTypeIds) {
            if (!viewIds.has(otId) && otId !== message.nodeId) {
              this.ghostObjectTypeIds.add(otId);
            }
          }
          void this.rerender();
        } else if (message.command === "addGhostToView" && this.model) {
          void this.addGhostToView(message.nodeId);
        } else if (message.command === "clearGhosts") {
          this.ghostObjectTypeIds.clear();
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
      } else {
        const ft = model.getFactTypeByName(name);
        if (ft) {
          this.positionOverrides[ft.id] = { x: pos.x, y: pos.y };
        }
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
   * Focus on an element in the diagram: filter to its 1-hop neighborhood
   * and show the hop selector toolbar.
   */
  static highlightElement(elementId: string, _kind: string): void {
    const panel = DiagramPanel.currentPanel;
    if (!panel || panel.disposed || !panel.model) return;
    panel.focusEntityId = elementId;
    panel.hopCount = 1;
    panel.positionOverrides = {};
    void panel.rerender();
  }

  /**
   * Load a saved diagram view by name. Reads the view's element subset
   * from the model and re-renders with that filter.
   */
  static loadView(viewName: string): void {
    const panel = DiagramPanel.currentPanel;
    if (!panel || panel.disposed || !panel.model) return;
    const layout = panel.model.getDiagramLayout(viewName);
    if (!layout) return;

    if (layout.elements && layout.elements.length > 0) {
      // Build an include filter from the element names.
      const objectTypeIds = new Set<string>();
      const factTypeIds = new Set<string>();
      const subtypeFactIds = new Set<string>();

      for (const name of layout.elements) {
        const ot = panel.model.getObjectTypeByName(name);
        if (ot) objectTypeIds.add(ot.id);
      }

      // Auto-include fact types connecting included entities.
      for (const ft of panel.model.factTypes) {
        const allPlayersIncluded = ft.roles.every((r) =>
          objectTypeIds.has(r.playerId),
        );
        if (allPlayersIncluded) factTypeIds.add(ft.id);
      }

      // Auto-include subtype facts between included entities.
      for (const sf of panel.model.subtypeFacts) {
        if (objectTypeIds.has(sf.subtypeId) && objectTypeIds.has(sf.supertypeId)) {
          subtypeFactIds.add(sf.id);
        }
      }

      panel.activeViewFilter = { objectTypeIds, factTypeIds, subtypeFactIds };
      panel.activeViewName = viewName;
    } else {
      panel.activeViewFilter = undefined;
      panel.activeViewName = viewName;
    }

    // Seed positions/orientations from the saved layout.
    panel.seedOverridesFromSavedLayout(panel.model, layout);

    // Clear focus and ghost state.
    panel.focusEntityId = undefined;
    panel.hopCount = undefined;
    panel.ghostObjectTypeIds.clear();

    void panel.rerender();
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
    const viewState = this.activeViewName
      ? { viewName: this.activeViewName, hasGhosts: this.ghostObjectTypeIds.size > 0 }
      : undefined;
    this.panel.webview.html = buildHtml(svg, this.buildFocusState(), viewState);
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
    const version = ++this.renderVersion;
    try {
      const posOverrides: PositionOverrides = this.positionOverrides;
      const oriOverrides: OrientationOverrides = this.orientationOverrides;

      // Expand include filter with ghost entities.
      let includeFilter = this.activeViewFilter;
      if (this.activeViewFilter && this.ghostObjectTypeIds.size > 0) {
        const expandedOtIds = new Set(this.activeViewFilter.objectTypeIds);
        for (const id of this.ghostObjectTypeIds) expandedOtIds.add(id);

        const expandedFtIds = new Set(this.activeViewFilter.factTypeIds);
        for (const ft of this.model.factTypes) {
          const allPlayersIncluded = ft.roles.every((r) =>
            expandedOtIds.has(r.playerId),
          );
          if (allPlayersIncluded) expandedFtIds.add(ft.id);
        }

        const expandedStIds = new Set(this.activeViewFilter.subtypeFactIds);
        for (const sf of this.model.subtypeFacts) {
          if (expandedOtIds.has(sf.subtypeId) && expandedOtIds.has(sf.supertypeId)) {
            expandedStIds.add(sf.id);
          }
        }

        includeFilter = {
          objectTypeIds: expandedOtIds,
          factTypeIds: expandedFtIds,
          subtypeFactIds: expandedStIds,
        };
      }

      const ghostRenderIds = this.computeGhostRenderIds();
      const result = await generateDiagram(this.model, {
        positionOverrides: posOverrides,
        orientationOverrides: oriOverrides,
        focusEntityId: this.focusEntityId,
        hopCount: this.hopCount,
        includeFilter,
        ghostNodeIds: ghostRenderIds,
      });

      // Skip if a newer render was started while we were awaiting.
      if (version !== this.renderVersion) return;

      this.currentLayout = result.layout;
      const viewState = this.activeViewName
        ? { viewName: this.activeViewName, hasGhosts: this.ghostObjectTypeIds.size > 0 }
        : undefined;
      this.panel.webview.html = buildHtml(result.svg, this.buildFocusState(), viewState);
    } catch (err) {
      if (version === this.renderVersion) {
        console.error("Diagram rerender failed:", err);
      }
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
      } else if (node.kind === "fact_type" && this.positionOverrides[node.id]) {
        // Only save manually positioned fact types.
        const ft = this.model.getFactType(node.id);
        if (ft) {
          positions[ft.name] = {
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

  /**
   * Save the current filtered view as a named diagram view.
   * Prompts the user for a view name, then saves the visible elements,
   * positions, and orientations to the .orm.yaml file.
   */
  private async saveView(): Promise<void> {
    if (!this.model || !this.filePath || !this.currentLayout) return;

    // Prompt for view name.
    const focusEntity = this.focusEntityId
      ? this.model.getObjectType(this.focusEntityId)
      : undefined;
    const defaultName = focusEntity
      ? `${focusEntity.name} (${this.hopCount ?? 1}-hop)`
      : "New View";

    const name = await vscode.window.showInputBox({
      prompt: "Name for this diagram view",
      value: defaultName,
    });
    if (!name) return;

    // Collect visible element names from the current layout.
    const elements: string[] = [];
    for (const node of this.currentLayout.nodes) {
      if (node.kind === "object_type") {
        const ot = this.model.getObjectType(node.id);
        if (ot) elements.push(ot.name);
      }
    }

    // Collect positions from the current layout.
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
      } else if (node.kind === "fact_type" && this.positionOverrides[node.id]) {
        const ft = this.model.getFactType(node.id);
        if (ft) {
          positions[ft.name] = {
            x: Math.round(node.x),
            y: Math.round(node.y),
          };
        }
      }
    }

    // Collect orientations.
    const orientations: Record<string, "horizontal" | "vertical"> = {};
    for (const [ftId, ori] of Object.entries(this.orientationOverrides)) {
      const ft = this.model.getFactType(ftId);
      if (ft) orientations[ft.name] = ori;
    }

    try {
      const fileContent = fs.readFileSync(this.filePath, "utf-8");
      const freshModel = saveSerializer.deserialize(fileContent);

      const existing = freshModel.getDiagramLayout(name);
      if (existing) {
        freshModel.updateDiagramLayout({ name, elements, positions, orientations });
      } else {
        freshModel.addDiagramLayout({ name, elements, positions, orientations });
      }

      const yaml = saveSerializer.serialize(freshModel);
      fs.writeFileSync(this.filePath, yaml, "utf-8");
      vscode.window.showInformationMessage(`View "${name}" saved.`);
    } catch (err) {
      vscode.window.showErrorMessage(
        `Failed to save view: ${(err as Error).message}`,
      );
    }
  }

  /**
   * Move a ghost entity into the active view permanently and persist.
   */
  private async addGhostToView(entityId: string): Promise<void> {
    if (!this.model || !this.filePath || !this.activeViewFilter || !this.activeViewName) return;

    const ot = this.model.getObjectType(entityId);
    if (!ot) return;

    // Move from ghost set to view filter.
    this.ghostObjectTypeIds.delete(entityId);
    this.activeViewFilter.objectTypeIds.add(entityId);

    // Recompute fact types for the expanded view.
    for (const ft of this.model.factTypes) {
      const allPlayersIncluded = ft.roles.every((r) =>
        this.activeViewFilter!.objectTypeIds.has(r.playerId),
      );
      if (allPlayersIncluded) this.activeViewFilter.factTypeIds.add(ft.id);
    }

    // Recompute subtype facts.
    for (const sf of this.model.subtypeFacts) {
      if (
        this.activeViewFilter.objectTypeIds.has(sf.subtypeId) &&
        this.activeViewFilter.objectTypeIds.has(sf.supertypeId)
      ) {
        this.activeViewFilter.subtypeFactIds.add(sf.id);
      }
    }

    // Persist to file: add element name to the saved view.
    try {
      const fileContent = fs.readFileSync(this.filePath, "utf-8");
      const freshModel = saveSerializer.deserialize(fileContent);
      const layout = freshModel.getDiagramLayout(this.activeViewName);
      if (layout) {
        const elements = layout.elements ? [...layout.elements] : [];
        if (!elements.includes(ot.name)) {
          elements.push(ot.name);
        }
        freshModel.updateDiagramLayout({ ...layout, elements });
        const yaml = saveSerializer.serialize(freshModel);
        fs.writeFileSync(this.filePath, yaml, "utf-8");
      }
    } catch {
      // Non-critical: view works in memory even if save fails.
    }

    vscode.window.showInformationMessage(
      `Added "${ot.name}" to "${this.activeViewName}".`,
    );
    void this.rerender();
  }

  /**
   * Compute the set of ghost node IDs for rendering, including both
   * ghost object types and fact types that connect to them.
   */
  private computeGhostRenderIds(): Set<string> | undefined {
    if (this.ghostObjectTypeIds.size === 0) return undefined;
    if (!this.model) return undefined;

    const ghostRenderIds = new Set(this.ghostObjectTypeIds);
    // Mark fact types with any ghost player as ghost too.
    for (const ft of this.model.factTypes) {
      if (ft.roles.some((r) => this.ghostObjectTypeIds.has(r.playerId))) {
        ghostRenderIds.add(ft.id);
      }
    }
    return ghostRenderIds;
  }
}

interface FocusState {
  entityId: string;
  entityName: string;
  hopCount: number;
}

interface ViewState {
  viewName: string;
  hasGhosts: boolean;
}

function buildHtml(svg: string, focus?: FocusState, view?: ViewState): string {
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
    g[data-kind="fact_type"] { cursor: move; }

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

    /* Ghost node styling: preview entities shown via "Show Neighbors" */
    g[data-ghost="true"] {
      opacity: 0.45;
    }
    g[data-ghost="true"][data-kind="object_type"] rect {
      stroke-dasharray: 6,3 !important;
    }
    g[data-ghost="true"][data-kind="object_type"] { cursor: pointer; }
    path[data-ghost="true"] {
      opacity: 0.35;
    }

    /* Custom right-click context menu */
    #ctxMenu {
      display: none;
      position: fixed;
      z-index: 20;
      background: var(--vscode-menu-background, #fff);
      color: var(--vscode-menu-foreground, #333);
      border: 1px solid var(--vscode-menu-border, #ccc);
      border-radius: 4px;
      padding: 4px 0;
      box-shadow: 0 2px 8px rgba(0,0,0,0.25);
      min-width: 160px;
      font-size: 13px;
    }
    #ctxMenu.visible { display: block; }
    .ctx-item {
      padding: 6px 16px;
      cursor: pointer;
    }
    .ctx-item:hover {
      background: var(--vscode-menu-selectionBackground, #0078d4);
      color: var(--vscode-menu-selectionForeground, #fff);
    }

    /* View bar: shows when a saved view is loaded */
    #viewBar {
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
    #viewBar.visible { display: flex; }
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
    <button id="saveView" title="Save this view">Save View</button>
    <button id="clearFocus" title="Show full model">Clear</button>
  </div>
  <div id="viewBar">
    <span id="viewLabel">View:</span>
    <button id="clearGhosts" style="display:none" title="Remove preview neighbors">Clear Preview</button>
    <button id="clearView" title="Show full model">Clear View</button>
  </div>
  <div id="ctxMenu">
    <div class="ctx-item" id="ctxShowNeighbors">Show Neighbors</div>
    <div class="ctx-item" id="ctxAddToView">Add to View</div>
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

      // Mousedown: check if on a node or viewport (left-click only).
      viewport.addEventListener('mousedown', function(e) {
        if (e.button !== 0) return; // Only left-click starts drag/pan.
        var nodeGroup = findNodeGroup(e.target) || findFactTypeGroup(e.target);

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

      // Single-click on an entity in the diagram highlights its connections,
      // or if it's a ghost node, adds it to the active view.
      viewport.addEventListener('click', function(e) {
        var nodeGroup = findNodeGroup(e.target);
        if (nodeGroup) {
          var nid = nodeGroup.getAttribute('data-id');
          if (nid && nodeGroup.getAttribute('data-ghost') === 'true' && vscodeApi) {
            // Click ghost node -> add to view.
            vscodeApi.postMessage({ command: 'addGhostToView', nodeId: nid, x: 0, y: 0 });
            return;
          }
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
      document.getElementById('saveView').addEventListener('click', function() {
        if (vscodeApi) {
          vscodeApi.postMessage({ command: 'saveView', nodeId: '', x: 0, y: 0 });
        }
      });

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

      // --- Context menu for "Show Neighbors" ---
      var ctxMenu = document.getElementById('ctxMenu');
      var ctxShowNeighbors = document.getElementById('ctxShowNeighbors');
      var ctxAddToView = document.getElementById('ctxAddToView');
      var ctxTargetId = null;

      function hideCtxMenu() {
        ctxMenu.classList.remove('visible');
        ctxTargetId = null;
      }

      viewport.addEventListener('contextmenu', function(e) {
        var nodeGroup = findNodeGroup(e.target);
        if (!nodeGroup || !vscodeApi) { hideCtxMenu(); return; }

        e.preventDefault();
        ctxTargetId = nodeGroup.getAttribute('data-id');
        var isGhost = nodeGroup.getAttribute('data-ghost') === 'true';

        // Show appropriate menu items.
        ctxShowNeighbors.style.display = isGhost ? 'none' : 'block';
        ctxAddToView.style.display = isGhost ? 'block' : 'none';

        ctxMenu.style.left = e.clientX + 'px';
        ctxMenu.style.top = e.clientY + 'px';
        ctxMenu.classList.add('visible');
      });

      ctxShowNeighbors.addEventListener('click', function() {
        if (ctxTargetId && vscodeApi) {
          vscodeApi.postMessage({ command: 'showNeighbors', nodeId: ctxTargetId, x: 0, y: 0 });
        }
        hideCtxMenu();
      });

      ctxAddToView.addEventListener('click', function() {
        if (ctxTargetId && vscodeApi) {
          vscodeApi.postMessage({ command: 'addGhostToView', nodeId: ctxTargetId, x: 0, y: 0 });
        }
        hideCtxMenu();
      });

      // Hide context menu on click elsewhere.
      document.addEventListener('click', function() { hideCtxMenu(); });

      // --- View bar ---
      var viewBar = document.getElementById('viewBar');
      var viewLabel = document.getElementById('viewLabel');
      var clearGhostsBtn = document.getElementById('clearGhosts');
      var hasView = ${view ? "true" : "false"};

      if (hasView) {
        viewLabel.textContent = ${view ? `'View: ${view.viewName}'` : "'View:'"};
        viewBar.classList.add('visible');
        clearGhostsBtn.style.display = ${view?.hasGhosts ? "'inline-block'" : "'none'"};
      }

      clearGhostsBtn.addEventListener('click', function() {
        if (vscodeApi) {
          vscodeApi.postMessage({ command: 'clearGhosts', nodeId: '', x: 0, y: 0 });
        }
      });

      document.getElementById('clearView').addEventListener('click', function() {
        viewBar.classList.remove('visible');
        if (vscodeApi) {
          vscodeApi.postMessage({ command: 'clearFocus', nodeId: '', x: 0, y: 0 });
        }
      });

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
