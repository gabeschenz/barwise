/**
 * Tests for code format registration.
 */
import { clearFormats, getImporter, listImporters, registerBuiltinFormats } from "@barwise/core";
import { beforeEach, describe, expect, it } from "vitest";
import { registerCodeFormats } from "../../src/formats/registration.js";

describe("registerCodeFormats", () => {
  beforeEach(() => {
    clearFormats();
  });

  it("registers TypeScript format", () => {
    registerCodeFormats();

    const importer = getImporter("typescript");
    expect(importer).toBeDefined();
    expect(importer!.name).toBe("typescript");
    expect(importer!.inputKind).toBe("directory");
  });

  it("is idempotent", () => {
    registerCodeFormats();
    registerCodeFormats();
    registerCodeFormats();

    const importers = listImporters().filter((f) => f.name === "typescript");
    expect(importers).toHaveLength(1);
  });

  it("works alongside registerBuiltinFormats", () => {
    registerBuiltinFormats();
    registerCodeFormats();

    const allImporters = listImporters();
    const names = allImporters.map((f) => f.name).sort();
    expect(names).toContain("ddl");
    expect(names).toContain("openapi");
    expect(names).toContain("dbt");
    expect(names).toContain("sql");
    expect(names).toContain("typescript");
  });
});
