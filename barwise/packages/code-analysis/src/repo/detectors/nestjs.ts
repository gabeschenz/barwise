/**
 * NestJS framework detector configuration.
 *
 * Detects NestJS applications by looking for the @nestjs/core
 * dependency, module decorators, and conventional file patterns.
 */

import type { FrameworkDetectorConfig } from "../types.js";

export const nestjsDetector: FrameworkDetectorConfig = {
  name: "NestJS",
  language: "typescript",
  signals: [
    // Strong signals
    {
      kind: "buildDependency",
      dependency: "@nestjs/core",
      weight: "strong",
    },
    {
      kind: "glob",
      glob: "**/nest-cli.json",
      weight: "strong",
    },
    // Moderate signals
    {
      kind: "sourcePattern",
      pattern: /@Module\s*\(/,
      fileGlob: "**/*.ts",
      weight: "moderate",
    },
    {
      kind: "sourcePattern",
      pattern: /@Injectable\s*\(/,
      fileGlob: "**/*.ts",
      weight: "moderate",
    },
    {
      kind: "sourcePattern",
      pattern: /@Controller\s*\(/,
      fileGlob: "**/*.ts",
      weight: "moderate",
    },
    // Weak signals
    {
      kind: "filePattern",
      pattern: "*.module.ts",
      weight: "weak",
    },
    {
      kind: "filePattern",
      pattern: "*.service.ts",
      weight: "weak",
    },
    {
      kind: "filePattern",
      pattern: "*.controller.ts",
      weight: "weak",
    },
  ],
  domainPaths: [
    "src",
  ],
  excludePaths: [
    "node_modules",
    "dist",
    "test",
    "e2e",
  ],
};
