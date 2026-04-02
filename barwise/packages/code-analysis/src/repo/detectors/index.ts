/**
 * Framework detector registry.
 *
 * Returns all registered detector configurations. The profiler
 * evaluates each detector's signals against the repository to
 * identify the application framework.
 */

import type { FrameworkDetectorConfig } from "../types.js";

import { djangoDetector } from "./django.js";
import { expressDetector } from "./express.js";
import { fastapiDetector } from "./fastapi.js";
import { nestjsDetector } from "./nestjs.js";
import { railsDetector } from "./rails.js";
import { springBootDetector } from "./springBoot.js";

/** All registered framework detectors, in evaluation order. */
const DETECTORS: readonly FrameworkDetectorConfig[] = [
  springBootDetector,
  nestjsDetector,
  expressDetector,
  djangoDetector,
  fastapiDetector,
  railsDetector,
];

/** Return all registered framework detectors. */
export function getDetectors(): readonly FrameworkDetectorConfig[] {
  return DETECTORS;
}
