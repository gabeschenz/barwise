import { describe, it, expect } from "vitest";
import {
  formatFregmaComment,
  stripFregmaComments,
  truncate,
} from "../../src/annotation/helpers.js";

describe("formatFregmaComment", () => {
  it("formats a TODO comment", () => {
    expect(formatFregmaComment("todo", "Fix this")).toBe(
      "# TODO(fregma): Fix this",
    );
  });

  it("formats a NOTE comment", () => {
    expect(formatFregmaComment("note", "For context")).toBe(
      "# NOTE(fregma): For context",
    );
  });
});

describe("stripFregmaComments", () => {
  it("removes TODO comments", () => {
    const yaml = [
      "object_types:",
      "  - name: Customer",
      "    # TODO(fregma): Fix this",
      "    kind: entity",
    ].join("\n");

    expect(stripFregmaComments(yaml)).toBe(
      ["object_types:", "  - name: Customer", "    kind: entity"].join("\n"),
    );
  });

  it("removes NOTE comments", () => {
    const yaml = [
      "object_types:",
      "  - name: Customer",
      "    # NOTE(fregma): Info here",
      "    kind: entity",
    ].join("\n");

    expect(stripFregmaComments(yaml)).toBe(
      ["object_types:", "  - name: Customer", "    kind: entity"].join("\n"),
    );
  });

  it("preserves non-fregma comments", () => {
    const yaml = [
      "object_types:",
      "  # Regular comment",
      "  - name: Customer",
    ].join("\n");

    expect(stripFregmaComments(yaml)).toBe(yaml);
  });

  it("handles mixed content", () => {
    const yaml = [
      "model:",
      "  name: Test",
      "  # TODO(fregma): Model-level note",
      "  # Regular comment",
      "  object_types:",
      "    - name: Order",
      "      # NOTE(fregma): Something",
      "      kind: entity",
    ].join("\n");

    const expected = [
      "model:",
      "  name: Test",
      "  # Regular comment",
      "  object_types:",
      "    - name: Order",
      "      kind: entity",
    ].join("\n");

    expect(stripFregmaComments(yaml)).toBe(expected);
  });
});

describe("truncate", () => {
  it("returns short strings unchanged", () => {
    expect(truncate("hello", 10)).toBe("hello");
  });

  it("truncates long strings with ellipsis", () => {
    expect(truncate("a very long string here", 10)).toBe("a very ...");
  });

  it("handles exact-length strings", () => {
    expect(truncate("12345", 5)).toBe("12345");
  });
});
