/**
 * Django framework detector configuration.
 *
 * Detects Django applications by looking for manage.py, settings
 * modules, and Django-specific model patterns.
 */

import type { FrameworkDetectorConfig } from "../types.js";

export const djangoDetector: FrameworkDetectorConfig = {
  name: "Django",
  language: "python",
  signals: [
    // Strong signals
    {
      kind: "glob",
      glob: "manage.py",
      weight: "strong",
    },
    {
      kind: "buildDependency",
      dependency: "django",
      weight: "strong",
    },
    // Moderate signals
    {
      kind: "sourcePattern",
      pattern: /from django\.db import models/,
      fileGlob: "**/*.py",
      weight: "moderate",
    },
    {
      kind: "glob",
      glob: "**/settings.py",
      weight: "moderate",
    },
    {
      kind: "sourcePattern",
      pattern: /class\s+\w+\(models\.Model\)/,
      fileGlob: "**/*.py",
      weight: "moderate",
    },
    // Weak signals
    {
      kind: "filePattern",
      pattern: "models.py",
      weight: "weak",
    },
    {
      kind: "filePattern",
      pattern: "views.py",
      weight: "weak",
    },
    {
      kind: "filePattern",
      pattern: "urls.py",
      weight: "weak",
    },
  ],
  domainPaths: [
    ".",
  ],
  excludePaths: [
    "__pycache__",
    ".venv",
    "venv",
    "migrations",
    "static",
    "media",
  ],
};
