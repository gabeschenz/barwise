import type { OrmModel } from "../model/OrmModel.js";
import type { Diagnostic } from "./Diagnostic.js";

/**
 * A validation rule is a pure function that inspects an OrmModel and
 * returns zero or more diagnostics.
 */
export type ValidationRule = (model: OrmModel) => Diagnostic[];
