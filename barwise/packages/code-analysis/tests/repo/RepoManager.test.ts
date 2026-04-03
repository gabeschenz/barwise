import { execFile } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RepoManager } from "../../src/repo/RepoManager.js";
import { formatRepoRef, parseRepoRef, type RepoRef } from "../../src/repo/types.js";

// Mock child_process.execFile
vi.mock("node:child_process", () => ({
  execFile: vi.fn(),
}));

const mockExecFile = vi.mocked(execFile);

/** Create a mock execFile that resolves with given stdout. */
function mockExecSuccess(stdout = ""): void {
  mockExecFile.mockImplementation(
    (_cmd: string, _args: unknown, _opts: unknown, callback?: unknown) => {
      // execFile can be called with (cmd, args, callback) or (cmd, args, opts, callback)
      const cb = typeof _opts === "function" ? _opts : callback;
      if (typeof cb === "function") {
        (cb as (err: null, result: { stdout: string; stderr: string; }) => void)(
          null,
          { stdout, stderr: "" },
        );
      }
      return {} as ReturnType<typeof execFile>;
    },
  );
}

/** Create a mock execFile that rejects with given message. */
function mockExecFailure(message: string): void {
  mockExecFile.mockImplementation(
    (_cmd: string, _args: unknown, _opts: unknown, callback?: unknown) => {
      const cb = typeof _opts === "function" ? _opts : callback;
      if (typeof cb === "function") {
        (cb as (err: Error) => void)(new Error(message));
      }
      return {} as ReturnType<typeof execFile>;
    },
  );
}

describe("parseRepoRef", () => {
  it("parses owner/name format", () => {
    const ref = parseRepoRef("MyOrg/Foo");
    expect(ref).toEqual({ owner: "MyOrg", name: "Foo" });
  });

  it("rejects invalid format", () => {
    expect(() => parseRepoRef("just-a-name")).toThrow("Expected format: owner/name");
    expect(() => parseRepoRef("a/b/c")).toThrow("Expected format: owner/name");
    expect(() => parseRepoRef("")).toThrow("Expected format: owner/name");
    expect(() => parseRepoRef("/name")).toThrow("Expected format: owner/name");
    expect(() => parseRepoRef("owner/")).toThrow("Expected format: owner/name");
  });
});

describe("formatRepoRef", () => {
  it("formats as owner/name", () => {
    expect(formatRepoRef({ owner: "MyOrg", name: "Foo" })).toBe("MyOrg/Foo");
  });
});

