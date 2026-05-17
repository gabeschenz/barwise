/**
 * Tests for scaffoldProject: the YAML of a fresh, empty project manifest.
 */
import { describe, expect, it } from "vitest";
import { scaffoldProject } from "../../src/project/scaffoldProject.js";
import { ProjectSerializer } from "../../src/serialization/ProjectSerializer.js";

describe("scaffoldProject", () => {
  it("produces a manifest with the given project name", () => {
    const yaml = scaffoldProject("My Warehouse");
    const project = new ProjectSerializer().deserialize(yaml);
    expect(project.name).toBe("My Warehouse");
    expect(project.domains).toEqual([]);
  });

  it("trims surrounding whitespace from the name", () => {
    const project = new ProjectSerializer().deserialize(
      scaffoldProject("  Spaced  "),
    );
    expect(project.name).toBe("Spaced");
  });

  it("rejects an empty name", () => {
    expect(() => scaffoldProject("   ")).toThrow();
  });
});
