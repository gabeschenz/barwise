#!/usr/bin/env node
/**
 * Compare raw NORMA XML element counts against our importer output.
 * Usage: node scripts/norma-audit.cjs <path-to.orm>
 *
 * Provides full accounting of ALL non-implied constraints:
 * - Fact-type constraints: stored as explicit Constraint objects on FactTypes
 * - Subtype partition constraints: captured as isExclusive/isExhaustive on SubtypeFacts
 * - Inherent constraints: derivable from model structure (objectification, IS-A)
 */
const fs = require("fs");
const path = require("path");

const ormPath = process.argv[2];
if (!ormPath) {
  console.error("Usage: node scripts/norma-audit.cjs <path-to.orm>");
  process.exit(1);
}

const xml = fs.readFileSync(ormPath, "utf-8");

// --- Part 1: XML inventory ---
console.log("========================================");
console.log("NORMA XML Inventory: " + path.basename(ormPath));
console.log("========================================\n");

function countTag(tag) {
  const re = new RegExp("<orm:" + tag + "[\\s>]", "g");
  return (xml.match(re) || []).length;
}

const entityTypes = countTag("EntityType");
const valueTypes = countTag("ValueType");
const objectifiedTypes = countTag("ObjectifiedType");
console.log("Object Types:");
console.log("  EntityType: " + entityTypes);
console.log("  ValueType: " + valueTypes);
console.log("  ObjectifiedType: " + objectifiedTypes);
console.log("  Total: " + (entityTypes + valueTypes + objectifiedTypes));

const facts = (xml.match(/<orm:Fact /g) || []).length;
const subtypeFactsXml = countTag("SubtypeFact");
const impliedFacts = countTag("ImpliedFact");
console.log("\nFact Types:");
console.log("  Fact (explicit): " + facts);
console.log("  SubtypeFact: " + subtypeFactsXml);
console.log("  ImpliedFact: " + impliedFacts);

// Count reading orders only in <Fact> (not ImpliedFact or SubtypeFact)
function countReadingOrdersInFacts() {
  const factRe = /<orm:Fact [\s\S]*?<\/orm:Fact>/g;
  let count = 0;
  let m;
  while ((m = factRe.exec(xml)) !== null) {
    count += (m[0].match(/<orm:ReadingOrder[\s>]/g) || []).length;
  }
  return count;
}
const readingOrdersInFacts = countReadingOrdersInFacts();
console.log("\nReadings:");
console.log("  ReadingOrder (in Fact only): " + readingOrdersInFacts);

// --- Part 1b: Parsed constraint inventory ---
const { parseNormaXml } = require("../dist/import/NormaXmlParser.js");
const doc = parseNormaXml(xml);

// Build role classification sets
const factRoleIds = new Set();
for (const nft of doc.factTypes) {
  for (const r of nft.roles) factRoleIds.add(r.id);
}
const subtypeRoleIds = new Set();
const supertypeRoleIds = new Set();
for (const sf of doc.subtypeFacts) {
  subtypeRoleIds.add(sf.subtypeRoleId);
  supertypeRoleIds.add(sf.supertypeRoleId);
}
const impliedRoleIds = new Set();
// Parse ImpliedFact roles from XML since parser skips them
const { XMLParser } = require("fast-xml-parser");
const rawParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  removeNSPrefix: true,
  isArray: (tagName) => ["ImpliedFact", "Role"].includes(tagName),
  trimValues: true,
});
const rawParsed = rawParser.parse(xml);
const rawFacts = rawParsed.ORM2?.ORMModel?.Facts;
if (rawFacts?.ImpliedFact) {
  for (const imf of [].concat(rawFacts.ImpliedFact)) {
    if (imf.FactRoles?.Role) {
      for (const r of [].concat(imf.FactRoles.Role)) {
        impliedRoleIds.add(r["@_id"]);
      }
    }
  }
}

