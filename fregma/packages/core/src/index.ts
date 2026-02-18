// Model
export { ModelElement } from "./model/ModelElement.js";
export {
  ObjectType,
  type ObjectTypeKind,
  type ObjectTypeConfig,
  type ValueConstraintDef,
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
  isInternalUniqueness,
  isMandatoryRole,
  isExternalUniqueness,
  isValueConstraint,
} from "./model/Constraint.js";
export { type Definition } from "./model/Definition.js";
export { OrmModel, type OrmModelConfig } from "./model/OrmModel.js";
export {
  OrmProject,
  type OrmProjectConfig,
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
export {
  projectRules,
  type ProjectValidationRule,
} from "./validation/rules/projectRules.js";

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
