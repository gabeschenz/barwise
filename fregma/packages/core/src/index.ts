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
  type ValidationResult,
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
export { RelationalMapper } from "./mapping/RelationalMapper.js";
export { renderDdl } from "./mapping/renderers/ddl.js";
export {
  renderDbt,
  type DbtProject,
  type DbtModelFile,
  type DbtRenderOptions,
} from "./mapping/renderers/dbt.js";
export {
  renderAvro,
  avroSchemaToJson,
  type AvroSchema,
  type AvroSchemaSet,
  type AvroField,
  type AvroFieldType,
  type AvroRenderOptions,
} from "./mapping/renderers/avro.js";

// Diff / Merge
export {
  diffModels,
  type ModelDiffResult,
  type ModelDelta,
  type ObjectTypeDelta,
  type FactTypeDelta,
  type DefinitionDelta,
  type DeltaKind,
} from "./diff/ModelDiff.js";
export { mergeModels } from "./diff/ModelMerge.js";

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