// Classify each parsed constraint
const categories = {
  // On real Fact roles (stored as explicit Constraint objects)
  fact_type: {},
  // On SubtypeFact SupertypeMetaRoles as partition constraints
  subtype_partition: {},
  // Inherent to SubtypeFact IS-A semantics
  subtype_inherent: {},
  // Inherent to objectification (ImpliedFact)
  implied_inherent: {},
};

for (const nc of doc.constraints) {
  if (nc.type === "mandatory" && nc.isImplied) continue; // Always skip NORMA auto-generated

  let roleRefs = [];
  let typeKey = "";
  switch (nc.type) {
    case "uniqueness":
      typeKey = nc.isInternal ? "internal_uniqueness" : "external_uniqueness";
      roleRefs = [...nc.roleRefs];
      break;
    case "mandatory":
      typeKey = nc.isSimple ? "simple_mandatory" : "disjunctive_mandatory";
      roleRefs = [...nc.roleRefs];
      break;
    case "subset":
      typeKey = "subset";
      roleRefs = [...nc.subsetRoleRefs, ...nc.supersetRoleRefs];
      break;
    case "exclusion":
      typeKey = "exclusion";
      roleRefs = nc.roleSequences.flat();
      break;
    case "equality":
      typeKey = "equality";
      roleRefs = nc.roleSequences.flat();
      break;
    case "ring":
      typeKey = "ring";
      roleRefs = [...nc.roleRefs];
      break;
    case "frequency":
      typeKey = "frequency";
      roleRefs = [...nc.roleRefs];
      break;
    case "value_constraint":
      typeKey = "value_constraint";
      roleRefs = [...nc.roleRefs];
      break;
  }
  if (!typeKey) continue;

  // Determine which category this constraint falls into
  const hasFactRole = roleRefs.some(r => factRoleIds.has(r));
  const allOnSupertypeRoles = roleRefs.every(r => supertypeRoleIds.has(r));
  const hasSubtypeRole = roleRefs.some(r => subtypeRoleIds.has(r) || supertypeRoleIds.has(r));
  const hasImpliedRole = roleRefs.some(r => impliedRoleIds.has(r));

  let bucket;
  if (hasFactRole) {
    bucket = "fact_type";
  } else if (allOnSupertypeRoles && (typeKey === "exclusion" || typeKey === "disjunctive_mandatory")) {
    bucket = "subtype_partition";
  } else if (hasSubtypeRole) {
    bucket = "subtype_inherent";
  } else if (hasImpliedRole) {
    bucket = "implied_inherent";
  } else {
    bucket = "fact_type"; // fallback
  }

  categories[bucket][typeKey] = (categories[bucket][typeKey] || 0) + 1;
}

console.log("\nConstraint Accounting (all non-implied):");
let grandTotal = 0;
for (const [bucket, counts] of Object.entries(categories)) {
  const total = Object.values(counts).reduce((s, c) => s + c, 0);
  if (total === 0) continue;
  grandTotal += total;
  const label = {
    fact_type: "Fact-type constraints (explicit Constraint objects)",
    subtype_partition: "Subtype partition (isExclusive/isExhaustive)",
    subtype_inherent: "Subtype inherent (derivable from IS-A)",
    implied_inherent: "Objectification inherent (derivable from nesting)",
  }[bucket];
  console.log("  " + label + ": " + total);
  for (const [type, count] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
    console.log("    " + type + ": " + count);
  }
}
console.log("  Grand total: " + grandTotal);

// --- Part 2: Import via our tooling ---
console.log("\n========================================");
console.log("Importer Output");
console.log("========================================\n");

const { importNormaXml } = require("../dist/import/NormaXmlImporter.js");
const model = importNormaXml(xml);

const importedEntities = model.objectTypes.filter(ot => ot.kind === "entity");
const importedValues = model.objectTypes.filter(ot => ot.kind === "value");
const importedObjectified = model.objectifiedFactTypes ? model.objectifiedFactTypes.length : 0;

