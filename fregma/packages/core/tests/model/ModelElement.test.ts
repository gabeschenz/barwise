import { describe, it, expect } from "vitest";
import { ModelElement } from "../../src/model/ModelElement.js";

describe("ModelElement", () => {
  it("assigns a UUID when no id is provided", () => {
    const el = new ModelElement("Test");
    expect(el.id).toBeDefined();
    expect(el.id.length).toBeGreaterThan(0);
  });

  it("uses the provided id when given", () => {
    const el = new ModelElement("Test", "custom-id-123");
    expect(el.id).toBe("custom-id-123");
  });

  it("trims the name", () => {
    const el = new ModelElement("  Padded Name  ");
    expect(el.name).toBe("Padded Name");
  });

  it("throws on empty name", () => {
    expect(() => new ModelElement("")).toThrow("non-empty");
  });

  it("throws on whitespace-only name", () => {
    expect(() => new ModelElement("   ")).toThrow("non-empty");
  });

  it("allows renaming", () => {
    const el = new ModelElement("Original");
    el.name = "Renamed";
    expect(el.name).toBe("Renamed");
  });

  it("throws on renaming to empty string", () => {
    const el = new ModelElement("Original");
    expect(() => {
      el.name = "";
    }).toThrow("non-empty");
  });

  it("preserves id across renames", () => {
    const el = new ModelElement("Original");
    const id = el.id;
    el.name = "Renamed";
    expect(el.id).toBe(id);
  });

  it("generates unique ids for different elements", () => {
    const el1 = new ModelElement("First");
    const el2 = new ModelElement("Second");
    expect(el1.id).not.toBe(el2.id);
  });
});
