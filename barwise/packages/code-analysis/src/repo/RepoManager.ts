/**
 * Manages cloning, pulling, and checking out GitHub repositories
 * via the GitHub CLI (gh). Repos are stored in ~/.barwise/repos/.
 */

import { execFile } from "node:child_process";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { type CloneOptions, formatRepoRef, type RepoRef } from "./types.js";

const execFileAsync = promisify(execFile);

const REPOS_ROOT = join(homedir(), ".barwise", "repos");

export class RepoManager {
  private readonly reposRoot: string;

  constructor(reposRoot?: string) {
    this.reposRoot = reposRoot ?? REPOS_ROOT;
  }

  /** Ensure gh is installed and authenticated. */
  async checkAuth(): Promise<void> {
    try {
      await execFileAsync("gh", ["auth", "status"]);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes("ENOENT") || msg.includes("not found")) {
        throw new Error(
          "GitHub CLI (gh) is required for repository analysis.\n"
            + "Install: https://cli.github.com\n"
            + "Authenticate: gh auth login",
          { cause: error },
        );
      }
      throw new Error(
        "GitHub CLI is not authenticated.\n"
          + "Run: gh auth login",
        { cause: error },
      );
    }
  }

  /**
   * Clone a repository. Returns the local path.
   * Throws if the repo already exists locally.
   */
  async clone(repo: RepoRef, options?: CloneOptions): Promise<string> {
    const localPath = this.localPath(repo);
    if (this.exists(repo)) {
      throw new Error(
        `Repository ${formatRepoRef(repo)} already cloned at ${localPath}. `
          + "Use pull() to update.",
      );
    }

    // Ensure parent directory exists
    const parentDir = join(this.reposRoot, repo.owner);
    mkdirSync(parentDir, { recursive: true });

    const depth = options?.depth ?? 1;
    const ghArgs = [
      "repo",
      "clone",
      formatRepoRef(repo),
      localPath,
    ];

    // Pass git-specific args after --
    if (depth > 0) {
      ghArgs.push("--", "--depth", String(depth));
    }

    try {
      await execFileAsync("gh", ghArgs);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      if (
        msg.includes("Could not resolve")
        || msg.includes("HTTP 404")
        || msg.includes("HTTP 403")
      ) {
        throw new Error(
          `Cannot access ${formatRepoRef(repo)}.\n`
            + "Check that your GitHub account has read access to this repository:\n"
            + `  gh repo view ${formatRepoRef(repo)}`,
          { cause: error },
        );
      }
      throw new Error(
        `Failed to clone ${formatRepoRef(repo)}: ${msg}`,
        { cause: error },
      );
    }

    // Checkout specific ref if requested
    if (options?.ref) {
      await this.checkout(repo, options.ref);
    }

    return localPath;
  }

  /**
   * Pull latest changes for an already-cloned repo.
   * Returns the new HEAD commit hash.
   */
  async pull(repo: RepoRef): Promise<string> {
    const localPath = this.localPath(repo);
    if (!this.exists(repo)) {
      throw new Error(
        `Repository ${formatRepoRef(repo)} not found at ${localPath}. `
          + "Use clone() first.",
      );
    }

    try {
      await execFileAsync("git", ["pull", "--ff-only"], {
        cwd: localPath,
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Failed to pull ${formatRepoRef(repo)}: ${msg}`,
        { cause: error },
      );
    }

    return this.head(repo);
  }

  /** Checkout a specific ref (branch, tag, or commit). */
  async checkout(repo: RepoRef, ref: string): Promise<void> {
    const localPath = this.localPath(repo);
    if (!this.exists(repo)) {
      throw new Error(
        `Repository ${formatRepoRef(repo)} not found at ${localPath}.`,
      );
    }

    try {
      await execFileAsync("git", ["checkout", ref], {
        cwd: localPath,
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Failed to checkout "${ref}" in ${formatRepoRef(repo)}: ${msg}`,
        { cause: error },
      );
    }
  }

  /** Get the current HEAD commit hash. */
  async head(repo: RepoRef): Promise<string> {
    const localPath = this.localPath(repo);
    if (!this.exists(repo)) {
      throw new Error(
        `Repository ${formatRepoRef(repo)} not found at ${localPath}.`,
      );
    }

    const { stdout } = await execFileAsync(
      "git",
      ["rev-parse", "HEAD"],
      { cwd: localPath },
    );
    return stdout.trim();
  }

  /** Check if a repo is already cloned locally. */
  exists(repo: RepoRef): boolean {
    const gitDir = join(this.localPath(repo), ".git");
    return existsSync(gitDir);
  }

  /** Get the local filesystem path for a repo. */
  localPath(repo: RepoRef): string {
    return join(this.reposRoot, repo.owner, repo.name);
  }

  /** Remove a cloned repo from disk. */
  async remove(repo: RepoRef): Promise<void> {
    const localPath = this.localPath(repo);
    if (!this.exists(repo)) {
      return; // Nothing to remove
    }
    rmSync(localPath, { recursive: true, force: true });
  }
}
