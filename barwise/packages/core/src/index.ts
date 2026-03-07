// Model
export { ModelElement } from "./model/ModelElement.js";
export {
  ObjectType,
  type ObjectTypeKind,
  type ObjectTypeConfig,
  type ValueConstraintDef,
  type ConceptualDataTypeName,
  type DataTypeDef,
} from "./model/ObjectType.js";
export { Role, type RoleConfig } from "./model/Role.js";
export {
  type ReadingOrder,
  validateReadingTemplate,
  expandReading,
} from "./model/ReadingOrder.js";
export { FactType, type FactTypeConfig } from "./model/FactType.js";
export {
  type Constraint,
  type InternalUniquenessConstraint,
  type MandatoryRoleConstraint,
  type ExternalUniquenessConstraint,
  type ValueConstraint,
  type DisjunctiveMandatoryConstraint,
  type ExclusionConstraint,
  type ExclusiveOrConstraint,
  type SubsetConstraint,
  type EqualityConstraint,
  type RingConstraint,
  type FrequencyConstraint,
  type RingType,
  isInternalUniqueness,
  isMandatoryRole,
  isExternalUniqueness,
  isValueConstraint,
  isDisjunctiveMandatory,
  isExclusion,
  isExclusiveOr,
  isSubset,
  isEquality,
  isRing,
  isFrequency,
} from "./model/Constraint.js";
export { type Definition } from "./model/Definition.js";
export {
  SubtypeFact,
  type SubtypeFactConfig,
} from "./model/SubtypeFact.js";
export {
  ObjectifiedFactType,
  type ObjectifiedFactTypeConfig,
} from "./model/ObjectifiedFactType.js";
export {
  Population,
  type PopulationConfig,
  type FactInstance,
  type FactInstanceConfig,
} from "./model/Population.js";
export { OrmModel, type OrmModelConfig } from "./model/OrmModel.js";
export {
  OrmProject,
  type OrmProjectConfig,
  type ProjectSettings,
  type ExportFormat,
  type PreferredIdentifierStrategy,
} from "./model/OrmProject.js";
export {
  DomainModel,
  type DomainModelConfig,
} from "./model/DomainModel.js";
export {
  ContextMapping,
  type ContextMappingConfig,
  type MappingPattern,
} from "./model/ContextMapping.js";
export {
  EntityMapping,
  type EntityMappingConfig,
} from "./model/EntityMapping.js";
export {
  SemanticConflict,
  type SemanticConflictConfig,
} from "./model/SemanticConflict.js";
export {
  ProductDependency,
  type ProductConfig,
} from "./model/ProductDependency.js";

// Serialization
export {
  OrmYamlSerializer,
  DeserializationError,
} from "./serialization/OrmYamlSerializer.js";
export {
  SchemaValidator,
  type SchemaValidationResult,
  type SchemaError,
} from "./serialization/SchemaValidator.js";
export {
  ProjectSerializer,
  ProjectDeserializationError,
} from "./serialization/ProjectSerializer.js";
export {
  MappingSerializer,
  MappingDeserializationError,
} from "./serialization/MappingSerializer.js";

// Validation
export {
  type Diagnostic,
  type DiagnosticSeverity,
} from "./validation/Diagnostic.js";
export { type ValidationRule } from "./validation/ValidationRule.js";
export { ValidationEngine } from "./validation/ValidationEngine.js";
export { structuralRules } from "./validation/rules/structural.js";
export { constraintConsistencyRules } from "./validation/rules/constraintConsistency.js";
export { completenessWarnings } from "./validation/rules/completenessWarnings.js";
export { populationValidationRules } from "./validation/rules/populationValidation.js";
export {
  projectRules,
  type ProjectValidationRule,
} from "./validation/rules/projectRules.js";

// Mapping
export {
  type RelationalSchema,
  type Table,
  type Column,
  type PrimaryKey,
  type ForeignKey,
} from "./mapping/RelationalSchema.js";
export {
  RelationalMapper,
  type RelationalMapperOptions,
} from "./mapping/RelationalMapper.js";
export { renderDdl } from "./mapping/renderers/ddl.js";
export {
  renderDbt,
  type DbtProject,
  type DbtModelFile,
  type DbtRenderOptions,
} from "./mapping/renderers/dbt.js";
export {
  annotateDbtExport,
  type ExportAnnotation,
  type ExportAnnotationResult,
} from "./mapping/renderers/DbtExportAnnotator.js";
export {
  renderAvro,
  avroSchemaToJson,
  type AvroSchema,
  type AvroSchemaSet,
  type AvroField,
  type AvroFieldType,
  type AvroRenderOptions,
} from "./mapping/renderers/avro.js";
export {
  renderOpenApi,
  openApiToJson,
  type OpenApiSpec,
  type OpenApiPropertyType,
  type OpenApiRenderOptions,
} from "./mapping/renderers/openapi.js";

// Diff / Merge
export {
  diffModels,
  type ModelDiffResult,
  type ModelDelta,
  type ObjectTypeDelta,
  type FactTypeDelta,
  type DefinitionDelta,
  type DeltaKind,
  type BreakingLevel,
  type SynonymCandidate,
} from "./diff/ModelDiff.js";
export {
  mergeModels,
  mergeAndValidate,
  getStructuralErrors,
  type MergeValidationResult,
} from "./diff/ModelMerge.js";

