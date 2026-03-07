/**
 * Tests for reading template validation and expansion.
 *
 * ORM fact types use reading templates like "{0} places {1}" where each
 * placeholder index corresponds to a role position. validateReadingTemplate
 * ensures every placeholder is present and in range; expandReading
 * substitutes player names for placeholders. These tests verify both
 * forward and inverse readings for unary, binary, and ternary fact types.
 */
import { describe, expect, it } from "vitest";
import { expandReading, validateReadingTemplate } from "../../src/model/ReadingOrder.js";

describe("ReadingOrder", () => {
  describe("validateReadingTemplate", () => {
    it("accepts a valid binary reading", () => {
      const errors = validateReadingTemplate("{0} places {1}", 2);
      expect(errors).toEqual([]);
    });

    it("accepts a valid inverse reading", () => {
      const errors = validateReadingTemplate("{1} is placed by {0}", 2);
      expect(errors).toEqual([]);
    });

    it("reports missing placeholders", () => {
      const errors = validateReadingTemplate("{0} places", 2);
      expect(errors.length).toBe(1);
      expect(errors[0]).toContain("missing placeholder {1}");
    });

    it("reports out-of-range placeholders", () => {
      const errors = validateReadingTemplate("{0} relates to {2}", 2);
      expect(errors.length).toBe(2); // missing {1} and {2} is out of range
    });

    it("rejects empty template", () => {
      const errors = validateReadingTemplate("", 2);
      expect(errors.length).toBe(1);
      expect(errors[0]).toContain("non-empty");
    });

    it("accepts a unary reading", () => {
      const errors = validateReadingTemplate("{0} is active", 1);
      expect(errors).toEqual([]);
    });

    it("accepts a ternary reading", () => {
      const errors = validateReadingTemplate(
        "{0} assigned {1} on {2}",
        3,
      );
      expect(errors).toEqual([]);
    });
  });

  describe("expandReading", () => {
    it("expands a binary forward reading", () => {
      const result = expandReading("{0} places {1}", [
        "Customer",
        "Order",
      ]);
      expect(result).toBe("Customer places Order");
    });

    it("expands a binary inverse reading", () => {
      const result = expandReading("{1} is placed by {0}", [
        "Customer",
        "Order",
      ]);
      expect(result).toBe("Order is placed by Customer");
    });

    it("handles missing names gracefully", () => {
      const result = expandReading("{0} relates to {1}", ["Customer"]);
      expect(result).toBe("Customer relates to {1}");
    });

    it("expands a ternary reading", () => {
      const result = expandReading("{0} assigned {1} on {2}", [
        "Employee",
        "Department",
        "Date",
      ]);
      expect(result).toBe("Employee assigned Department on Date");
    });
  });
});
