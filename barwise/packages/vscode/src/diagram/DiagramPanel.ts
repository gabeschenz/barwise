import * as path from "node:path";
import * as vscode from "vscode";

/**
 * Manages the ORM diagram webview panel.
 *
 * The panel displays a generated SVG diagram of the active .orm.yaml
 * model. It supports pan and zoom via mouse wheel and drag.
 */
export class DiagramPanel {
  private static currentPanel: DiagramPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private disposed = false;

  private constructor(
    panel: vscode.WebviewPanel,
    svg: string,
    fileName: string,
  ) {
    this.panel = panel;
    this.update(svg, fileName);

    this.panel.onDidDispose(() => {
      this.disposed = true;
      DiagramPanel.currentPanel = undefined;
    });
  }

  /**
   * Create a new panel or reveal the existing one with updated content.
   */
  static createOrShow(
    extensionUri: vscode.Uri,
    svg: string,
    fileName: string,
  ): void {
    const column = vscode.ViewColumn.Beside;

    if (DiagramPanel.currentPanel) {
      DiagramPanel.currentPanel.panel.reveal(column);
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

    DiagramPanel.currentPanel = new DiagramPanel(panel, svg, fileName);
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
      const viewport = document.getElementById('viewport');
      const diagram = document.getElementById('diagram');
      let scale = 1;
      let panX = 0;
      let panY = 0;
      let dragging = false;
      let lastX = 0;
      let lastY = 0;

      function applyTransform() {
        diagram.style.transform =
          'translate(' + panX + 'px, ' + panY + 'px) scale(' + scale + ')';
      }

      // Mouse wheel zoom.
      viewport.addEventListener('wheel', function(e) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        const newScale = Math.min(5, Math.max(0.1, scale * delta));

        // Zoom toward cursor position.
        const rect = viewport.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        panX = mx - (mx - panX) * (newScale / scale);
        panY = my - (my - panY) * (newScale / scale);
        scale = newScale;
        applyTransform();
      }, { passive: false });

      // Pan via drag.
      viewport.addEventListener('mousedown', function(e) {
        dragging = true;
        lastX = e.clientX;
        lastY = e.clientY;
      });
      window.addEventListener('mousemove', function(e) {
        if (!dragging) return;
        panX += e.clientX - lastX;
        panY += e.clientY - lastY;
        lastX = e.clientX;
        lastY = e.clientY;
        applyTransform();
      });
      window.addEventListener('mouseup', function() {
        dragging = false;
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
        scale = 1;
        panX = 0;
        panY = 0;
        applyTransform();
      });
    })();
  </script>
</body>
</html>`;
}
