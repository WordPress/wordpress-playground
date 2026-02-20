<!--
MAINTENANCE: Update this file when:
- Adding/removing npm scripts in package.json
- Changing the monorepo structure (new packages, major refactors)
- Modifying build/test workflows
- Adding new architectural patterns or conventions
- Updating Node.js/npm version requirements
-->

# AGENTS.md

This file provides guidance to AI coding agents when working with code in this repository.

## Project Overview

WordPress Playground is a monorepo that runs WordPress and PHP entirely in WebAssembly, enabling zero-setup WordPress environments in browsers, Node.js, and CLIs. The project consists of two major architectural layers and several supporting packages:

1. **PHP-WASM Layer** (`packages/php-wasm/*`): Emscripten-compiled PHP runtime for web and Node.js
2. **Playground Layer** (`packages/playground/*`): WordPress-specific tooling, client libraries, and applications
3. **Supporting packages**: `packages/nx-extensions/` (custom NX executors), `packages/docs/` (Docusaurus documentation site), `packages/meta/` (ESLint plugin, changelog tooling), `packages/bun-extensions/` and `packages/vite-extensions/` (build tooling)

## Build System

This is an NX monorepo with npm workspaces. All commands use NX for task orchestration.

**Node.js version**: This project requires a specific Node.js version (defined in `.nvmrc` and the `engines` field in root `package.json`). Before running any commands, ensure the correct version is active (e.g., via `nvm use` or other version manager).

### Common Commands

```bash
# Development
npm run dev                              # Start website dev server (localhost:5400)
npm run dev:docs                         # Start documentation site
npx nx dev playground-cli server         # Run CLI from source

# Building
npm run build                            # Build all packages
npm run build:website                    # Build the main website
npm run build:docs                       # Build documentation
npx nx build <package-name>              # Build specific package

# Testing
npm test                                 # Run all tests
npx nx test <package-name>               # Test specific package
npx nx e2e playground-website            # Run end-to-end tests

# Running a single test file
npx nx test <package-name> --testFile=<test-file-name>

# Linting & Formatting
npm run lint                             # Lint all packages
npm run typecheck                        # Type check all packages
npm run format                           # Format code with Prettier
npm run format:uncommitted               # Format only uncommitted files

# PHP Recompilation (advanced)
npm run recompile:php:web                # Recompile all PHP versions for web
npm run recompile:php:node               # Recompile all PHP versions for Node.js
npx nx recompile-php:jspi php-wasm-web -- --PHP_VERSION=8.4
npx nx recompile-php:asyncify php-wasm-node -- --PHP_VERSION=8.3

# WordPress Builds
npm run rebuild:wordpress-builds         # Rebuild all WordPress versions
```

### Package Naming Convention

- `@php-wasm/<name>`: PHP runtime and utilities
- `@wp-playground/<name>`: WordPress Playground features and tools

## Architecture

### Client-Remote Communication

The core architecture uses an iframe-based isolation model:

```
@wp-playground/client (parent window)
    ↓ postMessage API
@wp-playground/remote (iframe content, runs PHP)
    ↓
@php-wasm/web (PHP runtime)
    ↓
@php-wasm/universal (abstract interface)
```

**Key packages:**

- `@wp-playground/client`: JavaScript API for embedding Playground in iframes
- `@wp-playground/remote`: The HTML application running inside the iframe
- `@php-wasm/web`: Browser-based PHP runtime (uses Emscripten WASM)
- `@php-wasm/node`: Node.js-based PHP runtime
- `@php-wasm/universal`: Abstract interface shared by web and node implementations

### Blueprint System

Blueprints are declarative JSON configurations that define WordPress site states. Located in `@wp-playground/blueprints`.

**Key concepts:**

- Blueprint steps execute sequentially (e.g., `installPlugin`, `login`, `runPHP`)
- Two execution modes: V1 (TypeScript runner) and V2 (experimental PHP runner)
- Steps are defined in `packages/playground/blueprints/src/lib/steps/`
- Each step has a `.ts` implementation and `.spec.ts` test file

**Common blueprint steps:**

- `installPlugin`, `activatePlugin`: Plugin management
- `installTheme`, `activateTheme`: Theme management
- `login`: User authentication
- `runPHP`, `runPHPWithOptions`: Execute PHP code
- `defineWpConfigConsts`: Modify wp-config.php
- `importWxr`, `importWordPressFiles`: Import content

**Schema generation:** Blueprint JSON schemas are auto-generated from TypeScript types.
After modifying step interfaces, rebuild with `npx nx build playground-blueprints`.
The schema is NOT auto-rebuilt in `npm run dev` mode.

### Storage & Sync

- `@wp-playground/storage`: Provides filesystem backends (IndexedDB in browser, filesystem in Node)
- `@wp-playground/sync`: Multi-client synchronization for collaborative editing
- `@php-wasm/fs-journal`: Tracks filesystem changes for synchronization

### WordPress Builds

`@wp-playground/wordpress-builds` compiles specific WordPress versions into the playground format. Each version is tested and bundled separately.

### Multi-Runtime PHP Support

PHP binaries are compiled separately for:

- **Web (browser)**: Asyncify and JSPI variants for different browser capabilities
- **Node.js**: Native async/await support

Version-specific builds: `@php-wasm/web-7-4` through `@php-wasm/web-8-5` (and corresponding node-builds)

## Development Conventions

### TypeScript

- **Type imports must be explicit**: Use `import type { Foo } from 'bar'` (required for Node.js type stripping)
- **No parameter properties**: TypeScript parameter properties are not supported by Node.js type stripping
- Module resolution: `bundler` mode in tsconfig
- Target: ES2021 with ESNext modules
- Path aliases defined in `tsconfig.base.json` for cross-package imports