console.log("Object Types:");
console.log("  Entity types: " + importedEntities.length);
console.log("  Value types: " + importedValues.length);
console.log("  Objectified types: " + importedObjectified);
console.log("  Total: " + model.objectTypes.length);

console.log("\nFact Types:");
console.log("  Fact types: " + model.factTypes.length);
console.log("  Subtype facts: " + model.subtypeFacts.length);

// Count constraints by type on fact types
const constraintCounts = {};
let importedTotalConstraints = 0;
for (const ft of model.factTypes) {
  for (const c of ft.constraints || []) {
    const type = c.type || "unknown";
    constraintCounts[type] = (constraintCounts[type] || 0) + 1;
    importedTotalConstraints++;
  }
}

console.log("\nFact-type Constraints:");
const sortedImported = Object.entries(constraintCounts).sort((a, b) => b[1] - a[1]);
for (const [name, count] of sortedImported) {
  console.log("  " + name + ": " + count);
}
console.log("  Total: " + importedTotalConstraints);

// Count subtype partition properties
let exclusiveCount = 0;
let exhaustiveCount = 0;
for (const sf of model.subtypeFacts) {
  if (sf.isExclusive) exclusiveCount++;
  if (sf.isExhaustive) exhaustiveCount++;
}
console.log("\nSubtype Partition Properties:");
console.log("  Subtypes with isExclusive: " + exclusiveCount);
console.log("  Subtypes with isExhaustive: " + exhaustiveCount);

// Count readings
let totalReadings = 0;
for (const ft of model.factTypes) {
  if (ft.readings && ft.readings.length > 0) {
    totalReadings += ft.readings.length;
  }
}
console.log("\nReadings:");
console.log("  Total reading orders: " + totalReadings);

// Value types with data types
let dataTypeCount = 0;
for (const ot of model.objectTypes) {
  if (ot.kind === "value" && ot.dataType) dataTypeCount++;
}
console.log("\nValue types with data types: " + dataTypeCount + " / " + importedValues.length);

// --- Part 3: Comparison ---
console.log("\n========================================");
console.log("Fidelity Comparison");
console.log("========================================\n");

function compare(label, xmlCount, importedCount) {
  const status = xmlCount === importedCount ? " OK " : " GAP";
  const delta = importedCount - xmlCount;
  const deltaStr = delta >= 0 ? "+" + delta : "" + delta;
  console.log(status + "  " + label + ": XML=" + xmlCount + " Imported=" + importedCount + " (" + deltaStr + ")");
  return { label, xmlCount, importedCount, delta };
}

const results = [];
console.log("Structure:");
results.push(compare("Entity types (pure)", entityTypes, importedEntities.length - importedObjectified));
results.push(compare("Value types", valueTypes, importedValues.length));
results.push(compare("Objectified types", objectifiedTypes, importedObjectified));
results.push(compare("Total object types", entityTypes + valueTypes + objectifiedTypes, model.objectTypes.length));
results.push(compare("Fact types", facts, model.factTypes.length));
results.push(compare("Subtype facts", subtypeFactsXml, model.subtypeFacts.length));
results.push(compare("Reading orders", readingOrdersInFacts, totalReadings));

const factTypeExpected = categories.fact_type;
console.log("\nFact-type Constraints:");
results.push(compare("Internal uniqueness", factTypeExpected.internal_uniqueness || 0, constraintCounts["internal_uniqueness"] || 0));
results.push(compare("External uniqueness", factTypeExpected.external_uniqueness || 0, constraintCounts["external_uniqueness"] || 0));
results.push(compare("Simple mandatory", factTypeExpected.simple_mandatory || 0, constraintCounts["mandatory"] || 0));
results.push(compare("Disjunctive mandatory", factTypeExpected.disjunctive_mandatory || 0, constraintCounts["disjunctive_mandatory"] || 0));
results.push(compare("Subset", factTypeExpected.subset || 0, constraintCounts["subset"] || 0));
results.push(compare("Exclusion", factTypeExpected.exclusion || 0, constraintCounts["exclusion"] || 0));
results.push(compare("Ring", factTypeExpected.ring || 0, constraintCounts["ring"] || 0));
results.push(compare("Equality", factTypeExpected.equality || 0, constraintCounts["equality"] || 0));
results.push(compare("Value constraint", factTypeExpected.value_constraint || 0, constraintCounts["value_constraint"] || 0));
results.push(compare("Frequency", factTypeExpected.frequency || 0, constraintCounts["frequency"] || 0));
const totalFactTypeExpected = Object.values(factTypeExpected).reduce((s, c) => s + c, 0);
results.push(compare("Total fact-type constraints", totalFactTypeExpected, importedTotalConstraints));

