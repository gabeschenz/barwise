/**
 * Express.js framework detector configuration.
 *
 * Detects Express applications by looking for the express dependency
 * and common patterns like route definitions and middleware usage.
 */

import type { FrameworkDetectorConfig } from "../types.js";

export const expressDetector: FrameworkDetectorConfig = {
  name: "Express",
  language: "typescript",
  signals: [
    // Strong signals
    {
      kind: "buildDependency",
      dependency: '"express"',
      weight: "strong",
    },
    // Moderate signals
    {
      kind: "sourcePattern",
      pattern: /require\(['"]express['"]\)|from\s+['"]express['"]/,
      fileGlob: "**/*.{ts,js}",
      weight: "moderate",
    },
    {
      kind: "sourcePattern",
      pattern: /app\.(get|post|put|delete|patch|use)\s*\(/,
      fileGlob: "**/*.{ts,js}",
      weight: "moderate",
    },
    // Weak signals
    {
      kind: "filePattern",
      pattern: "*routes*",
      weight: "weak",
    },
    {
      kind: "filePattern",
      pattern: "*middleware*",
      weight: "weak",
    },
  ],
  domainPaths: [
    "src",
  ],
  excludePaths: [
    "node_modules",
    "dist",
    "build",
    "test",
    "tests",
    "__tests__",
  ],
};
