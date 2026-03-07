import { describe, it, expect } from "vitest";
import { YamlSourceMap } from "../../src/server/YamlSourceMap.js";

const SAMPLE_YAML = `orm_version: "1.0"

model:
  name: "Test"
  object_types:
    - id: "ot-customer"
      name: "Customer"
      kind: "entity"
    - id: "ot-name"
      name: "Name"
      kind: "value"
  fact_types:
    - id: "ft-customer-has-name"
      name: "Customer has Name"
      roles:
        - id: "r-customer-has"
          player: "ot-customer"
          role_name: "has"
        - id: "r-name-of"
          player: "ot-name"
          role_name: "is of"
      readings:
        - "{0} has {1}"
      constraints:
        - type: "internal_uniqueness"
          roles: ["r-customer-has"]
`;

describe("YamlSourceMap", () => {
  it("maps object type IDs to their source positions", () => {
    const map = new YamlSourceMap(SAMPLE_YAML);

    const customerPos = map.getPosition("ot-customer");
    expect(customerPos).toBeDefined();
    // "- id: ot-customer" starts at line 5 (0-indexed), char 6 (indent)
    expect(customerPos!.line).toBe(5);
    expect(customerPos!.character).toBe(6);

    const namePos = map.getPosition("ot-name");
    expect(namePos).toBeDefined();
    // "- id: ot-name" starts at line 8 (0-indexed), char 6
    expect(namePos!.line).toBe(8);
  });

  it("maps fact type IDs to their source positions", () => {
    const map = new YamlSourceMap(SAMPLE_YAML);

    const ftPos = map.getPosition("ft-customer-has-name");
    expect(ftPos).toBeDefined();
    // "- id: ft-customer-has-name" starts at line 12 (0-indexed)
    expect(ftPos!.line).toBe(12);
  });

  it("maps role IDs to their source positions", () => {
    const map = new YamlSourceMap(SAMPLE_YAML);

    const rolePos = map.getPosition("r-customer-has");
    expect(rolePos).toBeDefined();
    // "- id: r-customer-has" starts at line 15 (0-indexed), char 10
    expect(rolePos!.line).toBe(15);
    expect(rolePos!.character).toBe(10);

    const role2Pos = map.getPosition("r-name-of");
    expect(role2Pos).toBeDefined();
    expect(role2Pos!.line).toBe(18);
  });

  it("returns undefined for unknown IDs", () => {
    const map = new YamlSourceMap(SAMPLE_YAML);
    expect(map.getPosition("nonexistent-id")).toBeUndefined();
  });

  it("reports the correct size", () => {
    const map = new YamlSourceMap(SAMPLE_YAML);
    // ot-customer, ot-name, ft-customer-has-name, r-customer-has, r-name-of = 5
    expect(map.size).toBe(5);
  });

  it("handles empty YAML gracefully", () => {
    const map = new YamlSourceMap("");
    expect(map.size).toBe(0);
    expect(map.getPosition("anything")).toBeUndefined();
  });

  it("handles malformed YAML gracefully", () => {
    const map = new YamlSourceMap("{{{{not valid");
    expect(map.size).toBe(0);
    expect(map.getPosition("anything")).toBeUndefined();
  });

  it("handles YAML with no id fields", () => {
    const map = new YamlSourceMap("orm_version: '1.0'\nmodel:\n  name: test\n");
    expect(map.size).toBe(0);
  });

  it("uses 0-indexed positions (LSP-compatible)", () => {
    // In a bare sequence, the map node starts after the "- " indicator.
    const yaml = `- id: "first"\n  name: "First"\n`;
    const map = new YamlSourceMap(yaml);
    const pos = map.getPosition("first");
    expect(pos).toBeDefined();
    expect(pos!.line).toBe(0);
    // Character 2: the map content starts after "- "
    expect(pos!.character).toBe(2);
  });
});
