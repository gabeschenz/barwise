// Model
export {
  type Constraint,
  type DisjunctiveMandatoryConstraint,
  type EqualityConstraint,
  type ExclusionConstraint,
  type ExclusiveOrConstraint,
  type ExternalUniquenessConstraint,
  type FrequencyConstraint,
  type InternalUniquenessConstraint,
  isDisjunctiveMandatory,
  isEquality,
  isExclusion,
  isExclusiveOr,
  isExternalUniqueness,
  isFrequency,
  isInternalUniqueness,
  isMandatoryRole,
  isRing,
  isSubset,
  isValueConstraint,
  type MandatoryRoleConstraint,
  type RingConstraint,
  type RingType,
  type SubsetConstraint,
  type ValueConstraint,
} from "./model/Constraint.js";
export {
  ContextMapping,
  type ContextMappingConfig,
  type MappingPattern,
} from "./model/ContextMapping.js";
export { type Definition } from "./model/Definition.js";
export { DomainModel, type DomainModelConfig } from "./model/DomainModel.js";
export { EntityMapping, type EntityMappingConfig } from "./model/EntityMapping.js";
export { FactType, type FactTypeConfig } from "./model/FactType.js";
export { ModelElement } from "./model/ModelElement.js";
export {
  ObjectifiedFactType,
  type ObjectifiedFactTypeConfig,
} from "./model/ObjectifiedFactType.js";
export {
  type ConceptualDataTypeName,
  type DataTypeDef,
  ObjectType,
  type ObjectTypeConfig,
  type ObjectTypeKind,
  type ValueConstraintDef,
} from "./model/ObjectType.js";
export { OrmModel, type OrmModelConfig } from "./model/OrmModel.js";
export {
  type ExportFormat,
  OrmProject,
  type OrmProjectConfig,
  type PreferredIdentifierStrategy,
  type ProjectSettings,
} from "./model/OrmProject.js";
export {
  type FactInstance,
  type FactInstanceConfig,
  Population,
  type PopulationConfig,
} from "./model/Population.js";
export { type ProductConfig, ProductDependency } from "./model/ProductDependency.js";
export { expandReading, type ReadingOrder, validateReadingTemplate } from "./model/ReadingOrder.js";
export { Role, type RoleConfig } from "./model/Role.js";
export { SemanticConflict, type SemanticConflictConfig } from "./model/SemanticConflict.js";
export { SubtypeFact, type SubtypeFactConfig } from "./model/SubtypeFact.js";

// Serialization
export {
  MappingDeserializationError,
  MappingSerializer,
} from "./serialization/MappingSerializer.js";
export { DeserializationError, OrmYamlSerializer } from "./serialization/OrmYamlSerializer.js";
export {
  ProjectDeserializationError,
  ProjectSerializer,
} from "./serialization/ProjectSerializer.js";
export {
  type SchemaError,
  type SchemaValidationResult,
  SchemaValidator,
} from "./serialization/SchemaValidator.js";

// Validation
export { type Diagnostic, type DiagnosticSeverity } from "./validation/Diagnostic.js";
export { completenessWarnings } from "./validation/rules/completenessWarnings.js";
export { constraintConsistencyRules } from "./validation/rules/constraintConsistency.js";
export { populationValidationRules } from "./validation/rules/populationValidation.js";
export { projectRules, type ProjectValidationRule } from "./validation/rules/projectRules.js";
export { structuralRules } from "./validation/rules/structural.js";
export { ValidationEngine } from "./validation/ValidationEngine.js";
export { type ValidationRule } from "./validation/ValidationRule.js";

// Mapping
export { RelationalMapper, type RelationalMapperOptions } from "./mapping/RelationalMapper.js";
export {
  type Column,
  type ForeignKey,
  type PrimaryKey,
  type RelationalSchema,
  type Table,
} from "./mapping/RelationalSchema.js";
export {
  type AvroField,
  type AvroFieldType,
  type AvroRenderOptions,
  type AvroSchema,
  type AvroSchemaSet,
  avroSchemaToJson,
  renderAvro,
} from "./mapping/renderers/avro.js";
export {
  type DbtModelFile,
  type DbtProject,
  type DbtRenderOptions,
  renderDbt,
} from "./mapping/renderers/dbt.js";
export {
  annotateDbtExport,
  type ExportAnnotation,
  type ExportAnnotationResult,
} from "./mapping/renderers/DbtExportAnnotator.js";
export { renderDdl } from "./mapping/renderers/ddl.js";
export {
  type OpenApiPropertyType,
  type OpenApiRenderOptions,
  type OpenApiSpec,
  openApiToJson,
  renderOpenApi,
} from "./mapping/renderers/openapi.js";

// Diff / Merge
export {
  type BreakingLevel,
  type DefinitionDelta,
  type DeltaKind,
  diffModels,
  type FactTypeDelta,
  type ModelDelta,
  type ModelDiffResult,
  type ObjectTypeDelta,
  type SynonymCandidate,
} from "./diff/ModelDiff.js";
export {
  getStructuralErrors,
  mergeAndValidate,
  mergeModels,
  type MergeValidationResult,
} from "./diff/ModelMerge.js";

