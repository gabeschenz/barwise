# Spec: Static Analysis Toolchain

## Goal

Add a comprehensive static analysis and quality gate pipeline to the
Barwise monorepo. Each tool runs locally (pre-commit and on-demand) and
in CI (GitHub Actions on every PR).

## Stages

### Stage 1: knip (dead code detection)

- Install `knip` as a root devDependency.
- Add `knip.json` config targeting all 6 packages.
- Add `npm run knip` script to root package.json.
- Fix any real issues found (unused exports, deps, files).
- Status: Complete

### Stage 2: husky + lint-staged (pre-commit hooks)

- Install `husky` and `lint-staged` as root devDependencies.
- husky needs to live at the git repo root (one level above the
  npm workspace root). Use `--prefix` or a `prepare` script that
  targets `../../.husky`.
- lint-staged config: run `eslint --fix` on staged `.ts` files,
  `tsc --noEmit` via turbo, and dprint (once added in Stage 4).
- Status: Complete

### Stage 3: GitHub Actions CI

- Create `.github/workflows/ci.yml` at the git repo root.
- Jobs: install, build, test, lint. Use Turborepo caching.
- Trigger on: pull_request to main, push to main.
- Node 20, npm ci, turbo run build test lint.
- Status: Not Started

### Stage 4: dprint (code formatting)

- Install `dprint` as a root devDependency.
- Create `dprint.json` at the monorepo root with plugins for
  TypeScript, JSON, Markdown.
- Format the entire codebase in one pass.
- Add `npm run fmt` and `npm run fmt:check` scripts.
- Integrate into lint-staged (from Stage 2) and CI (Stage 3).
- Status: Not Started

### Stage 5: madge (circular dependency detection)

- Install `madge` as a root devDependency.
- Add `npm run circular` script that checks all packages.
- Add to CI workflow.
- Status: Not Started

### Stage 6: oxlint (fast linting)

- Install `oxlint` as a root devDependency.
- Run alongside ESLint (not replacing it). oxlint catches
  additional correctness issues that ESLint rules miss.
- Add `npm run oxlint` script.
- Add to CI workflow and pre-commit hooks.
- Status: Not Started

### Stage 7: tsc --incremental

- Add `incremental: true` and `tsBuildInfoFile` to
  tsconfig.base.json.
- Add `.tsbuildinfo` to .gitignore.
- Verify Turborepo caching still works correctly with
  incremental output.
- Status: Not Started

### Stage 8: publint (package publishing lint)

- Install `publint` as a root devDependency.
- Add `npm run publint` script that checks all publishable
  packages (core, diagram, llm, cli, mcp).
- Add to CI workflow.
- Fix any issues found (exports, types, main fields).
- Status: Not Started

## Commit Strategy

One commit per stage. Each commit must build, test, and lint cleanly.
Feature branch with a single PR at the end.

## Non-Goals

- Replacing ESLint with oxlint (run both for now).
- Configuring npm publishing (just prepare for it with publint).
- Adding YAML formatting to dprint (the orm.yaml schema files are
  machine-generated and have specific formatting requirements).
