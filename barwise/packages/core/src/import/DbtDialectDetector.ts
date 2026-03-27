/**
 * dbt dialect detector.
 *
 * Reads dbt project configuration to determine the SQL dialect.
 * The dialect is needed for the Calcite cascade parser to apply
 * correct lexer and conformance settings.
 *
 * Detection strategy (priority order):
 * 1. Explicit dialect option from the user
 * 2. DBT_TARGET_TYPE or DBT_ADAPTER environment variable
 * 3. dbt_project.yml profile -> profiles.yml adapter type
 * 4. Installed dbt packages (dbt-snowflake, dbt-bigquery, etc.)
 * 5. Fall back to "ansi"
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { SqlDialect } from "../sql/types.js";

/**
 * Map dbt adapter names to Calcite SQL dialects.
 */
const ADAPTER_TO_DIALECT: Record<string, SqlDialect> = {
  snowflake: "snowflake",
  bigquery: "bigquery",
  postgres: "postgres",
  redshift: "redshift",
  mysql: "mysql",
  databricks: "databricks",
  spark: "databricks",
};

/**
 * Detect the SQL dialect for a dbt project.
 *
 * @param projectDir - Path to the dbt project root
 * @param explicitDialect - User-provided dialect override
 * @returns The detected SQL dialect
 */
export function detectDbtDialect(
  projectDir: string,
  explicitDialect?: SqlDialect,
): SqlDialect {
  // 1. Explicit override
  if (explicitDialect) {
    return explicitDialect;
  }

  // 2. Environment variables
  const envDialect = detectFromEnv();
  if (envDialect) {
    return envDialect;
  }

  // 3. dbt_project.yml -> profiles.yml
  const profileDialect = detectFromProfiles(projectDir);
  if (profileDialect) {
    return profileDialect;
  }

  // 4. Installed packages
  const packageDialect = detectFromPackages(projectDir);
  if (packageDialect) {
    return packageDialect;
  }

  // 5. Fall back to ANSI
  return "ansi";
}

/**
 * Detect dialect from environment variables.
 */
function detectFromEnv(): SqlDialect | undefined {
  const targetType = process.env["DBT_TARGET_TYPE"] ?? process.env["DBT_ADAPTER"];
  if (targetType) {
    const normalized = targetType.toLowerCase().trim();
    return ADAPTER_TO_DIALECT[normalized];
  }
  return undefined;
}

/**
 * Detect dialect from dbt_project.yml + profiles.yml.
 */
function detectFromProfiles(projectDir: string): SqlDialect | undefined {
  // Read dbt_project.yml to get the profile name
  const projectPath = join(projectDir, "dbt_project.yml");
  if (!existsSync(projectPath)) {
    return undefined;
  }

  let projectContent: string;
  try {
    projectContent = readFileSync(projectPath, "utf-8");
  } catch {
    return undefined;
  }

  // Extract profile name (simple regex, avoids YAML dependency here)
  const profileMatch = /^profile:\s*['"]?(\w[\w-]*)['"]?/m.exec(projectContent);
  if (!profileMatch) {
    return undefined;
  }

  // Look for profiles.yml in standard locations
  const homedir = process.env["HOME"] ?? process.env["USERPROFILE"] ?? "";
  const profilePaths = [
    join(projectDir, "profiles.yml"),
    join(homedir, ".dbt", "profiles.yml"),
  ];

  for (const profilePath of profilePaths) {
    if (!existsSync(profilePath)) continue;

    let profileContent: string;
    try {
      profileContent = readFileSync(profilePath, "utf-8");
    } catch {
      continue;
    }

    // Look for "type: <adapter>" under the profile
    const typeMatch = /\btype:\s*['"]?(\w+)['"]?/m.exec(profileContent);
    if (typeMatch) {
      const adapter = typeMatch[1]!.toLowerCase();
      const dialect = ADAPTER_TO_DIALECT[adapter];
      if (dialect) return dialect;
    }
  }

  return undefined;
}

/**
 * Detect dialect from installed dbt packages.
 *
 * Checks packages.yml and requirements.txt for dbt adapter packages.
 */
function detectFromPackages(projectDir: string): SqlDialect | undefined {
  // Check requirements.txt for pip-installed adapters
  const reqPath = join(projectDir, "requirements.txt");
  if (existsSync(reqPath)) {
    try {
      const content = readFileSync(reqPath, "utf-8");
      for (const [adapter, dialect] of Object.entries(ADAPTER_TO_DIALECT)) {
        if (content.includes(`dbt-${adapter}`)) {
          return dialect;
        }
      }
    } catch {
      // Ignore read errors
    }
  }

  return undefined;
}
