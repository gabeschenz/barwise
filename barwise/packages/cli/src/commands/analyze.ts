/**
 * barwise analyze <repo>
 *
 * Analyze a GitHub repository to extract business rules and constraints.
 * Phase 1 supports --profile-only to show the repo profile without
 * running the full analysis pipeline.
 *
 * Example:
 *   barwise analyze MyOrg/MyRepo --profile-only
 *   barwise analyze MyOrg/MyRepo --profile-only --format json
 *   barwise analyze MyOrg/MyRepo --ref v2.0.0 --profile-only
 */

import {
  formatRepoRef,
  parseRepoRef,
  profileRepository,
  RepoManager,
} from "@barwise/code-analysis";
import type { RepoProfile } from "@barwise/code-analysis";
import type { Command } from "commander";

export function registerAnalyzeCommand(program: Command): void {
  program
    .command("analyze")
    .description("Analyze a GitHub repository for business rules and constraints")
    .argument("<repo>", "GitHub repository (owner/name)")
    .option("--profile-only", "Show repository profile without running full analysis")
    .option("--ref <ref>", "Branch, tag, or commit to analyze")
    .option("--depth <depth>", "Clone depth (0 for full clone)", "1")
    .option("--format <format>", "Output format (text or json)", "text")
    .action(
      async (
        repoArg: string,
        opts: {
          profileOnly?: boolean;
          ref?: string;
          depth: string;
          format: string;
        },
      ) => {
        try {
          // Parse repo reference.
          const repo = parseRepoRef(repoArg);
          const manager = new RepoManager();

          // Check GitHub CLI auth.
          process.stderr.write("Checking GitHub authentication...\n");
          await manager.checkAuth();

          // Clone or update.
          let localPath: string;
          if (manager.exists(repo)) {
            process.stderr.write(
              `Repository ${formatRepoRef(repo)} already cloned. Pulling latest...\n`,
            );
            const commit = await manager.pull(repo);
            localPath = manager.localPath(repo);
            process.stderr.write(`Updated to ${commit.slice(0, 8)}.\n`);
          } else {
            process.stderr.write(
              `Cloning ${formatRepoRef(repo)}...\n`,
            );
            const depth = Number.parseInt(opts.depth, 10);
            localPath = await manager.clone(repo, {
              depth: Number.isNaN(depth) ? 1 : depth,
              ref: opts.ref,
            });
            const commit = await manager.head(repo);
            process.stderr.write(
              `Cloned to ${localPath} (${commit.slice(0, 8)}).\n`,
            );
          }

          // Profile the repository.
          process.stderr.write("Profiling repository...\n");
          const profile = profileRepository(localPath);

          if (opts.profileOnly) {
            if (opts.format === "json") {
              const json = formatProfileJson(profile, repoArg);
              process.stdout.write(json + "\n");
            } else {
              const text = formatProfileText(profile, repoArg);
              process.stdout.write(text + "\n");
            }
            return;
          }

          // Full analysis is Phase 2+. For now, show the profile
          // and explain that full analysis is not yet implemented.
          if (opts.format === "json") {
            const json = formatProfileJson(profile, repoArg);
            process.stdout.write(json + "\n");
          } else {
            const text = formatProfileText(profile, repoArg);
            process.stdout.write(text + "\n");
          }
          process.stderr.write(
            "\nFull analysis pipeline coming in a future release.\n"
              + "Use --profile-only to suppress this message.\n",
          );
        } catch (err) {
          process.stderr.write(`Error: ${(err as Error).message}\n`);
          process.exitCode = 1;
        }
      },
    );
}

/** Format a repo profile as human-readable text. */
function formatProfileText(profile: RepoProfile, repo: string): string {
  const lines: string[] = [];
  lines.push(`Repository: ${repo}`);
  lines.push("");
  lines.push(profile.summary);
  lines.push("");
  lines.push("--- Details ---");
  lines.push(`Language: ${profile.language}`);
  lines.push(`Framework: ${profile.framework?.name ?? "none"}`);
  if (profile.framework) {
    lines.push(`  Confidence: ${profile.framework.confidence}`);
    lines.push(`  Score: ${profile.framework.score}`);
    for (const signal of profile.framework.signals) {
      lines.push(`  Signal: ${signal.indicator} (${signal.weight})`);
    }
  }
  lines.push(`Build system: ${profile.buildSystem?.name ?? "none"}`);
  lines.push(`Source files: ${profile.sourceFileCount}`);
  lines.push(`Import format: ${profile.importFormat ?? "none (LLM fallback)"}`);
  if (profile.domainPaths.length > 0) {
    lines.push(`Domain paths: ${profile.domainPaths.length}`);
    for (const p of profile.domainPaths) {
      lines.push(`  ${p}`);
    }
  }
  if (profile.excludePaths.length > 0) {
    lines.push(`Exclude paths: ${profile.excludePaths.join(", ")}`);
  }
  return lines.join("\n");
}

/** Format a repo profile as JSON. */
function formatProfileJson(profile: RepoProfile, repo: string): string {
  return JSON.stringify(
    {
      repo,
      language: profile.language,
      framework: profile.framework
        ? {
          name: profile.framework.name,
          confidence: profile.framework.confidence,
          score: profile.framework.score,
          signals: profile.framework.signals.map((s) => ({
            indicator: s.indicator,
            location: s.location,
            weight: s.weight,
          })),
        }
        : null,
      buildSystem: profile.buildSystem
        ? {
          name: profile.buildSystem.name,
          buildFile: profile.buildSystem.buildFile,
        }
        : null,
      domainPaths: profile.domainPaths,
      excludePaths: profile.excludePaths,
      sourceFileCount: profile.sourceFileCount,
      importFormat: profile.importFormat,
    },
    null,
    2,
  );
}