describe("RepoManager", () => {
  let reposRoot: string;
  let manager: RepoManager;
  const repo: RepoRef = { owner: "TestOrg", name: "TestRepo" };

  beforeEach(() => {
    reposRoot = join(tmpdir(), `barwise-test-${Date.now()}`);
    mkdirSync(reposRoot, { recursive: true });
    manager = new RepoManager(reposRoot);
    vi.clearAllMocks();
  });

  afterEach(() => {
    rmSync(reposRoot, { recursive: true, force: true });
  });

  describe("localPath", () => {
    it("returns path under repos root", () => {
      expect(manager.localPath(repo)).toBe(
        join(reposRoot, "TestOrg", "TestRepo"),
      );
    });
  });

  describe("exists", () => {
    it("returns false when not cloned", () => {
      expect(manager.exists(repo)).toBe(false);
    });

    it("returns true when .git directory exists", () => {
      const gitDir = join(reposRoot, "TestOrg", "TestRepo", ".git");
      mkdirSync(gitDir, { recursive: true });
      expect(manager.exists(repo)).toBe(true);
    });
  });

  describe("checkAuth", () => {
    it("succeeds when gh is authenticated", async () => {
      mockExecSuccess();
      await expect(manager.checkAuth()).resolves.toBeUndefined();
    });

    it("throws when gh is not installed", async () => {
      mockExecFailure("ENOENT");
      await expect(manager.checkAuth()).rejects.toThrow(
        "GitHub CLI (gh) is required",
      );
    });

    it("throws when gh is not authenticated", async () => {
      mockExecFailure("not logged in");
      await expect(manager.checkAuth()).rejects.toThrow(
        "GitHub CLI is not authenticated",
      );
    });
  });

  describe("clone", () => {
    it("calls gh repo clone with correct args", async () => {
      mockExecSuccess();
      const path = await manager.clone(repo);

      expect(path).toBe(join(reposRoot, "TestOrg", "TestRepo"));

      // First call should be gh repo clone
      const firstCall = mockExecFile.mock.calls[0];
      expect(firstCall[0]).toBe("gh");
      expect(firstCall[1]).toEqual([
        "repo",
        "clone",
        "TestOrg/TestRepo",
        path,
        "--",
        "--depth",
        "1",
      ]);
    });

    it("supports custom depth", async () => {
      mockExecSuccess();
      await manager.clone(repo, { depth: 10 });

      const firstCall = mockExecFile.mock.calls[0];
      const args = firstCall[1] as string[];
      expect(args).toContain("--depth");
      expect(args).toContain("10");
    });

    it("supports full clone with depth 0", async () => {
      mockExecSuccess();
      await manager.clone(repo, { depth: 0 });

      const firstCall = mockExecFile.mock.calls[0];
      const args = firstCall[1] as string[];
      expect(args).not.toContain("--depth");
    });

    it("checks out ref after clone when specified", async () => {
      mockExecSuccess();
      // Need to fake the .git dir existing for checkout to work
      const gitDir = join(reposRoot, "TestOrg", "TestRepo", ".git");

      // Mock execFile to create .git dir on first call (simulating clone)
      let callCount = 0;
      mockExecFile.mockImplementation(
        (_cmd: string, _args: unknown, _opts: unknown, callback?: unknown) => {
          callCount++;
          if (callCount === 1) {
            mkdirSync(gitDir, { recursive: true });
          }
          const cb = typeof _opts === "function" ? _opts : callback;
          if (typeof cb === "function") {
            (cb as (err: null, result: { stdout: string; stderr: string; }) => void)(
              null,
              { stdout: "", stderr: "" },
            );
          }
          return {} as ReturnType<typeof execFile>;
        },
      );

      await manager.clone(repo, { ref: "v2.0.0" });

      // Second call should be git checkout
      expect(mockExecFile).toHaveBeenCalledTimes(2);
      const secondCall = mockExecFile.mock.calls[1];
      expect(secondCall[0]).toBe("git");
      expect(secondCall[1]).toEqual(["checkout", "v2.0.0"]);
    });

    it("throws if repo already cloned", async () => {
      const gitDir = join(reposRoot, "TestOrg", "TestRepo", ".git");
      mkdirSync(gitDir, { recursive: true });

      await expect(manager.clone(repo)).rejects.toThrow("already cloned");
    });

    it("throws with helpful message on access denial", async () => {
      mockExecFailure("HTTP 404");
      await expect(manager.clone(repo)).rejects.toThrow(
        "Cannot access TestOrg/TestRepo",
      );
    });
  });

  describe("pull", () => {
    it("runs git pull --ff-only in repo directory", async () => {
      // Create fake .git dir
      const gitDir = join(reposRoot, "TestOrg", "TestRepo", ".git");
      mkdirSync(gitDir, { recursive: true });

      mockExecSuccess("abc123\n");
      await manager.pull(repo);

      // First call: git pull
      const pullCall = mockExecFile.mock.calls[0];
      expect(pullCall[0]).toBe("git");
      expect(pullCall[1]).toEqual(["pull", "--ff-only"]);

      // Second call: git rev-parse HEAD (from head())
      const headCall = mockExecFile.mock.calls[1];
      expect(headCall[0]).toBe("git");
      expect(headCall[1]).toEqual(["rev-parse", "HEAD"]);
    });

    it("throws if repo not cloned", async () => {
      await expect(manager.pull(repo)).rejects.toThrow("not found");
    });
  });

  describe("head", () => {
    it("returns trimmed commit hash", async () => {
      const gitDir = join(reposRoot, "TestOrg", "TestRepo", ".git");
      mkdirSync(gitDir, { recursive: true });

      mockExecSuccess("a1b2c3d4e5f6\n");
      const hash = await manager.head(repo);
      expect(hash).toBe("a1b2c3d4e5f6");
    });

    it("throws if repo not cloned", async () => {
      await expect(manager.head(repo)).rejects.toThrow("not found");
    });
  });

  describe("remove", () => {
    it("removes cloned repo from disk", async () => {
      const gitDir = join(reposRoot, "TestOrg", "TestRepo", ".git");
      mkdirSync(gitDir, { recursive: true });
      writeFileSync(join(reposRoot, "TestOrg", "TestRepo", "file.txt"), "test");

      expect(manager.exists(repo)).toBe(true);
      await manager.remove(repo);
      expect(manager.exists(repo)).toBe(false);
    });

    it("does nothing if repo not cloned", async () => {
      await expect(manager.remove(repo)).resolves.toBeUndefined();
    });
  });
});