// Verbalization
export {
  type Verbalization,
  type VerbalizationSegment,
  type SegmentKind,
  buildVerbalization,
} from "./verbalization/Verbalization.js";
export { FactTypeVerbalizer } from "./verbalization/FactTypeVerbalizer.js";
export { ConstraintVerbalizer } from "./verbalization/ConstraintVerbalizer.js";
export { Verbalizer } from "./verbalization/Verbalizer.js";

// Import (NORMA .orm XML)
export {
  importNormaXml,
  NormaImportError,
} from "./import/NormaXmlImporter.js";
export {
  parseNormaXml,
  NormaParseError,
} from "./import/NormaXmlParser.js";
export {
  mapNormaToOrm,
  NormaMappingError,
} from "./import/NormaToOrmMapper.js";
export type {
  NormaDocument,
  NormaDataType,
  NormaEntityType,
  NormaValueType,
  NormaObjectifiedType,
  NormaFactType,
  NormaRole,
  NormaMultiplicity,
  NormaReadingOrder,
  NormaReading,
  NormaSubtypeFact,
  NormaConstraint,
  NormaRingType,
} from "./import/NormaXmlTypes.js";

// Import (dbt project)
export {
  importDbtProject,
  DbtImportError,
  type DbtImportResult,
} from "./import/DbtProjectImporter.js";
export {
  parseDbtSchema,
  DbtParseError,
} from "./import/DbtSchemaParser.js";
export {
  mapDbtToOrm,
  DbtMappingError,
  type DbtMapResult,
} from "./import/DbtToOrmMapper.js";
export type {
  DbtProjectDocument,
  DbtModel,
  DbtColumn,
  DbtSource,
  DbtSourceTable,
  DbtTest,
  DbtStandardTest,
  DbtCustomTest,
} from "./import/DbtSchemaTypes.js";
export type {
  DbtImportReport,
  ReportEntry,
  ReportSeverity,
  ReportCategory,
} from "./import/DbtImportReport.js";
export { ReportBuilder } from "./import/DbtImportReport.js";
export {
  annotateDbtYaml,
  type AnnotationOptions,
} from "./import/DbtYamlAnnotator.js";

// Import format types and implementations
export type {
  ImportFormat,
  ImportOptions,
  ImportResult,
} from "./import/types.js";
export { ImportFormatError } from "./import/registry.js";
export { DdlImportFormat } from "./import/DdlImportFormat.js";
export { OpenApiImportFormat } from "./import/OpenApiImportFormat.js";

// Export format types and implementations
export type {
  ExportFormatAdapter,
  ExportOptions,
  ExportResult,
  ConstraintSpec,
} from "./export/types.js";
export { DdlExportFormat } from "./export/DdlExportFormat.js";
export { OpenApiExportFormat } from "./export/OpenApiExportFormat.js";

// Unified format system (registry + descriptors)
export type { FormatDescriptor } from "./format/types.js";
export {
  formatRegistry,
  FormatRegistryError,
  registerFormat,
  getFormat,
  getImporter,
  getExporter,
  listFormats,
  listImporters,
  listExporters,
  clearFormats,
} from "./format/registry.js";
export {
  ddlFormat,
  openApiFormat,
  registerBuiltinFormats,
} from "./format/formats.js";

// Deprecated: old separate registries (use unified format system above)
export {
  registerImportFormat,
  getImportFormat,
  listImportFormats,
  clearImportFormats,
} from "./import/registry.js";
export {
  formatRegistry as exportFormatRegistry,
  registerFormat as registerExportFormat,
  getFormat as getExportFormat,
  listFormats as listExportFormats,
} from "./export/registry.js";

// Annotation (shared helpers + ORM YAML annotator)
export {
  stripBarwiseComments,
  formatBarwiseComment,
  truncate,
  type AnnotationSeverity,
} from "./annotation/helpers.js";
export {
  annotateOrmYaml,
  collectAnnotations,
  type TranscriptProvenance,
  type TranscriptReference,
  type ProvenanceAmbiguity,
  type ProvenanceConstraint,
  type ProvenanceSubtype,
  type OrmAnnotation,
  type OrmAnnotationOptions,
  type OrmAnnotationResult,
} from "./annotation/OrmYamlAnnotator.js";

// Describe system (domain description and querying)
export type {
  DescribeDomainOptions,
  EntitySummary,
  FactTypeSummary,
  ConstraintSummary,
  PopulationSummary,
  DomainDescription,
} from "./describe/index.js";
export { describeDomain } from "./describe/index.js";

// Lineage
export type {
  SourceReference,
  LineageEntry,
  ManifestExport,
  LineageManifest,
} from "./lineage/types.js";
export {
  writeManifest,
  readManifest,
  updateManifest,
  hashModel,
} from "./lineage/manifest.js";
export {
  generateDdlLineage,
  generateModelLineage,
} from "./lineage/generate.js";
export type {
  StaleArtifact,
  StalenessReport,
} from "./lineage/staleness.js";
export {
  checkStaleness,
} from "./lineage/staleness.js";
export type {
  AffectedArtifact,
  ImpactReport,
} from "./lineage/impact.js";
export {
  analyzeImpact,
} from "./lineage/impact.js";
