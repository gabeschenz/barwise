/**
 * Tests for describe_domain MCP tool.
 *
 * Verifies that the tool returns structured domain descriptions.
 */

import { describe, it, expect } from "vitest";
import { executeDescribeDomain } from "../../src/tools/describeDomain.js";

describe("describe_domain tool", () => {
  const simpleModel = `
name: Test Model
object_types:
  - name: Customer
    kind: entity
    is_independent: true
    reference_mode: cust_id
    definition: A person who buys products
  - name: Order
    kind: entity
    is_independent: true
    reference_mode: order_num
fact_types:
  - name: Customer places Order
    roles:
      - name: places
        player: Customer
      - name: is placed by
        player: Order
    readings:
      - template: "{0} places {1}"
        role_order: [0, 1]
    constraints:
      - type: internal_uniqueness
        covers_roles: [1]
      - type: mandatory_role
        covers_roles: [1]
`;

  describe("full summary (no focus)", () => {
    it("returns structured domain description", () => {
      const result = executeDescribeDomain(simpleModel);

      expect(result.content).toHaveLength(1);
      expect(result.content[0]!.type).toBe("text");

      const parsed = JSON.parse(result.content[0]!.text);

      expect(parsed.summary).toBeDefined();
      expect(parsed.summary).toContain("Test Model");

      expect(parsed.entities).toHaveLength(2);
      expect(parsed.factTypes).toHaveLength(1);
      expect(parsed.constraints.length).toBeGreaterThanOrEqual(2);
    });

    it("includes entity definitions", () => {
      const result = executeDescribeDomain(simpleModel);

      const parsed = JSON.parse(result.content[0]!.text);

      const customer = parsed.entities.find(
        (e: { name: string }) => e.name === "Customer",
      );
      expect(customer).toBeDefined();
      expect(customer.definition).toBe("A person who buys products");
    });

    it("includes fact type readings", () => {
      const result = executeDescribeDomain(simpleModel);

      const parsed = JSON.parse(result.content[0]!.text);

      expect(parsed.factTypes[0]!.primaryReading).toContain("places");
    });

    it("includes constraint verbalizations", () => {
      const result = executeDescribeDomain(simpleModel);

      const parsed = JSON.parse(result.content[0]!.text);

      expect(parsed.constraints.length).toBeGreaterThanOrEqual(1);
      expect(parsed.constraints[0]!.verbalization).toBeDefined();
    });
  });

  describe("entity focus", () => {
    it("returns only the focused entity and related elements", () => {
      const result = executeDescribeDomain(simpleModel, "Customer");

      const parsed = JSON.parse(result.content[0]!.text);

      expect(parsed.entities).toHaveLength(1);
      expect(parsed.entities[0]!.name).toBe("Customer");

      // Should include fact types involving Customer.
      expect(parsed.factTypes.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("constraint type focus", () => {
    it("returns all constraints of the specified type", () => {
      const result = executeDescribeDomain(simpleModel, "mandatory");

      const parsed = JSON.parse(result.content[0]!.text);

      // Should have at least one mandatory constraint.
      expect(parsed.constraints.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("includePopulations option", () => {
    const modelWithPopulation = `
name: Test Model
object_types:
  - name: Customer
    kind: entity
    is_independent: true
    reference_mode: cust_id
  - name: Order
    kind: entity
    is_independent: true
    reference_mode: order_num
fact_types:
  - name: Customer places Order
    roles:
      - name: places
        player: Customer
      - name: is placed by
        player: Order
    readings:
      - template: "{0} places {1}"
        role_order: [0, 1]
    constraints:
      - type: internal_uniqueness
        covers_roles: [1]
populations:
  - fact_type: Customer places Order
    description: Sample orders
    instances:
      - role_values:
          "0": C001
          "1": O123
      - role_values:
          "0": C001
          "1": O124
`;

    it("includes populations by default", () => {
      const result = executeDescribeDomain(modelWithPopulation);

      const parsed = JSON.parse(result.content[0]!.text);

      expect(parsed.populations).toBeDefined();
      expect(parsed.populations.length).toBeGreaterThanOrEqual(1);
    });

    it("excludes populations when includePopulations is false", () => {
      const result = executeDescribeDomain(
        modelWithPopulation,
        undefined,
        false,
      );

      const parsed = JSON.parse(result.content[0]!.text);

      expect(parsed.populations).toBeUndefined();
    });
  });

  describe("error handling", () => {
    it("handles invalid YAML", () => {
      const invalidYaml = "not: valid: yaml:";

      const result = executeDescribeDomain(invalidYaml);

      const parsed = JSON.parse(result.content[0]!.text);
      expect(parsed.error).toBeDefined();
    });
  });
});
