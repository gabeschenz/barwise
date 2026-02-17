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
