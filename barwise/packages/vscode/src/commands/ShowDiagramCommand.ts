import { OrmYamlSerializer } from "@barwise/core";
import type { DiagramLayout } from "@barwise/core";
import { generateDiagram } from "@barwise/diagram";
import type { OrientationOverrides, PositionOverrides } from "@barwise/diagram";
import * as vscode from "vscode";
import { DiagramPanel } from "../diagram/DiagramPanel.js";

const serializer = new OrmYamlSerializer();

export class ShowDiagramCommand {
  private readonly extensionUri: vscode.Uri;

  constructor(extensionUri: vscode.Uri) {
    this.extensionUri = extensionUri;
  }

  async execute(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || !editor.document.fileName.endsWith(".orm.yaml")) {
      vscode.window.showWarningMessage(
        "Open an .orm.yaml file to show its diagram.",
      );
      return;
    }

    const text = editor.document.getText();
    try {
      const model = serializer.deserialize(text);

      // Load saved diagram layout (use "Default" or the first available).
      const savedLayout = model.getDiagramLayout("Default")
        ?? model.diagramLayouts[0];

      const posOverrides = savedLayout
        ? buildPositionOverrides(savedLayout, model)
        : undefined;
      const oriOverrides = savedLayout
        ? buildOrientationOverrides(savedLayout, model)
        : undefined;

      const result = await generateDiagram(model, {
        positionOverrides: posOverrides,
        orientationOverrides: oriOverrides,
      });
      DiagramPanel.createOrShow(
        this.extensionUri,
        result.svg,
        editor.document.fileName,
        model,
        result.layout,
        savedLayout,
      );
    } catch (err) {
      vscode.window.showErrorMessage(
        `Failed to generate diagram: ${(err as Error).message}`,
      );
    }
  }
}

/**
 * Convert a saved DiagramLayout (name-keyed) to PositionOverrides (id-keyed)
 * for the layout engine.
 */
function buildPositionOverrides(
  layout: DiagramLayout,
  model: import("@barwise/core").OrmModel,
): PositionOverrides | undefined {
  const entries = Object.entries(layout.positions);
  if (entries.length === 0) return undefined;
  const overrides: Record<string, { x: number; y: number }> = {};
  for (const [name, pos] of entries) {
    const ot = model.getObjectTypeByName(name);
    if (ot) {
      overrides[ot.id] = pos;
    }
  }
  return Object.keys(overrides).length > 0 ? overrides : undefined;
}

/**
 * Convert a saved DiagramLayout (name-keyed) to OrientationOverrides (id-keyed)
 * for the layout engine.
 */
function buildOrientationOverrides(
  layout: DiagramLayout,
  model: import("@barwise/core").OrmModel,
): OrientationOverrides | undefined {
  const entries = Object.entries(layout.orientations);
  if (entries.length === 0) return undefined;
  const overrides: Record<string, "horizontal" | "vertical"> = {};
  for (const [name, ori] of entries) {
    const ft = model.getFactTypeByName(name);
    if (ft) {
      overrides[ft.id] = ori;
    }
  }
  return Object.keys(overrides).length > 0 ? overrides : undefined;
}
