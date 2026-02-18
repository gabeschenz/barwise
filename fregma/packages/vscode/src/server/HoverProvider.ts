import { Hover, type Position } from "vscode-languageserver/node.js";
import type { TextDocument } from "vscode-languageserver-textdocument";
import { parse } from "yaml";
import {
  OrmYamlSerializer,
  Verbalizer,
  type OrmModel,
} from "@fregma/core";

/**
 * Provides hover information for .orm.yaml files.
 *
 * Hovering over an object type name shows its definition and the
 * fact types it participates in (verbalized).
 */
export class HoverProvider {
  private readonly serializer = new OrmYamlSerializer();
  private readonly verbalizer = new Verbalizer();

  provideHover(
    document: TextDocument,
    position: Position,
  ): Hover | null {
    const text = document.getText();
    const line = getLine(text, position.line);
    const word = getWordAtPosition(line, position.character);
    if (!word) return null;

    let model: OrmModel;
    try {
      model = this.serializer.deserialize(text);
    } catch {
      return null;
    }

    // Check if the word matches an object type name.
    const ot = model.getObjectTypeByName(word);
    if (ot) {
      return this.objectTypeHover(ot, model);
    }

    // Check if the word matches an object type id (for player references).
    const otById = model.getObjectType(word);
    if (otById) {
      return this.objectTypeHover(otById, model);
    }

    return null;
  }

  private objectTypeHover(
    ot: { id: string; name: string; kind: string; definition?: string },
    model: OrmModel,
  ): Hover {
    const lines: string[] = [];
    lines.push(`**${ot.name}** (${ot.kind})`);

    if (ot.definition) {
      lines.push("", ot.definition);
    }

    // Show fact types this object type participates in.
    const factTypes = model.factTypesForObjectType(ot.id);
    if (factTypes.length > 0) {
      lines.push("", "**Fact types:**");
      for (const ft of factTypes) {
        const verbalizations = this.verbalizer.factTypes.verbalizeAll(
          ft,
          model,
        );
        for (const v of verbalizations) {
          lines.push(`- ${v.text}`);
        }
      }
    }

    return {
      contents: {
        kind: "markdown",
        value: lines.join("\n"),
      },
    };
  }
}

function getLine(text: string, line: number): string {
  const lines = text.split("\n");
  return lines[line] ?? "";
}

function getWordAtPosition(
  line: string,
  character: number,
): string | undefined {
  // Find word boundaries around the cursor position.
  const wordPattern = /[\w-]+/g;
  let match: RegExpExecArray | null;
  while ((match = wordPattern.exec(line)) !== null) {
    const start = match.index;
    const end = start + match[0]!.length;
    if (character >= start && character <= end) {
      return match[0];
    }
  }
  return undefined;
}
