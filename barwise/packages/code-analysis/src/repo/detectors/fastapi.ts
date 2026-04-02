/**
 * FastAPI framework detector configuration.
 *
 * Detects FastAPI applications by looking for the fastapi dependency
 * and common patterns like route decorators and Pydantic models.
 */

import type { FrameworkDetectorConfig } from "../types.js";

export const fastapiDetector: FrameworkDetectorConfig = {
  name: "FastAPI",
  language: "python",
  signals: [
    // Strong signals
    {
      kind: "buildDependency",
      dependency: "fastapi",
      weight: "strong",
    },
    // Moderate signals
    {
      kind: "sourcePattern",
      pattern: /from fastapi import/,
      fileGlob: "**/*.py",
      weight: "moderate",
    },
    {
      kind: "sourcePattern",
      pattern: /@app\.(get|post|put|delete|patch)\s*\(/,
      fileGlob: "**/*.py",
      weight: "moderate",
    },
    {
      kind: "sourcePattern",
      pattern: /class\s+\w+\(BaseModel\)/,
      fileGlob: "**/*.py",
      weight: "moderate",
    },
    // Weak signals
    {
      kind: "buildDependency",
      dependency: "pydantic",
      weight: "weak",
    },
    {
      kind: "buildDependency",
      dependency: "uvicorn",
      weight: "weak",
    },
  ],
  domainPaths: [
    "app",
    "src",
    ".",
  ],
  excludePaths: [
    "__pycache__",
    ".venv",
    "venv",
    "tests",
    "test",
  ],
};
