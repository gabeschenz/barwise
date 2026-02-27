/**
 * Debug script: import IronBlock Auctions dbt project into ORM.
 *
 * Run from the monorepo root:
 *   npx tsx examples/dbt-import/debug-import.ts
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { importDbtProject } from "../../packages/core/src/import/DbtProjectImporter.js";
import { annotateDbtYaml } from "../../packages/core/src/import/DbtYamlAnnotator.js";
import { ValidationEngine } from "../../packages/core/src/validation/ValidationEngine.js";
import { Verbalizer } from "../../packages/core/src/verbalization/Verbalizer.js";
import { OrmYamlSerializer } from "../../packages/core/src/serialization/OrmYamlSerializer.js";
import { RelationalMapper } from "../../packages/core/src/mapping/RelationalMapper.js";
import { renderDdl } from "../../packages/core/src/mapping/renderers/ddl.js";

// ---------------------------------------------------------------------------
// Load YAML files
// ---------------------------------------------------------------------------

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectDir = resolve(__dirname, "ironblock_auctions/models/staging");

const schemaYaml = readFileSync(resolve(projectDir, "schema.yml"), "utf-8");
const sourcesYaml = readFileSync(resolve(projectDir, "sources.yml"), "utf-8");

console.log("=".repeat(72));
console.log("  IronBlock Auctions -- dbt Import Debug Session");
console.log("=".repeat(72));
console.log();

// ---------------------------------------------------------------------------
// 1. Import
// ---------------------------------------------------------------------------

console.log("--- PHASE 1: dbt Import ---");
console.log();

const { model, report } = importDbtProject([schemaYaml, sourcesYaml]);

// Summary counts
const entities = model.objectTypes.filter((ot) => ot.kind === "entity");
const values = model.objectTypes.filter((ot) => ot.kind === "value");

console.log(`Entity types:  ${entities.length}`);
console.log(`Value types:   ${values.length}`);
console.log(`Fact types:    ${model.factTypes.length}`);
console.log();

// Detail: entity types
console.log("Entity types:");
for (const e of entities) {
  console.log(`  ${e.name} (ref: ${e.referenceMode ?? "none"})`);
}
console.log();

// Detail: value types
console.log("Value types:");
for (const v of values) {
  const dt = v.dataType ? `${v.dataType.name}` : "unknown";
  console.log(`  ${v.name} [${dt}]`);
}
console.log();

// Detail: fact types
console.log("Fact types:");
for (const ft of model.factTypes) {
  const roleNames = ft.roles
    .map((r) => {
      const player = model.objectTypes.find((ot) => ot.id === r.playerId);
      return player?.name ?? "?";
    })
    .join(" -- ");
  console.log(`  ${ft.name}  (${roleNames})`);
}
console.log();

// ---------------------------------------------------------------------------
// 2. Gap Report
// ---------------------------------------------------------------------------

console.log("--- PHASE 2: Gap Report ---");
console.log();

const infoCount = report.entries.filter((e) => e.severity === "info").length;
const warnCount = report.entries.filter((e) => e.severity === "warning").length;
const gapCount = report.entries.filter((e) => e.severity === "gap").length;

console.log(`  info:     ${infoCount}`);
console.log(`  warning:  ${warnCount}`);
console.log(`  gap:      ${gapCount}`);
console.log();

// Show gaps first (most important)
const gaps = report.entries.filter((e) => e.severity === "gap");
if (gaps.length > 0) {
  console.log("GAPS (require human review):");
  for (const g of gaps) {
    const col = g.columnName ? `.${g.columnName}` : "";
    console.log(`  [${g.category}] ${g.modelName}${col}: ${g.message}`);
  }
  console.log();
}

// Show warnings
const warnings = report.entries.filter((e) => e.severity === "warning");
if (warnings.length > 0) {
  console.log("WARNINGS (inferred or uncertain):");
  for (const w of warnings) {
    const col = w.columnName ? `.${w.columnName}` : "";
    console.log(`  [${w.category}] ${w.modelName}${col}: ${w.message}`);
  }
  console.log();
}

// Show info (first 20 only, for brevity)
const infos = report.entries.filter((e) => e.severity === "info");
if (infos.length > 0) {
  const shown = infos.slice(0, 20);
  console.log(`INFO (first ${shown.length} of ${infos.length}):`);
  for (const i of shown) {
    const col = i.columnName ? `.${i.columnName}` : "";
    console.log(`  [${i.category}] ${i.modelName}${col}: ${i.message}`);
  }
  if (infos.length > 20) {
    console.log(`  ... and ${infos.length - 20} more`);
  }
  console.log();
}

// ---------------------------------------------------------------------------
// 3. Validation
// ---------------------------------------------------------------------------

console.log("--- PHASE 3: Validation ---");
console.log();

const engine = new ValidationEngine();
const diagnostics = engine.validate(model);

const errors = diagnostics.filter((d) => d.severity === "error");
const valWarns = diagnostics.filter((d) => d.severity === "warning");
const valInfos = diagnostics.filter((d) => d.severity === "info");

console.log(`  errors:   ${errors.length}`);
console.log(`  warnings: ${valWarns.length}`);
console.log(`  info:     ${valInfos.length}`);
console.log();

if (errors.length > 0) {
  console.log("ERRORS:");
  for (const e of errors) {
    console.log(`  [${e.ruleId}] ${e.message}`);
  }
  console.log();
}

if (valWarns.length > 0) {
  console.log("WARNINGS:");
  for (const w of valWarns) {
    console.log(`  [${w.ruleId}] ${w.message}`);
  }
  console.log();
}

// ---------------------------------------------------------------------------
// 4. Verbalization
// ---------------------------------------------------------------------------

console.log("--- PHASE 4: Verbalization ---");
console.log();

const verbalizer = new Verbalizer();
const verbalizations = verbalizer.verbalizeModel(model);

for (const v of verbalizations) {
  console.log(v.text);
}
console.log();

// ---------------------------------------------------------------------------
// 5. YAML Serialization (round-trip check)
// ---------------------------------------------------------------------------

console.log("--- PHASE 5: YAML Serialization ---");
console.log();

const serializer = new OrmYamlSerializer();
const yaml = serializer.serialize(model);
console.log(yaml);

// ---------------------------------------------------------------------------
// 6. Relational Mapping + DDL
// ---------------------------------------------------------------------------

console.log("--- PHASE 6: Relational Mapping + DDL ---");
console.log();

const mapper = new RelationalMapper();
const schema = mapper.map(model);

console.log(`Tables: ${schema.tables.length}`);
for (const t of schema.tables) {
  console.log(`  ${t.name} (${t.columns.length} cols, ${t.foreignKeys.length} FKs)`);
}
console.log();

const ddl = renderDdl(schema);
console.log(ddl);

// ---------------------------------------------------------------------------
// 7. Annotate original dbt YAML with TODO/NOTE comments
// ---------------------------------------------------------------------------

console.log("--- PHASE 7: Annotate dbt YAML ---");
console.log();

const schemaPath = resolve(projectDir, "schema.yml");
const annotatedSchema = annotateDbtYaml(schemaYaml, report, {
  includeInfoNotes: true,
  categories: ["data_type", "macro", "description", "identifier"],
});

// Count injected comments.
const todoCount = (annotatedSchema.match(/# TODO\(fregma\):/g) ?? []).length;
const noteCount = (annotatedSchema.match(/# NOTE\(fregma\):/g) ?? []).length;

writeFileSync(schemaPath, annotatedSchema);
console.log(`Annotated ${schemaPath}`);
console.log(`  ${todoCount} TODO(fregma) comments injected`);
console.log(`  ${noteCount} NOTE(fregma) comments injected`);
console.log();

// ---------------------------------------------------------------------------
// 8. Write output files to docs/ with datetime-stamped filenames
// ---------------------------------------------------------------------------

const docsDir = resolve(__dirname, "docs");
mkdirSync(docsDir, { recursive: true });

// Generate a datetime stamp for unique filenames (e.g. 20260227T143012).
const now = new Date();
const dtg = [
  now.getFullYear(),
  String(now.getMonth() + 1).padStart(2, "0"),
  String(now.getDate()).padStart(2, "0"),
  "T",
  String(now.getHours()).padStart(2, "0"),
  String(now.getMinutes()).padStart(2, "0"),
  String(now.getSeconds()).padStart(2, "0"),
].join("");

const prefix = `ironblock-auctions_${dtg}`;

// ORM YAML model
writeFileSync(resolve(docsDir, `${prefix}.orm.yaml`), yaml);

// Verbalizations
const verbText = verbalizations.map((v) => v.text).join("\n") + "\n";
writeFileSync(resolve(docsDir, `${prefix}.verbalizations.txt`), verbText);

// Validation diagnostics
const diagLines = diagnostics.map(
  (d) => `[${d.severity}] ${d.ruleId}: ${d.message}`,
);
writeFileSync(
  resolve(docsDir, `${prefix}.diagnostics.txt`),
  diagLines.join("\n") + "\n",
);

// DDL
writeFileSync(resolve(docsDir, `${prefix}.ddl.sql`), ddl);

// Gap report (markdown)
const reportLines: string[] = [];
reportLines.push("# dbt Import Gap Report: IronBlock Auctions");
reportLines.push("");
reportLines.push(`Generated: ${now.toISOString()}`);
reportLines.push("");
reportLines.push(`Entity types:  ${entities.length}`);
reportLines.push(`Value types:   ${values.length}`);
reportLines.push(`Fact types:    ${model.factTypes.length}`);
reportLines.push("");
reportLines.push(`Report entries: ${report.entries.length} (${infoCount} info, ${warnCount} warning, ${gapCount} gap)`);
reportLines.push("");

if (gaps.length > 0) {
  reportLines.push("## Gaps (require human review)");
  reportLines.push("");

  const gapsByModel = new Map<string, typeof gaps>();
  for (const g of gaps) {
    const existing = gapsByModel.get(g.modelName) ?? [];
    existing.push(g);
    gapsByModel.set(g.modelName, existing);
  }

  for (const [modelName, modelGaps] of gapsByModel) {
    reportLines.push(`### ${modelName}`);
    reportLines.push("");

    const byCategory = new Map<string, typeof modelGaps>();
    for (const g of modelGaps) {
      const existing = byCategory.get(g.category) ?? [];
      existing.push(g);
      byCategory.set(g.category, existing);
    }

    for (const [category, catEntries] of byCategory) {
      reportLines.push(`- ${category}:`);
      for (const g of catEntries) {
        const col = g.columnName ? `.${g.columnName}` : "";
        reportLines.push(`    - ${modelName}${col}: ${g.message}`);
      }
    }
    reportLines.push("");
  }
}

if (warnings.length > 0) {
  reportLines.push("## Warnings (inferred or uncertain)");
  reportLines.push("");

  const warnsByModel = new Map<string, typeof warnings>();
  for (const w of warnings) {
    const existing = warnsByModel.get(w.modelName) ?? [];
    existing.push(w);
    warnsByModel.set(w.modelName, existing);
  }

  for (const [modelName, modelWarns] of warnsByModel) {
    reportLines.push(`### ${modelName}`);
    reportLines.push("");

    const byCategory = new Map<string, typeof modelWarns>();
    for (const w of modelWarns) {
      const existing = byCategory.get(w.category) ?? [];
      existing.push(w);
      byCategory.set(w.category, existing);
    }

    for (const [category, catEntries] of byCategory) {
      reportLines.push(`- ${category}:`);
      for (const w of catEntries) {
        const col = w.columnName ? `.${w.columnName}` : "";
        reportLines.push(`    - ${modelName}${col}: ${w.message}`);
      }
    }
    reportLines.push("");
  }
}

reportLines.push("## Info (explicit data or resolved from sources)");
reportLines.push("");

// Group info entries by model for readability.
const infoByModel = new Map<string, typeof infos>();
for (const i of infos) {
  const existing = infoByModel.get(i.modelName) ?? [];
  existing.push(i);
  infoByModel.set(i.modelName, existing);
}

for (const [modelName, modelInfos] of infoByModel) {
  reportLines.push(`### ${modelName}`);
  reportLines.push("");

  // Group by category within each model.
  const byCategory = new Map<string, typeof modelInfos>();
  for (const i of modelInfos) {
    const existing = byCategory.get(i.category) ?? [];
    existing.push(i);
    byCategory.set(i.category, existing);
  }

  for (const [category, catEntries] of byCategory) {
    reportLines.push(`- ${category}:`);
    for (const i of catEntries) {
      const col = i.columnName ? `.${i.columnName}` : "";
      reportLines.push(`    - ${modelName}${col}: ${i.message}`);
    }
  }
  reportLines.push("");
}


writeFileSync(
  resolve(docsDir, `${prefix}.import-report.md`),
  reportLines.join("\n"),
);

console.log("--- Output files written ---");
console.log();
console.log(`  ${resolve(docsDir, `${prefix}.orm.yaml`)}`);
console.log(`  ${resolve(docsDir, `${prefix}.verbalizations.txt`)}`);
console.log(`  ${resolve(docsDir, `${prefix}.diagnostics.txt`)}`);
console.log(`  ${resolve(docsDir, `${prefix}.ddl.sql`)}`);
console.log(`  ${resolve(docsDir, `${prefix}.import-report.md`)}`);
console.log();

console.log("=".repeat(72));
console.log("  Debug session complete.");
console.log("=".repeat(72));
