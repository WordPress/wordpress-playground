# Blueprints V2 TypeScript Runner — Design Document

**Date:** 2026-03-30
**Status:** Design

## Summary

Replace the PHP `.phar`-based Blueprints V2 runner in WordPress Playground with a
native TypeScript implementation. The TS runner lives in the existing blueprints
package (`packages/playground/blueprints/src/lib/v2/`) and implements full spec
parity with the PHP runner. The PHP runner in `php-toolkit` continues to exist
independently for non-Playground use.

A future compliance test suite (shared between the PHP and TS runners) will
verify both implementations against the same blueprint fixtures.

## Design Decisions

| Decision                | Choice                                                  |
| ----------------------- | ------------------------------------------------------- |
| Scope                   | Full spec parity with PHP runner                        |
| Location                | Same package, `src/lib/v2/` subtree                     |
| PHP runner relationship | Replace within Playground                               |
| Step handler reuse      | Independent V2 handlers (can share low-level utilities) |

## Reference Documents

- [WEP-1: Blueprint V2 Schema](https://github.com/Automattic/WordPress-extension-proposals/tree/trunk/wep-1-blueprint-v2-schema)
- [PHP Blueprints Runner](https://github.com/WordPress/php-toolkit/tree/trunk/components/Blueprints)
- Existing V1 implementation: `packages/playground/blueprints/src/lib/v1/`

## Architecture

### Pipeline

```
Blueprint JSON (or V1 blueprint)
    → Parse & Validate (AJV schema validation, human-friendly errors)
    → V1→V2 Transpilation (if no `version` property)
    → Resolve Runtime Configuration (PHP/WP version constraints, app options)
    → Create Execution Plan (transpile declarative props → ordered steps)
    → Resolve Data References (download plugins, themes, etc. — eager, concurrent)
    → Execute Steps (sequentially, against UniversalPHP)
```

### Module Structure

```
packages/playground/blueprints/src/lib/v2/
├── index.ts                          # Public exports
├── types.ts                          # CompiledBlueprintV2, V2StepHandler, etc.
├── run.ts                            # Top-level compileBlueprintV2() + run orchestration
├── compile/
│   ├── compile.ts                    # Main compilation pipeline
│   ├── compile.spec.ts
│   ├── validate.ts                   # AJV schema validation
│   ├── transpile-declarative.ts      # Declarative props → ordered steps
│   ├── transpile-declarative.spec.ts
│   ├── v1-to-v2-transpiler.ts        # V1 → V2 blueprint transpilation
│   ├── v1-to-v2-transpiler.spec.ts
│   ├── merge.ts                      # Blueprint composition/merging
│   └── merge.spec.ts
├── data-references/
│   ├── resolver.ts                   # DataReference → ResolvedFile/Dir
│   ├── resolver.spec.ts
│   └── types.ts                      # ResolvedFile, ResolvedDirectory
├── steps/
│   ├── index.ts                      # Step handler registry
│   ├── define-constants.ts
│   ├── set-site-options.ts
│   ├── install-plugin.ts
│   ├── install-plugin.spec.ts
│   ├── activate-plugin.ts
│   ├── install-theme.ts
│   ├── activate-theme.ts
│   ├── import-content.ts
│   ├── import-media.ts
│   ├── run-php.ts
│   ├── run-sql.ts
│   ├── wp-cli.ts
│   ├── write-files.ts
│   ├── filesystem.ts                 # cp, mv, mkdir, rm, rmdir
│   ├── unzip.ts
│   ├── set-site-language.ts
│   └── import-theme-starter-content.ts
└── blueprint-v2-declaration.ts       # (existing, updated)
```

### Public API

Two main functions exported from the package:

```typescript
/**
 * Compiles a Blueprint V2 (or V1) declaration into an executable form.
 * Handles V1 detection/transpilation, schema validation, and
 * transpilation of declarative properties into ordered steps.
 */
function compileBlueprintV2(blueprint: BlueprintV2Declaration | BlueprintV1Declaration, options?: CompileBlueprintV2Options): Promise<CompiledBlueprintV2>;

interface CompileBlueprintV2Options {
	progress?: ProgressTracker;
	semaphore?: Semaphore; // Concurrency control (default: 3)
	corsProxy?: string;
	executionContext?: ReadableFilesystemBackend; // For bundle paths
	onStepCompleted?: (step: string, index: number) => void;
}
```

```typescript
interface CompiledBlueprintV2 {
	runtimeConfig: {
		phpVersion?: VersionConstraint;
		wordpressVersion?: VersionConstraint;
		applicationOptions?: {
			'wordpress-playground'?: {
				landingPage?: string;
				login?: boolean | { username: string; password: string };
				networkAccess?: boolean;
			};
		};
	};
	steps: CompiledV2Step[];
	run: (playground: UniversalPHP) => Promise<void>;
}
```

## Compilation & Validation

### Validation

JSON schema validation using AJV, matching the approach in V1. The schema is
generated from the TypeScript types in `wep-1-blueprint-v2-schema/`. Validation
produces human-friendly error messages per the spec — suggesting typo
corrections for step names, pointing to specific JSON paths, etc.

### Transpilation: Declarative → Steps

Declarative properties are converted into an ordered step list following the
spec-defined order:

1. `constants` → `defineConstants`
2. `siteOptions` → `setSiteOptions`
3. `muPlugins` → mu-plugin installation
4. `themes` → `installTheme` (each, not activated)
5. `activeTheme` → `installTheme` + `activateTheme`
6. `plugins` → `installPlugin` (each, `active: true` by default)
7. `fonts` → font installation
8. `media` → `importMedia`
9. `siteLanguage` → `setSiteLanguage`
10. `roles` → role creation via `runPHP`
11. `users` → user creation via `runPHP`
12. `postTypes` → post type registration via `runPHP`
13. `content` → `importContent`
14. `additionalStepsAfterExecution` → appended as-is

Each compiled step holds its raw args plus unresolved data references.
Resolution happens lazily during execution — downloads start eagerly but steps
await their specific references before running.

## Data References

### V2 Reference Types

```typescript
type DataReference =
	| URLReference // "https://..."
	| ExecutionContextPath // "./" or "/" prefixed paths
	| InlineFile // { filename, content }
	| InlineDirectory // { directoryName, files }
	| GitPath; // { gitRepository, ref?, pathInRepository? }
```

Plus contextual references for specific schema locations:

- `PluginDirectoryReference` — `"jetpack"` or `"jetpack@6.4.3"`
- `ThemeDirectoryReference` — same pattern for themes

### Resolution

The resolver converts a `DataReference` into concrete content:

1. **Classify** the reference by inspecting its shape
2. **Fetch** the content (HTTP download, WordPress.org API, execution context
   filesystem read, or inline content unwrap)
3. **Return** a `ResolvedFile` (bytes + filename) or `ResolvedDirectory` (filesystem tree)

Configuration:

- `Semaphore` for concurrency limiting (default 3 concurrent downloads)
- Optional CORS proxy URL
- Execution context filesystem (for `./` and `/` path resolution)
- Optional git auth headers callback

Downloads are queued eagerly at the start of execution in the order steps will
need them. Each step awaits its references before running.

## Step Handlers

Each step has an independent handler with this signature:

```typescript
type V2StepHandler<TArgs> = (playground: UniversalPHP, args: TArgs, context: StepExecutionContext) => Promise<void>;

interface StepExecutionContext {
	progress: ProgressTracker;
	resolver: DataReferenceResolver;
	executionContext?: ReadableFilesystemBackend;
}
```

### Handler Inventory

| Handler                            | Behavior                                                                                           |
| ---------------------------------- | -------------------------------------------------------------------------------------------------- |
| `defineConstants`                  | Writes `define()` calls into `wp-config.php`                                                       |
| `setSiteOptions`                   | Runs PHP to call `update_option()` per key-value pair                                              |
| `setSiteLanguage`                  | Sets WPLANG, downloads translations via WP API                                                     |
| `installPlugin`                    | Resolves source (slug, URL, path, inline), extracts to `wp-content/plugins/`, optionally activates |
| `activatePlugin`                   | Runs PHP to call `activate_plugin()`                                                               |
| `installTheme`                     | Resolves source, extracts to `wp-content/themes/`                                                  |
| `activateTheme`                    | Runs PHP to call `switch_theme()`                                                                  |
| `importThemeStarterContent`        | Runs PHP to trigger theme starter content import                                                   |
| `importContent`                    | Handles `mysql-dump`, `posts`, and `wxr` content types via PHP                                     |
| `importMedia`                      | Uploads files to WP Media Library via PHP                                                          |
| `runPHP`                           | Resolves inline/file PHP code, executes via `playground.run()`                                     |
| `runSQL`                           | Resolves SQL source, executes statements against the database                                      |
| `wp-cli`                           | Runs WP-CLI commands via the PHP runtime                                                           |
| `writeFiles`                       | Resolves each file reference, writes to target paths                                               |
| `cp`, `mv`, `mkdir`, `rm`, `rmdir` | Filesystem operations on the Playground VFS                                                        |
| `unzip`                            | Resolves zip source, extracts to target path                                                       |

Most handlers resolve data references then execute PHP. The complex ones are
`installPlugin`/`installTheme` (detecting zip vs directory vs single-file
format) and `importContent` (delegating to Data Liberation importers in PHP).

## V1→V2 Transpilation

Any blueprint without a `version` property is treated as V1. The transpiler
(`compile/v1-to-v2-transpiler.ts`) follows the spec's mapping tables:

### Top-level Property Mapping

| V1 property                | V2 destination                                             |
| -------------------------- | ---------------------------------------------------------- |
| `preferredVersions.php/wp` | `phpVersion`/`wordpressVersion`                            |
| `landingPage`              | `applicationOptions['wordpress-playground'].landingPage`   |
| `login`                    | `applicationOptions['wordpress-playground'].login`         |
| `features.networking`      | `applicationOptions['wordpress-playground'].networkAccess` |
| `meta.title`               | `blueprintMeta.name`                                       |
| `meta.description`         | `blueprintMeta.description`                                |
| `meta.author`              | `blueprintMeta.authors` (wrapped in array)                 |
| `meta.categories`          | `blueprintMeta.tags`                                       |
| `plugins` (shorthand)      | `additionalStepsAfterExecution[].installPlugin`            |
| `steps`                    | `additionalStepsAfterExecution` (with per-step rewrites)   |
| `constants`                | `additionalStepsAfterExecution[].defineConstants`          |
| `siteOptions`              | `additionalStepsAfterExecution[].setSiteOptions`           |

### Per-Step Rewrites

Each V1 step maps to a V2 equivalent with renamed fields per the spec tables
(e.g., `pluginData` → `source`, `themeFolderName` → `themeDirectoryName`,
`defineWpConfigConsts` → `defineConstants`).

### Resource→DataReference Conversion

V1 resource objects are rewritten to V2 data references:

- `{ resource: "url", url: "..." }` → the URL string
- `{ resource: "literal", name, contents }` → `{ filename, content }`
- `{ resource: "wordpress.org/plugins", slug }` → the slug string
- `{ resource: "vfs", path }` → `"site:<path>"`
- `{ resource: "bundled", path }` → `"./<path>"`
- `{ resource: "git:directory", ... }` → `{ gitRepository, ref, pathInRepository }`

### Path Translation

VFS paths starting with `/wordpress/` or `wordpress/` are rewritten to
document-root-relative paths. PHP code in `runPHP` steps gets `/wordpress/`
literals replaced with `getenv('DOCROOT') . '/<relative-path>'`.

## Blueprint Composition

The merge algorithm (`compile/merge.ts`) implements the spec's composition rules:

1. **Initialize** an empty merge target
2. **Validate** each input blueprint
3. **Merge loop** — for each input blueprint:
    - `version`: assert same
    - `blueprintMeta`, `$schema`: ignore
    - `siteLanguage`, `activeTheme`: use if only one defines it, conflict if both differ
    - `constants`, `siteOptions`, `postTypes`, `fonts`: append key-value pairs, fail on conflicts
    - `phpVersion`, `wordpressVersion`: intersect version ranges, fail if empty intersection
    - `plugins`, `themes`, `muPlugins`: merge by slug, assert identical definitions
    - `additionalStepsAfterExecution`, `content`, `media`: append
    - `users`: merge by username/email, fail on role conflicts
    - `roles`: merge by name, fail on capability conflicts
4. **File merge** for bundles: copy files, fail on path collisions

## Integration Points

### CLI (`packages/playground/cli/`)

In `blueprints-v2/worker-thread-v2.ts`, replace:

```typescript
const streamed = await runBlueprintV2({ php, blueprint, ... });
```

With:

```typescript
const compiled = await compileBlueprintV2(blueprint, { progress, ... });
await compiled.run(php);
```

### Website Remote Worker (`packages/playground/remote/`)

In `playground-worker-endpoint-blueprints-v2.ts`, same replacement pattern.

### Client (`packages/playground/client/`)

No changes — it already passes the blueprint to the remote worker and listens
for events.

### What Gets Deleted

- `get-v2-runner.ts` (loads the `.phar` binary)
- The old `run-blueprint-v2.ts` (PHP execution wrapper)
- The `.phar` binary from the build pipeline
- The `run-blueprints.php` helper script

### What Stays

- `blueprint-v2-declaration.ts` (types and parsing, updated)
- `wep-1-blueprint-v2-schema/` (source of truth for V2 types)
- The `--experimental-blueprints-v2-runner` flag

## Testing

### Unit Tests

Co-located `.spec.ts` files using the same pattern as V1 — create a
`UniversalPHP` instance, run compiled blueprints, assert state. Key areas:

- **Transpilation order** — declarative properties produce steps in spec-defined order
- **V1→V2 transpilation** — every mapping from the spec's tables
- **Data reference resolution** — each reference type, error cases, concurrency
- **Step handlers** — each handler with various input shapes
- **Merge algorithm** — conflict detection, version intersection, file collisions
- **Validation** — schema conformance, human-friendly error messages

### Future: Compliance Test Suite

A shared test suite that runs identical blueprint fixtures against both the PHP
and TS runners. This will be developed separately and can validate spec
conformance across implementations. The per-handler tests here are designed to
be extractable into that shared suite.

## Error Handling

Per the spec:

- Validation failures stop execution with human-friendly messages
- Step failures stop execution and report which step failed
- Failed blueprints do NOT clean up — the site remains for debugging
- Optional steps (via `onError: 'skip-plugin'`) log warnings but continue

Error types:

- `InvalidBlueprintError` — schema validation failure
- `BlueprintStepExecutionError` — step runtime failure (includes step index and name)
- `DataReferenceResolutionError` — failed download, missing file, etc.
- `BlueprintMergeConflictError` — composition conflict

## Progress Tracking

Uses `ProgressTracker` from `@php-wasm/progress` (same as V1). Each step gets
a weight based on expected cost (plugin installs weighted higher than
`defineConstants`). Captions update as steps execute. The existing integration
points already expect progress events.