### Code Style

- **Comment length**: Max 100 characters per line (enforced by ESLint)
- **No console.log**: Disallowed except in tests and bin/ scripts
- **Consistent type imports**: Required by `@typescript-eslint/consistent-type-imports`
- **Module boundaries**: Enforced via `@nx/enforce-module-boundaries`
    - Packages tagged `scope:web-client` cannot be depended on by others
    - `scope:independent-from-php-binaries` packages cannot depend on `scope:php-binaries`
- **Function ordering:** First caller, then callee. When function A calls function B, write first A, then B.
- **Method ordering:** First public, then protected, then private. Respect **Function ordering** as well.

### Testing

- **Test files**: Co-located with implementation as `*.spec.ts`
- **Test runner**: Vitest (via `@nx/vite:test`) for most packages; some packages use Jest (via `@nx/jest`)
- **Coverage**: Reports to `coverage/packages/<package-name>`
- **E2E tests**: Playwright and Cypress for website testing
- **Always fix failing tests**: Never skip failing tests; fix the code to make tests pass

### Package Structure

All published packages follow this pattern:

```
packages/[layer]/[package-name]/
├── src/
│   ├── index.ts              # Main entry point
│   └── lib/                  # Implementation
├── package.json              # npm metadata
├── project.json              # NX build configuration
├── tsconfig.json             # Base TypeScript config
├── tsconfig.lib.json         # Library build config
├── tsconfig.spec.json        # Test config
└── README.md                 # Package documentation
```

Some packages have their own `AGENTS.md` with package-specific guidance. Check
for one when working within a package.

### Publishing

- **Dual format**: All packages publish both ESM (`.js`) and CommonJS (`.cjs`)
- **publishConfig.directory**: Points to `dist/packages/[layer]/[package-name]`
- **Lerna**: Used for coordinated multi-package publishing (`npm run release`)
- **Exports field**: Defines both `import` and `require` conditions
- Version management: All packages versioned together (see `lerna.json` for current version)

## Special Workflows

### Running Tests from Source

```bash
# Individual package test
npx nx test playground-blueprints

# Run specific test file
npx nx test playground-blueprints --testFile=activate-plugin.spec.ts

# Run with coverage
npx nx test playground-blueprints --coverage

# E2E tests
npx nx e2e playground-website
```

### CLI Development

The Playground CLI (`@wp-playground/cli`) can be run directly from source:

```bash
npx nx dev playground-cli server --wp=6.8 --php=8.4 --auto-mount
```

**CLI features:**

- `--auto-mount`: Automatically detect and mount plugin/theme/WordPress directory
- `--blueprint=<path>`: Execute a blueprint JSON file
- `--mount=<src>:<dest>`: Manually mount directories
- `--login`: Auto-login as admin
- `--php=<version>`: Choose PHP version (7.4-8.5)
- `--wp=<version>`: Choose WordPress version

### Git Operations

- **Default branch**: `trunk` is the primary development branch
- **Never use bare `git push`**: Always specify remote and branch explicitly
- **Shallow clone recommended**: `git clone -b trunk --single-branch --depth 1 --recurse-submodules`
- **Submodules**: isomorphic-git submodule provides browser-based git operations

### Working with PHP Binaries

PHP binaries are pre-compiled and committed to the repository. Recompilation is rarely needed but can be done with:

```bash
# Recompile all PHP versions for web
npm run recompile:php:web

# Recompile specific PHP version with JSPI
npx nx recompile-php:jspi php-wasm-web -- --PHP_VERSION=8.4

# Debug builds (with DWARF info)
npx nx recompile-php:all php-wasm-node -- --WITH_DEBUG=yes

# Source maps for debugging
npx nx recompile-php:all php-wasm-node -- --WITH_SOURCEMAPS=yes
```

### Custom NX Executors

Located in `packages/nx-extensions/src/executors/`:

- `build`: Builds packages
- `built-script`: Runs scripts from built output
- `package-json`: Generates package.json with correct exports
- `assert-built-esm-and-cjs`: Verifies dual-format build
- `package-for-self-hosting`: Creates distributable archives

## Key Files & Directories

- `nx.json`: NX workspace configuration
- `tsconfig.base.json`: TypeScript path aliases and compiler options
- `package.json`: Root package with all npm scripts
- `lerna.json`: Version management and publish configuration
- `.eslintrc.json`: ESLint rules including module boundaries
- `packages/playground/blueprints/src/lib/steps/`: Blueprint step implementations
- `packages/php-wasm/universal/`: Core PHP abstraction layer
- `packages/php-wasm/compile/`: Docker/Emscripten PHP build pipeline
- `packages/playground/website/`: Main demo application
- `packages/playground/cli/`: CLI tool implementation
- `packages/docs/`: Docusaurus documentation site
- `packages/meta/`: Internal tooling (ESLint plugin, changelog)
- `isomorphic-git/`: Git operations in browser (submodule)

## Documentation

- Deployed to https://wordpress.github.io/wordpress-playground/
- Built with Docusaurus in `packages/docs/`
- API reference generated with TypeDoc from package source

## Important Notes

- **Backwards compatibility**: Breaking changes are acceptable and often useful
  during development, but must be surfaced to the developer. When creating a PR,
  clearly document any breaking changes in the PR description. Key downstream
  consumers include Telex, Studio, and wp-env
- **Offline support**: Website can be built for offline use with service workers
- **WordPress major and beta versions**: Auto-refreshed via GitHub Actions
- **SQLite integration**: WordPress uses SQLite by default (no MySQL required)
- **Security**: Iframe-based isolation prevents untrusted code execution in parent window
