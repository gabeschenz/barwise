.PHONY: help deps install build test test-watch test-coverage lint lint-fix \
       fmt fmt-check clean typecheck circular knip oxlint publint quality \
       test-core test-diagram test-llm test-cli test-mcp test-vscode \
       build-core build-cli build-mcp build-vscode bundle-mcp \
       test-integration vsix hooks

# -- Config -----------------------------------------------------------

TURBO   := npx turbo
VITEST  := npx vitest
DPRINT  := npx dprint
ESLINT  := npx eslint

# -- Default -----------------------------------------------------------

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'

# -- Setup -------------------------------------------------------------

deps: ## Install npm dependencies
	npm install

hooks: ## Install git hooks (husky)
	npx husky install

# -- Install -----------------------------------------------------------

install: build bundle-mcp ## Build and install CLI, MCP server, and VS Code extension
	cd packages/cli && npm link
	cd packages/mcp && npm link
	cd packages/vscode && npx @vscode/vsce package --no-dependencies --skip-license
	code --install-extension packages/vscode/barwise-vscode-$(shell node -p "require('./packages/vscode/package.json').version").vsix
	@echo ""
	@echo "Installed:"
	@echo "  barwise     $(shell node -p "require('./packages/cli/package.json').version")"
	@echo "  barwise-mcp $(shell node -p "require('./packages/mcp/package.json').version")"
	@echo "  VS Code ext $(shell node -p "require('./packages/vscode/package.json').version")"

# -- Build -------------------------------------------------------------

build: clean ## Clean, build all packages, then run tests
	$(TURBO) run build test

build-core: ## Build @barwise/core only
	$(TURBO) run build --filter=@barwise/core

build-cli: ## Build @barwise/cli and its dependencies
	$(TURBO) run build --filter=@barwise/cli...

build-mcp: ## Build @barwise/mcp and its dependencies
	$(TURBO) run build --filter=@barwise/mcp...

build-vscode: ## Build barwise-vscode and its dependencies
	$(TURBO) run build --filter=barwise-vscode...

bundle-mcp: ## Create standalone MCP server bundle
	cd packages/mcp && node esbuild.mjs

# -- Test --------------------------------------------------------------

test: ## Run all tests (Turborepo)
	$(TURBO) run test

test-watch: ## Run tests in watch mode
	$(TURBO) run test:watch

test-coverage: ## Run core tests with coverage
	cd packages/core && $(VITEST) run --coverage

test-core: ## Run @barwise/core tests only
	cd packages/core && $(VITEST) run

test-diagram: ## Run @barwise/diagram tests only
	cd packages/diagram && $(VITEST) run

test-llm: ## Run @barwise/llm tests only
	cd packages/llm && $(VITEST) run

test-cli: ## Run @barwise/cli tests only
	cd packages/cli && $(VITEST) run

test-mcp: ## Run @barwise/mcp tests only
	cd packages/mcp && $(VITEST) run

test-vscode: ## Run barwise-vscode unit tests only
	cd packages/vscode && $(VITEST) run

test-integration: ## Run VS Code integration tests
	cd packages/vscode && npm run test:integration

# -- Lint & Format -----------------------------------------------------

lint: ## Lint all packages (ESLint via Turborepo)
	$(TURBO) run lint

lint-fix: ## Lint and auto-fix all packages
	$(ESLINT) --fix packages/*/src/ packages/*/tests/

fmt: ## Format all files (dprint)
	$(DPRINT) fmt

fmt-check: ## Check formatting without writing (dprint)
	$(DPRINT) check

# -- Type Checking -----------------------------------------------------

typecheck: ## Type-check all packages (no emit)
	$(TURBO) run build
	@echo "Build succeeded -- all packages type-check."

typecheck-core: ## Type-check @barwise/core only
	cd packages/core && npx tsc --noEmit

typecheck-vscode: ## Type-check barwise-vscode only
	cd packages/vscode && npx tsc --noEmit -p tsconfig.json

# -- Quality -----------------------------------------------------------

circular: ## Check for circular imports (madge)
	npm run circular

knip: ## Find unused exports and dependencies (knip)
	npx knip

oxlint: ## Run oxlint on all packages
	npx oxlint packages/*/src/

publint: ## Check package publish readiness (publint)
	npm run publint

quality: circular knip oxlint publint ## Run all quality checks

# -- Clean -------------------------------------------------------------

clean: ## Remove all dist/ directories
	$(TURBO) run clean

# -- Packaging ---------------------------------------------------------

vsix: build ## Build VS Code extension VSIX
	cd packages/vscode && npx @vscode/vsce package --no-dependencies --skip-license

# -- Convenience -------------------------------------------------------

all: deps build lint fmt-check ## Full CI pipeline: deps, build, test, lint, format check
	@echo "All checks passed."

ci: build lint fmt-check ## CI checks (assumes deps installed): build, test, lint, format check
	@echo "CI checks passed."

dev: deps build ## Quick dev setup: deps and build
	@echo "Ready to develop."
