/**
 * Tests for the AnnotationCollector.
 *
 * Verifies regex-based extraction of Bean Validation and JPA/Hibernate
 * annotations from Java and Kotlin source code.
 */
import { describe, expect, it } from "vitest";
import { collectAnnotations } from "../../src/context/AnnotationCollector.js";

describe("collectAnnotations", () => {
  describe("Bean Validation annotations", () => {
    it("extracts @NotNull on a field", () => {
      const source = `
public class Order {
    @NotNull
    private String name;
}`;
      const annotations = collectAnnotations(source, "Order.java");

      expect(annotations.length).toBeGreaterThanOrEqual(1);
      const notNull = annotations.find((a) => a.annotation === "NotNull");
      expect(notNull).toBeDefined();
      expect(notNull!.className).toBe("Order");
      expect(notNull!.targetName).toBe("name");
      expect(notNull!.filePath).toBe("Order.java");
    });

    it("extracts @Size with parameters", () => {
      const source = `
public class Customer {
    @Size(min = 1, max = 100)
    private String name;
}`;
      const annotations = collectAnnotations(source, "Customer.java");

      const size = annotations.find((a) => a.annotation === "Size");
      expect(size).toBeDefined();
      expect(size!.parameters).toEqual({ min: 1, max: 100 });
    });

    it("extracts @Min with single value", () => {
      const source = `
public class Product {
    @Min(0)
    private int price;
}`;
      const annotations = collectAnnotations(source, "Product.java");

      const min = annotations.find((a) => a.annotation === "Min");
      expect(min).toBeDefined();
      expect(min!.parameters).toEqual({ value: 0 });
    });

    it("extracts @Pattern with regexp", () => {
      const source = `
public class User {
    @Pattern(regexp = "\\\\d+")
    private String code;
}`;
      const annotations = collectAnnotations(source, "User.java");

      const pattern = annotations.find((a) => a.annotation === "Pattern");
      expect(pattern).toBeDefined();
      expect(pattern!.parameters["regexp"]).toBe("\\\\d+");
    });
  });

  describe("JPA annotations", () => {
    it("extracts @Entity on a class", () => {
      const source = `
@Entity
public class Customer {
    @Id
    private Long id;
}`;
      const annotations = collectAnnotations(source, "Customer.java");

      const entity = annotations.find((a) => a.annotation === "Entity");
      expect(entity).toBeDefined();
      expect(entity!.targetKind).toBe("class");
      expect(entity!.targetName).toBe("Customer");

      const id = annotations.find((a) => a.annotation === "Id");
      expect(id).toBeDefined();
    });

    it("extracts @ManyToOne relationship", () => {
      const source = `
public class Order {
    @ManyToOne
    private Customer customer;
}`;
      const annotations = collectAnnotations(source, "Order.java");

      const manyToOne = annotations.find((a) => a.annotation === "ManyToOne");
      expect(manyToOne).toBeDefined();
      expect(manyToOne!.targetName).toBe("customer");
      expect(manyToOne!.className).toBe("Order");
    });

    it("extracts @Column with parameters", () => {
      const source = `
public class Employee {
    @Column(nullable = false, unique = true)
    private String email;
}`;
      const annotations = collectAnnotations(source, "Employee.java");

      const column = annotations.find((a) => a.annotation === "Column");
      expect(column).toBeDefined();
      expect(column!.parameters["nullable"]).toBe(false);
      expect(column!.parameters["unique"]).toBe(true);
    });
  });

  describe("Kotlin annotations", () => {
    it("extracts annotations from Kotlin data class", () => {
      const source = `
@Entity
data class Product(
    @Id
    val id: Long,
    @NotNull
    val name: String,
)`;
      const annotations = collectAnnotations(source, "Product.kt");

      const entity = annotations.find((a) => a.annotation === "Entity");
      expect(entity).toBeDefined();

      const notNull = annotations.find((a) => a.annotation === "NotNull");
      expect(notNull).toBeDefined();
    });
  });

  describe("multiple annotations", () => {
    it("extracts all annotations from a class", () => {
      const source = `
@Entity
@Table
public class Invoice {
    @Id
    @GeneratedValue
    private Long id;

    @NotNull
    @Size(min = 1, max = 255)
    private String number;

    @ManyToOne
    private Customer customer;
}`;
      const annotations = collectAnnotations(source, "Invoice.java");

      const names = annotations.map((a) => a.annotation);
      expect(names).toContain("Entity");
      expect(names).toContain("Table");
      expect(names).toContain("Id");
      expect(names).toContain("GeneratedValue");
      expect(names).toContain("NotNull");
      expect(names).toContain("Size");
      expect(names).toContain("ManyToOne");
    });
  });

  describe("non-ORM annotations", () => {
    it("ignores non-ORM annotations", () => {
      const source = `
@Deprecated
@Override
public class Legacy {
    @SuppressWarnings("unchecked")
    private String name;
}`;
      const annotations = collectAnnotations(source, "Legacy.java");

      expect(annotations).toHaveLength(0);
    });
  });

  describe("line tracking", () => {
    it("records correct line numbers", () => {
      const source = `// line 1
// line 2
public class Foo {
    @NotNull
    private String bar;
}`;
      const annotations = collectAnnotations(source, "Foo.java");

      const notNull = annotations.find((a) => a.annotation === "NotNull");
      expect(notNull).toBeDefined();
      expect(notNull!.line).toBe(4);
    });
  });
});
