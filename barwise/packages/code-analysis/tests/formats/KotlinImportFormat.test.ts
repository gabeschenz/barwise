/**
 * Tests for the KotlinImportFormat.
 *
 * Uses fixture Kotlin source files to verify end-to-end import behavior
 * without requiring a language server (regex fallback mode).
 */
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { KotlinImportFormat } from "../../src/formats/KotlinImportFormat.js";

describe("KotlinImportFormat", () => {
  const importer = new KotlinImportFormat();
  let fixtureDir: string;

  beforeEach(() => {
    fixtureDir = join(tmpdir(), `barwise-kotlin-test-${Date.now()}`);
    mkdirSync(fixtureDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(fixtureDir, { recursive: true, force: true });
  });

  it("has correct name and inputKind", () => {
    expect(importer.name).toBe("kotlin");
    expect(importer.inputKind).toBe("directory");
  });

  it("has parseAsync but not parse", () => {
    expect(importer.parseAsync).toBeDefined();
    expect(importer.parse).toBeUndefined();
  });

  it("extracts enums as value types", async () => {
    writeFileSync(
      join(fixtureDir, "OrderStatus.kt"),
      `
enum class OrderStatus {
    DRAFT,
    SUBMITTED,
    FULFILLED,
    CANCELLED
}`,
    );

    const result = await importer.parseAsync!(fixtureDir);

    const orderStatus = result.model.getObjectTypeByName("OrderStatus");
    expect(orderStatus).toBeDefined();
    expect(orderStatus!.kind).toBe("value");
  });

  it("extracts data classes as entity types", async () => {
    writeFileSync(
      join(fixtureDir, "Customer.kt"),
      `
@Entity
data class Customer(
    @Id
    val id: Long,
    val name: String,
)`,
    );

    const result = await importer.parseAsync!(fixtureDir);

    const customer = result.model.getObjectTypeByName("Customer");
    expect(customer).toBeDefined();
    expect(customer!.kind).toBe("entity");
  });

  it("discovers .kt and .kts files", async () => {
    writeFileSync(
      join(fixtureDir, "Status.kt"),
      `enum class Status { Active, Inactive }`,
    );
    writeFileSync(
      join(fixtureDir, "build.gradle.kts"),
      `// this is a build script`,
    );

    const result = await importer.parseAsync!(fixtureDir);

    // Should discover both .kt and .kts files
    expect(result.model.getObjectTypeByName("Status")).toBeDefined();
  });

  it("uses custom model name from options", async () => {
    writeFileSync(
      join(fixtureDir, "Color.kt"),
      `enum class Color { Red, Green, Blue }`,
    );

    const result = await importer.parseAsync!(fixtureDir, {
      modelName: "My Kotlin Domain",
    });

    expect(result.model.name).toBe("My Kotlin Domain");
  });

  it("returns warnings when no types found", async () => {
    writeFileSync(join(fixtureDir, "Empty.kt"), "// empty file\n");

    const result = await importer.parseAsync!(fixtureDir);

    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.confidence).toBe("low");
  });

  it("excludes .gradle and .idea directories", async () => {
    mkdirSync(join(fixtureDir, ".gradle"), { recursive: true });
    mkdirSync(join(fixtureDir, ".idea"), { recursive: true });
    writeFileSync(
      join(fixtureDir, ".gradle", "cache.kt"),
      `enum class Cache { A, B }`,
    );
    writeFileSync(
      join(fixtureDir, ".idea", "settings.kt"),
      `enum class Settings { X, Y }`,
    );
    writeFileSync(
      join(fixtureDir, "Status.kt"),
      `enum class Status { Active, Inactive }`,
    );

    const result = await importer.parseAsync!(fixtureDir);

    expect(result.model.getObjectTypeByName("Status")).toBeDefined();
    expect(result.model.getObjectTypeByName("Cache")).toBeUndefined();
    expect(result.model.getObjectTypeByName("Settings")).toBeUndefined();
  });

  it("reports LSP fallback in warnings when server unavailable", async () => {
    writeFileSync(join(fixtureDir, "X.kt"), `enum class X { A }`);

    const result = await importer.parseAsync!(fixtureDir);

    expect(result.warnings.some((w) => w.includes("language server") || w.includes("regex"))).toBe(
      true,
    );
  });
});