// Verbalization
export { ConstraintVerbalizer } from "./verbalization/ConstraintVerbalizer.js";
export { FactTypeVerbalizer } from "./verbalization/FactTypeVerbalizer.js";
export {
  buildVerbalization,
  type SegmentKind,
  type Verbalization,
  type VerbalizationSegment,
} from "./verbalization/Verbalization.js";
export { Verbalizer } from "./verbalization/Verbalizer.js";

// Import (NORMA .orm XML)
export { mapNormaToOrm, NormaMappingError } from "./import/NormaToOrmMapper.js";
export { importNormaXml, NormaImportError } from "./import/NormaXmlImporter.js";
export { NormaParseError, parseNormaXml } from "./import/NormaXmlParser.js";
export type {
  NormaConstraint,
  NormaDataType,
  NormaDocument,
  NormaEntityType,
  NormaFactType,
  NormaMultiplicity,
  NormaObjectifiedType,
  NormaReading,
  NormaReadingOrder,
  NormaRingType,
  NormaRole,
  NormaSubtypeFact,
  NormaValueType,
} from "./import/NormaXmlTypes.js";

// Import (dbt project)
export type {
  DbtImportReport,
  ReportCategory,
  ReportEntry,
  ReportSeverity,
} from "./import/DbtImportReport.js";
export { ReportBuilder } from "./import/DbtImportReport.js";
export {
  DbtImportError,
  type DbtImportResult,
  importDbtProject,
} from "./import/DbtProjectImporter.js";
export { DbtParseError, parseDbtSchema } from "./import/DbtSchemaParser.js";
export type {
  DbtColumn,
  DbtCustomTest,
  DbtModel,
  DbtProjectDocument,
  DbtSource,
  DbtSourceTable,
  DbtStandardTest,
  DbtTest,
} from "./import/DbtSchemaTypes.js";
export { DbtMappingError, type DbtMapResult, mapDbtToOrm } from "./import/DbtToOrmMapper.js";
export { annotateDbtYaml, type AnnotationOptions } from "./import/DbtYamlAnnotator.js";

// Import format types and implementations
export { DdlImportFormat } from "./import/DdlImportFormat.js";
export { OpenApiImportFormat } from "./import/OpenApiImportFormat.js";
export { ImportFormatError } from "./import/registry.js";
export type { ImportFormat, ImportOptions, ImportResult } from "./import/types.js";

// Export format types and implementations
export { DdlExportFormat } from "./export/DdlExportFormat.js";
export { OpenApiExportFormat } from "./export/OpenApiExportFormat.js";
export type {
  ConstraintSpec,
  ExportFormatAdapter,
  ExportOptions,
  ExportResult,
} from "./export/types.js";

// Unified format system (registry + descriptors)
export { ddlFormat, openApiFormat, registerBuiltinFormats } from "./format/formats.js";
export {
  clearFormats,
  formatRegistry,
  FormatRegistryError,
  getExporter,
  getFormat,
  getImporter,
  listExporters,
  listFormats,
  listImporters,
  registerFormat,
} from "./format/registry.js";
export type { FormatDescriptor } from "./format/types.js";

// Deprecated: old separate registries (use unified format system above)
export {
  formatRegistry as exportFormatRegistry,
  getFormat as getExportFormat,
  listFormats as listExportFormats,
  registerFormat as registerExportFormat,
} from "./export/registry.js";
export {
  clearImportFormats,
  getImportFormat,
  listImportFormats,
  registerImportFormat,
} from "./import/registry.js";

// Annotation (shared helpers + ORM YAML annotator)
export {
  type AnnotationSeverity,
  formatBarwiseComment,
  stripBarwiseComments,
  truncate,
} from "./annotation/helpers.js";
export {
  annotateOrmYaml,
  collectAnnotations,
  type OrmAnnotation,
  type OrmAnnotationOptions,
  type OrmAnnotationResult,
  type ProvenanceAmbiguity,
  type ProvenanceConstraint,
  type ProvenanceSubtype,
  type TranscriptProvenance,
  type TranscriptReference,
} from "./annotation/OrmYamlAnnotator.js";

// Describe system (domain description and querying)
export type {
  ConstraintSummary,
  DescribeDomainOptions,
  DomainDescription,
  EntitySummary,
  FactTypeSummary,
  PopulationSummary,
} from "./describe/index.js";
export { describeDomain } from "./describe/index.js";

// Lineage
export { generateDdlLineage, generateModelLineage } from "./lineage/generate.js";
export type { AffectedArtifact, ImpactReport } from "./lineage/impact.js";
export { analyzeImpact } from "./lineage/impact.js";
export { hashModel, readManifest, updateManifest, writeManifest } from "./lineage/manifest.js";
export type { StaleArtifact, StalenessReport } from "./lineage/staleness.js";
export { checkStaleness } from "./lineage/staleness.js";
export type {
  LineageEntry,
  LineageManifest,
  ManifestExport,
  SourceReference,
} from "./lineage/types.js";
