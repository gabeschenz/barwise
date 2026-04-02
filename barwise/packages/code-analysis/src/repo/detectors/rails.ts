/**
 * Ruby on Rails framework detector configuration.
 *
 * Detects Rails applications by looking for the Gemfile with rails,
 * conventional directory structure, and ActiveRecord model patterns.
 */

import type { FrameworkDetectorConfig } from "../types.js";

export const railsDetector: FrameworkDetectorConfig = {
  name: "Rails",
  language: "ruby",
  signals: [
    // Strong signals
    {
      kind: "buildDependency",
      dependency: "rails",
      weight: "strong",
    },
    {
      kind: "glob",
      glob: "config/routes.rb",
      weight: "strong",
    },
    // Moderate signals
    {
      kind: "glob",
      glob: "app/models",
      weight: "moderate",
    },
    {
      kind: "glob",
      glob: "app/controllers",
      weight: "moderate",
    },
    {
      kind: "sourcePattern",
      pattern: /class\s+\w+\s*<\s*ApplicationRecord/,
      fileGlob: "**/*.rb",
      weight: "moderate",
    },
    // Weak signals
    {
      kind: "glob",
      glob: "db/migrate",
      weight: "weak",
    },
    {
      kind: "filePattern",
      pattern: "Rakefile",
      weight: "weak",
    },
  ],
  domainPaths: [
    "app/models",
    "app/services",
    "app/controllers",
  ],
  excludePaths: [
    "vendor",
    "tmp",
    "log",
    "test",
    "spec",
    "db/migrate",
  ],
};
