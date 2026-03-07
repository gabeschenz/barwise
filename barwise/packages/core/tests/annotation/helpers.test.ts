import { describe, expect, it } from "vitest";
import {
  formatBarwiseComment,
  stripBarwiseComments,
  truncate,
} from "../../src/annotation/helpers.js";

describe("formatBarwiseComment", () => {
  it("formats a TODO comment", () => {
    expect(formatBarwiseComment("todo", "Fix this")).toBe(
      "# TODO(barwise): Fix this",
    );
  });

  it("formats a NOTE comment", () => {
    expect(formatBarwiseComment("note", "For context")).toBe(
      "# NOTE(barwise): For context",
    );
  });
});

describe("stripBarwiseComments", () => {
  it("removes TODO comments", () => {
    const yaml = [
      "object_types:",
      "  - name: Customer",
      "    # TODO(barwise): Fix this",
      "    kind: entity",
    ].join("\n");

    expect(stripBarwiseComments(yaml)).toBe(
      ["object_types:", "  - name: Customer", "    kind: entity"].join("\n"),
    );
  });

  it("removes NOTE comments", () => {
    const yaml = [
      "object_types:",
      "  - name: Customer",
      "    # NOTE(barwise): Info here",
      "    kind: entity",
    ].join("\n");

    expect(stripBarwiseComments(yaml)).toBe(
      ["object_types:", "  - name: Customer", "    kind: entity"].join("\n"),
    );
  });

  it("preserves non-barwise comments", () => {
    const yaml = [
      "object_types:",
      "  # Regular comment",
      "  - name: Customer",
    ].join("\n");

    expect(stripBarwiseComments(yaml)).toBe(yaml);
  });

  it("handles mixed content", () => {
    const yaml = [
      "model:",
      "  name: Test",
      "  # TODO(barwise): Model-level note",
      "  # Regular comment",
      "  object_types:",
      "    - name: Order",
      "      # NOTE(barwise): Something",
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

    expect(stripBarwiseComments(yaml)).toBe(expected);
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
