/**
 * Spring Boot framework detector configuration.
 *
 * Supports both Java and Kotlin Spring Boot applications.
 * Looks for Spring-specific build dependencies, configuration files,
 * and annotation patterns.
 */

import type { FrameworkDetectorConfig } from "../types.js";

export const springBootDetector: FrameworkDetectorConfig = {
  name: "Spring Boot",
  language: "java",
  additionalLanguages: ["kotlin"],
  signals: [
    // Strong signals
    {
      kind: "buildDependency",
      dependency: "spring-boot",
      weight: "strong",
    },
    {
      kind: "glob",
      glob: "**/application.yml",
      weight: "strong",
    },
    {
      kind: "glob",
      glob: "**/application.properties",
      weight: "strong",
    },
    // Moderate signals
    {
      kind: "sourcePattern",
      pattern: /@SpringBootApplication/,
      fileGlob: "**/*.{java,kt}",
      weight: "moderate",
    },
    {
      kind: "sourcePattern",
      pattern: /@Entity/,
      fileGlob: "**/*.{java,kt}",
      weight: "moderate",
    },
    {
      kind: "sourcePattern",
      pattern: /@RestController/,
      fileGlob: "**/*.{java,kt}",
      weight: "moderate",
    },
    // Weak signals
    {
      kind: "filePattern",
      pattern: "*Controller.java",
      weight: "weak",
    },
    {
      kind: "filePattern",
      pattern: "*Repository.java",
      weight: "weak",
    },
    {
      kind: "filePattern",
      pattern: "*Controller.kt",
      weight: "weak",
    },
  ],
  domainPaths: [
    "src/main/java",
    "src/main/kotlin",
  ],
  excludePaths: [
    "src/test",
    "target",
    "build",
    ".gradle",
    ".mvn",
  ],
};
