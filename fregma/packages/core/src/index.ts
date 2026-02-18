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