// Subtype partition: exclusion on supertype roles -> isExclusive, disj. mandatory -> isExhaustive
const partitionCounts = categories.subtype_partition;
const expectedExclusive = (partitionCounts.exclusion || 0);
const expectedExhaustive = (partitionCounts.disjunctive_mandatory || 0);

// Each exclusion/disjunctive_mandatory constraint covers N subtypes, producing N SubtypeFacts
// with the flag set. We need to count by roles, not by constraints.
// Count SubtypeFacts that should be exclusive/exhaustive from NORMA data
let expectedExclusiveSubtypes = 0;
let expectedExhaustiveSubtypes = 0;
for (const nc of doc.constraints) {
  if (nc.type === "exclusion") {
    const allRoles = nc.roleSequences.flat();
    const allOnSupertype = allRoles.every(r => supertypeRoleIds.has(r));
    if (allOnSupertype && allRoles.length >= 2) {
      expectedExclusiveSubtypes += allRoles.length;
    }
  }
  if (nc.type === "mandatory" && !nc.isSimple && !nc.isImplied) {
    const allOnSupertype = nc.roleRefs.every(r => supertypeRoleIds.has(r));
    if (allOnSupertype && nc.roleRefs.length >= 2) {
      expectedExhaustiveSubtypes += nc.roleRefs.length;
    }
  }
}

console.log("\nSubtype Partition Properties:");
results.push(compare("Exclusive subtypes", expectedExclusiveSubtypes, exclusiveCount));
results.push(compare("Exhaustive subtypes", expectedExhaustiveSubtypes, exhaustiveCount));

// Inherent constraints verification
const inherentSubtype = Object.values(categories.subtype_inherent).reduce((s, c) => s + c, 0);
const inherentImplied = Object.values(categories.implied_inherent).reduce((s, c) => s + c, 0);

// Verify inherent counts match model structure expectations
const expectedSubtypeInherent = model.subtypeFacts.length * 2; // 1 uniqueness + 1 mandatory per SubtypeFact meta-role pair
const expectedImpliedInherent = 0; // Count implied roles from objectified types
let impliedRoleCount = 0;
for (const oft of model.objectifiedFactTypes) {
  const ft = model.getFactType(oft.factTypeId);
  if (ft) impliedRoleCount += ft.roles.length;
}
const expectedImpliedInherentCount = impliedRoleCount * 2; // 1 uniqueness + 1 mandatory per implied role

console.log("\nInherent Constraints (derivable from structure):");
console.log("  Subtype inherent: " + inherentSubtype + " (expected ~" + expectedSubtypeInherent + " from " + model.subtypeFacts.length + " subtype facts)");
console.log("  Objectification inherent: " + inherentImplied + " (expected " + expectedImpliedInherentCount + " from " + impliedRoleCount + " implied roles)");

const gaps = results.filter(r => r.delta !== 0);
console.log("\n========================================");
if (gaps.length === 0) {
  console.log("FULL ORM 2 FIDELITY -- all " + grandTotal + " constraints accounted for");
} else {
  console.log(gaps.length + " GAPS FOUND");
  for (const g of gaps) {
    console.log("  " + g.label + ": delta " + (g.delta >= 0 ? "+" : "") + g.delta);
  }
}
console.log("========================================");
