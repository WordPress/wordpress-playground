# Blueprints V2 TypeScript Runner Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the PHP `.phar`-based Blueprints V2 runner in WordPress Playground with a native TypeScript implementation that has full spec parity.

**Architecture:** The V2 TS runner follows the spec's pipeline: parse → validate → transpile declarative props to steps → resolve data references → execute steps sequentially against UniversalPHP. It lives in `packages/playground/blueprints/src/lib/v2/` alongside the existing schema types, replacing the PHP wrapper files.

**Tech Stack:** TypeScript, Vitest, AJV (JSON schema validation), `@php-wasm/universal` (UniversalPHP interface), `@php-wasm/progress` (ProgressTracker), `@php-wasm/util` (path utilities, Semaphore)

**Worktree:** `.worktrees/blueprints-v2-ts-runner` (branch: `feature/blueprints-v2-ts-runner`)

**Reference docs:**

- Design: `docs/plans/2026-03-30-blueprints-v2-ts-runner-design.md`
- V2 Spec: https://github.com/Automattic/WordPress-extension-proposals/tree/trunk/wep-1-blueprint-v2-schema
- PHP Runner: https://github.com/WordPress/php-toolkit/tree/trunk/components/Blueprints
- V1 Implementation (pattern reference): `packages/playground/blueprints/src/lib/v1/`

---

## Phase 1: Foundation — Types, Module Structure, Exports

### Task 1: Create V2 type definitions

**Files:**

- Create: `packages/playground/blueprints/src/lib/v2/types.ts`

**Context:** This file defines the core interfaces for the compiled blueprint, step handlers, and execution context. Follow the pattern from V1's `compile.ts` lines 46-143 but adapted for V2's schema.

**Step 1: Create the types file**

```typescript
import type { UniversalPHP } from '@php-wasm/universal';
import type { ProgressTracker } from '@php-wasm/progress';
import type { Semaphore } from '@php-wasm/util';

// Re-export the V2 schema types as the declaration type
import type { Blueprint as BlueprintV2Schema } from './wep-1-blueprint-v2-schema/appendix-A-blueprint-v2-schema';

export type BlueprintV2Declaration = BlueprintV2Schema;

/**
 * Result of compiling a V2 blueprint. Contains resolved
 * runtime configuration and an executable run() function.
 */
export interface CompiledBlueprintV2 {
	runtimeConfig: V2RuntimeConfig;
	steps: CompiledV2Step[];
	run: (playground: UniversalPHP) => Promise<void>;
}

export interface V2RuntimeConfig {
	phpVersion?: string | V2VersionConstraint;
	wordpressVersion?: string | V2VersionConstraint;
	applicationOptions?: {
		'wordpress-playground'?: {
			landingPage?: string;
			login?: boolean | { username: string; password: string };
			networkAccess?: boolean;
		};
	};
}

export interface V2VersionConstraint {
	min?: string;
	max?: string;
	preferred?: string;
}

export interface CompiledV2Step {
	step: string;
	args: Record<string, unknown>;
	progress?: { weight?: number; caption?: string };
}

/**
 * Context passed to every step handler during execution.
 */
export interface StepExecutionContext {
	progress: ProgressTracker;
	resolver: DataReferenceResolver;
}

/**
 * Interface for the data reference resolver. Steps use this
 * to resolve DataReferences into concrete file/directory content.
 */
export interface DataReferenceResolver {
	resolveFile(ref: unknown): Promise<ResolvedFile>;
	resolveDirectory(ref: unknown): Promise<ResolvedDirectory>;
}

export interface ResolvedFile {
	name: string;
	contents: Uint8Array;
}

export interface ResolvedDirectory {
	name: string;
	files: Record<string, Uint8Array | ResolvedDirectory>;
}

/**
 * Signature for all V2 step handlers.
 */
export type V2StepHandler<TArgs = Record<string, unknown>> = (playground: UniversalPHP, args: TArgs, context: StepExecutionContext) => Promise<void>;

/**
 * Options for compileBlueprintV2().
 */
export interface CompileBlueprintV2Options {
	progress?: ProgressTracker;
	semaphore?: Semaphore;
	corsProxy?: string;
	executionContext?: ReadableFilesystemBackend;
	onStepCompleted?: (step: string, index: number) => void;
}

/**
 * Error thrown when a blueprint fails schema validation.
 */
export class InvalidBlueprintV2Error extends Error {
	constructor(
		message: string,
		public validationErrors?: unknown[]
	) {
		super(message);
		this.name = 'InvalidBlueprintV2Error';
	}
}

/**
 * Error thrown when a step fails during execution.
 */
export class BlueprintV2StepExecutionError extends Error {
	constructor(
		message: string,
		public stepIndex: number,
		public stepName: string,
		public cause?: Error
	) {
		super(message);
		this.name = 'BlueprintV2StepExecutionError';
	}
}

/**
 * Error thrown when a data reference cannot be resolved.
 */
export class DataReferenceResolutionError extends Error {
	constructor(
		message: string,
		public reference: unknown
	) {
		super(message);
		this.name = 'DataReferenceResolutionError';
	}
}

/**
 * Error thrown when blueprint merging finds a conflict.
 */
export class BlueprintMergeConflictError extends Error {
	constructor(
		message: string,
		public conflicts: string[]
	) {
		super(message);
		this.name = 'BlueprintMergeConflictError';
	}
}
```

Note: The `ReadableFilesystemBackend` type is imported from `@php-wasm/universal`. The V2 schema types from `wep-1-blueprint-v2-schema/` are TypeScript-only type declarations (not runtime values), so the import may need to be adjusted based on how those files are currently set up. Check whether those appendix files are importable as modules or just reference documentation. If they aren't importable, define the necessary V2 schema types inline in this file.

**Step 2: Commit**

```bash
git add packages/playground/blueprints/src/lib/v2/types.ts
git commit -m "feat(blueprints): add V2 TypeScript runner type definitions"
```

---

### Task 2: Create the step handler registry

**Files:**

- Create: `packages/playground/blueprints/src/lib/v2/steps/index.ts`

**Context:** This is a registry mapping step names to their handler functions. Follow the pattern from V1's `steps/handlers.ts` but simpler — just a plain object mapping.

**Step 1: Create the registry skeleton**

```typescript
import type { V2StepHandler } from '../types';

/**
 * Registry of all V2 step handlers, keyed by step name.
 * Handlers are added as they are implemented.
 */
export const v2StepHandlers: Record<string, V2StepHandler> = {};

/**
 * Register a step handler. Called by each step module.
 */
export function registerV2StepHandler(stepName: string, handler: V2StepHandler): void {
	v2StepHandlers[stepName] = handler;
}
```

**Step 2: Commit**

```bash
git add packages/playground/blueprints/src/lib/v2/steps/index.ts
git commit -m "feat(blueprints): add V2 step handler registry"
```

---

### Task 3: Create the compilation pipeline skeleton

**Files:**

- Create: `packages/playground/blueprints/src/lib/v2/compile/compile.ts`

**Context:** This is the main entry point for V2 blueprint compilation. It orchestrates validation, declarative-to-step transpilation, and returns a `CompiledBlueprintV2`. The `run()` function on the returned object handles data reference resolution and step execution.

**Step 1: Create the compile skeleton**

```typescript
import type { UniversalPHP } from '@php-wasm/universal';
import type { ProgressTracker } from '@php-wasm/progress';
import type { BlueprintV2Declaration, CompiledBlueprintV2, CompiledV2Step, CompileBlueprintV2Options, V2RuntimeConfig, InvalidBlueprintV2Error, BlueprintV2StepExecutionError, StepExecutionContext } from '../types';
import { v2StepHandlers } from '../steps/index';

/**
 * Compiles a V2 blueprint declaration into an executable form.
 *
 * This is the main entry point for V2 blueprint processing.
 * It validates the blueprint, extracts runtime configuration,
 * transpiles declarative properties into ordered steps, and
 * returns an object whose run() method executes the blueprint.
 */
export async function compileBlueprintV2(blueprint: BlueprintV2Declaration, options: CompileBlueprintV2Options = {}): Promise<CompiledBlueprintV2> {
	// TODO: Task 6 — validate against JSON schema
	// TODO: Task 7 — detect V1 and transpile to V2

	const runtimeConfig = extractRuntimeConfig(blueprint);
	const steps = transpileDeclarativeToSteps(blueprint);

	return {
		runtimeConfig,
		steps,
		run: async (playground: UniversalPHP) => {
			await executeSteps(playground, steps, options);
		},
	};
}

function extractRuntimeConfig(blueprint: BlueprintV2Declaration): V2RuntimeConfig {
	// TODO: Task 5 — implement runtime config extraction
	return {};
}

function transpileDeclarativeToSteps(blueprint: BlueprintV2Declaration): CompiledV2Step[] {
	// TODO: Task 8 — implement declarative-to-step transpilation
	return [];
}

async function executeSteps(playground: UniversalPHP, steps: CompiledV2Step[], options: CompileBlueprintV2Options): Promise<void> {
	// TODO: Task 9 — implement step execution loop
}
```

**Step 2: Commit**

```bash
git add packages/playground/blueprints/src/lib/v2/compile/compile.ts
git commit -m "feat(blueprints): add V2 compilation pipeline skeleton"
```

---

### Task 4: Create the V2 module index and update package exports

**Files:**

- Create: `packages/playground/blueprints/src/lib/v2/index.ts`
- Modify: `packages/playground/blueprints/src/index.ts`

**Context:** The V2 module needs its own barrel export, and the package's main index.ts needs updated exports that expose the new compile/run API alongside the existing V2 type exports.

**Step 1: Create the V2 barrel export**

```typescript
// V2 types
export type { BlueprintV2Declaration, CompiledBlueprintV2, CompiledV2Step, CompileBlueprintV2Options, V2RuntimeConfig, V2VersionConstraint, V2StepHandler, StepExecutionContext, DataReferenceResolver, ResolvedFile, ResolvedDirectory } from './types';

export { InvalidBlueprintV2Error, BlueprintV2StepExecutionError, DataReferenceResolutionError, BlueprintMergeConflictError } from './types';

// V2 compilation
export { compileBlueprintV2 } from './compile/compile';

// V2 step handlers (for extensibility)
export { v2StepHandlers, registerV2StepHandler } from './steps/index';
```

**Step 2: Update the main package exports**

In `packages/playground/blueprints/src/index.ts`, find the existing V2 exports section (around lines 63-71) and replace it. Keep the existing type exports that consumers may depend on, but add the new compile/run API.

Look for this block:

```typescript
export type { BlueprintV2, BlueprintV2Declaration, RawBlueprintV2Data, ParsedBlueprintV1orV2String as ParsedBlueprintV2String } from './lib/v2/blueprint-v2-declaration';
export { getV2Runner } from './lib/v2/get-v2-runner';
export { runBlueprintV2 } from './lib/v2/run-blueprint-v2';
export type { BlueprintMessage } from './lib/v2/run-blueprint-v2';
```

Replace with:

```typescript
// V2 Blueprint types (keep existing type exports for now)
export type { BlueprintV2, BlueprintV2Declaration as BlueprintV2DeclarationLegacy, RawBlueprintV2Data, ParsedBlueprintV1orV2String as ParsedBlueprintV2String } from './lib/v2/blueprint-v2-declaration';

// V2 TypeScript runner (new)
export { compileBlueprintV2, InvalidBlueprintV2Error, BlueprintV2StepExecutionError, DataReferenceResolutionError, BlueprintMergeConflictError } from './lib/v2/index';

export type { CompiledBlueprintV2, CompileBlueprintV2Options, V2RuntimeConfig } from './lib/v2/index';

// Legacy V2 PHP runner exports (to be removed in cleanup phase)
export { getV2Runner } from './lib/v2/get-v2-runner';
export { runBlueprintV2 } from './lib/v2/run-blueprint-v2';
export type { BlueprintMessage } from './lib/v2/run-blueprint-v2';
```

**Step 3: Verify the package builds**

```bash
cd .worktrees/blueprints-v2-ts-runner
npx nx build playground-blueprints
```

Expected: Build succeeds (the skeleton code has no runtime dependencies yet that would break).

If the build fails due to the V2 schema types not being importable, adjust `types.ts` to define the schema types inline instead of importing from the appendix files.

**Step 4: Commit**

```bash
git add packages/playground/blueprints/src/lib/v2/index.ts packages/playground/blueprints/src/index.ts
git commit -m "feat(blueprints): add V2 module barrel export and update package exports"
```

---

## Phase 2: Data Reference Resolver

### Task 5: Implement the data reference resolver

**Files:**

- Create: `packages/playground/blueprints/src/lib/v2/data-references/types.ts`
- Create: `packages/playground/blueprints/src/lib/v2/data-references/resolver.ts`
- Create: `packages/playground/blueprints/src/lib/v2/data-references/resolver.spec.ts`

**Context:** V2 data references are simpler than V1 resources. A reference is either a URL string, an execution context path, an inline file/directory object, a git path object, or a contextual slug. The resolver converts these into concrete bytes.

Refer to the V2 spec's Appendix B (`wep-1-blueprint-v2-schema/appendix-B-data-sources.ts`) for the exact type definitions.

**Step 1: Create data reference types**

```typescript
/**
 * V2 Data Reference types — mirrors Appendix B of the V2 spec.
 */

export type URLReference = `http://${string}` | `https://${string}`;
export type ExecutionContextPath = `/${string}` | `./${string}`;

export interface InlineFile {
	filename: string;
	content: string;
}

export interface InlineDirectory {
	directoryName: string;
	files: Record<string, string | InlineDirectory>;
}

export interface GitPath {
	gitRepository: URLReference;
	ref?: string;
	pathInRepository?: string;
}

/**
 * Union of all general data reference types.
 */
export type DataReference = URLReference | ExecutionContextPath | InlineFile | InlineDirectory | GitPath;

/**
 * Slug-based references for plugins and themes.
 * E.g., "jetpack" or "jetpack@6.4.3"
 */
export type PluginDirectoryReference = string;
export type ThemeDirectoryReference = string;

/**
 * Resolved file — the output of resolving a DataReference.
 */
export interface ResolvedFile {
	name: string;
	contents: Uint8Array;
}

/**
 * Resolved directory — tree of resolved files.
 */
export interface ResolvedDirectory {
	name: string;
	files: Record<string, Uint8Array | ResolvedDirectory>;
}

/**
 * Configuration for the resolver.
 */
export interface DataReferenceResolverConfig {
	semaphore?: import('@php-wasm/util').Semaphore;
	corsProxy?: string;
	executionContext?: import('@php-wasm/universal').ReadableFilesystemBackend;
	gitAdditionalHeadersCallback?: (url: string) => Record<string, string>;
}
```

**Step 2: Write failing tests for the resolver**

Create `resolver.spec.ts` with tests for each reference type:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DataReferenceResolverImpl } from './resolver';
import type { ResolvedFile, InlineFile, InlineDirectory } from './types';

describe('DataReferenceResolverImpl', () => {
	let resolver: DataReferenceResolverImpl;

	beforeEach(() => {
		resolver = new DataReferenceResolverImpl({});
	});

	describe('resolveFile', () => {
		it('should resolve an inline file', async () => {
			const ref: InlineFile = {
				filename: 'hello.php',
				content: '<?php echo "Hello";',
			};
			const resolved = await resolver.resolveFile(ref);
			expect(resolved.name).toBe('hello.php');
			expect(new TextDecoder().decode(resolved.contents)).toBe('<?php echo "Hello";');
		});

		it('should resolve a URL reference', async () => {
			// Mock fetch for URL resolution
			global.fetch = vi.fn().mockResolvedValue({
				ok: true,
				arrayBuffer: () => Promise.resolve(new TextEncoder().encode('file contents').buffer),
				headers: new Headers(),
			});

			const resolved = await resolver.resolveFile('https://example.com/plugin.zip');
			expect(resolved.name).toBe('plugin.zip');
			expect(resolved.contents).toBeInstanceOf(Uint8Array);
		});

		it('should resolve a WordPress.org plugin slug', async () => {
			global.fetch = vi.fn().mockResolvedValue({
				ok: true,
				arrayBuffer: () => Promise.resolve(new TextEncoder().encode('zip data').buffer),
				headers: new Headers(),
			});

			const resolved = await resolver.resolvePluginReference('jetpack');
			expect(resolved.name).toBe('jetpack.zip');
			expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('downloads.wordpress.org/plugin/jetpack'), expect.anything());
		});

		it('should resolve a versioned plugin slug', async () => {
			global.fetch = vi.fn().mockResolvedValue({
				ok: true,
				arrayBuffer: () => Promise.resolve(new TextEncoder().encode('zip data').buffer),
				headers: new Headers(),
			});

			const resolved = await resolver.resolvePluginReference('akismet@6.4.3');
			expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('downloads.wordpress.org/plugin/akismet.6.4.3.zip'), expect.anything());
		});

		it('should throw on failed URL fetch', async () => {
			global.fetch = vi.fn().mockResolvedValue({
				ok: false,
				status: 404,
				statusText: 'Not Found',
			});

			await expect(resolver.resolveFile('https://example.com/missing.zip')).rejects.toThrow('DataReferenceResolutionError');
		});
	});

	describe('resolveDirectory', () => {
		it('should resolve an inline directory', async () => {
			const ref: InlineDirectory = {
				directoryName: 'my-plugin',
				files: {
					'index.php': '<?php echo "Hello";',
					lib: {
						directoryName: 'lib',
						files: {
							'utils.php': '<?php function util() {}',
						},
					},
				},
			};

			const resolved = await resolver.resolveDirectory(ref);
			expect(resolved.name).toBe('my-plugin');
			expect(resolved.files['index.php']).toBeInstanceOf(Uint8Array);
		});
	});
});
```

**Step 3: Run tests to verify they fail**

```bash
cd .worktrees/blueprints-v2-ts-runner
npx nx test playground-blueprints --testFile=resolver.spec.ts
```

Expected: FAIL (resolver module doesn't exist yet)

**Step 4: Implement the resolver**

Create `resolver.ts`:

```typescript
import { Semaphore } from '@php-wasm/util';
import { DataReferenceResolutionError } from '../types';
import type { DataReference, DataReferenceResolverConfig, InlineFile, InlineDirectory, GitPath, ResolvedFile, ResolvedDirectory, URLReference } from './types';

const textEncoder = new TextEncoder();

/**
 * Resolves V2 data references into concrete file/directory
 * content. Handles URLs, inline files, execution context paths,
 * WordPress.org slugs, and git paths.
 */
export class DataReferenceResolverImpl {
	private semaphore: Semaphore;
	private corsProxy?: string;
	private executionContext?: any;

	constructor(config: DataReferenceResolverConfig) {
		this.semaphore = config.semaphore ?? new Semaphore({ concurrency: 3 });
		this.corsProxy = config.corsProxy;
		this.executionContext = config.executionContext;
	}

	async resolveFile(ref: unknown): Promise<ResolvedFile> {
		if (isInlineFile(ref)) {
			return {
				name: ref.filename,
				contents: textEncoder.encode(ref.content),
			};
		}

		if (typeof ref === 'string') {
			if (isUrlReference(ref)) {
				return this.fetchUrl(ref);
			}

			if (isExecutionContextPath(ref)) {
				return this.resolveExecutionContextPath(ref);
			}
		}

		if (isGitPath(ref)) {
			return this.resolveGitPath(ref);
		}

		throw new DataReferenceResolutionError(`Cannot resolve data reference: ${JSON.stringify(ref)}`, ref);
	}

	async resolveDirectory(ref: unknown): Promise<ResolvedDirectory> {
		if (isInlineDirectory(ref)) {
			return this.resolveInlineDirectory(ref);
		}

		if (typeof ref === 'string' && isExecutionContextPath(ref)) {
			return this.resolveExecutionContextDirectoryPath(ref);
		}

		if (isGitPath(ref)) {
			return this.resolveGitDirectoryPath(ref);
		}

		throw new DataReferenceResolutionError(`Cannot resolve directory reference: ${JSON.stringify(ref)}`, ref);
	}

	async resolvePluginReference(slug: string): Promise<ResolvedFile> {
		const { name, version } = parseSlugWithVersion(slug);
		const versionSuffix = version ? `.${version}` : '';
		const url = `https://downloads.wordpress.org/plugin/` + `${name}${versionSuffix}.zip`;
		return this.fetchUrl(url, `${name}.zip`);
	}

	async resolveThemeReference(slug: string): Promise<ResolvedFile> {
		const { name, version } = parseSlugWithVersion(slug);
		const versionSuffix = version ? `.${version}` : '';
		const url = `https://downloads.wordpress.org/theme/` + `${name}${versionSuffix}.zip`;
		return this.fetchUrl(url, `${name}.zip`);
	}

	private async fetchUrl(url: string, filename?: string): Promise<ResolvedFile> {
		const effectiveUrl = this.corsProxy ? `${this.corsProxy}${url}` : url;

		return this.semaphore.run(async () => {
			const response = await fetch(effectiveUrl, {
				redirect: 'follow',
			});

			if (!response.ok) {
				throw new DataReferenceResolutionError(`Failed to fetch ${url}: ` + `${response.status} ${response.statusText}`, url);
			}

			const buffer = await response.arrayBuffer();
			const name = filename ?? url.split('/').pop() ?? 'downloaded-file';

			return {
				name,
				contents: new Uint8Array(buffer),
			};
		});
	}

	private async resolveExecutionContextPath(path: string): Promise<ResolvedFile> {
		if (!this.executionContext) {
			throw new DataReferenceResolutionError(`Cannot resolve execution context path "${path}": ` + `no execution context provided`, path);
		}

		const normalizedPath = normalizePath(path);
		const contents = await this.executionContext.readFileAsBuffer(normalizedPath);
		const name = normalizedPath.split('/').pop() ?? 'file';

		return { name, contents: new Uint8Array(contents) };
	}

	private async resolveExecutionContextDirectoryPath(path: string): Promise<ResolvedDirectory> {
		if (!this.executionContext) {
			throw new DataReferenceResolutionError(`Cannot resolve execution context path "${path}": ` + `no execution context provided`, path);
		}

		// Read directory listing and build tree
		const normalizedPath = normalizePath(path);
		const name = normalizedPath.split('/').pop() ?? 'directory';
		return this.readDirectoryFromContext(normalizedPath, name);
	}

	private async readDirectoryFromContext(path: string, name: string): Promise<ResolvedDirectory> {
		const listing = await this.executionContext.listFiles(path);
		const files: Record<string, Uint8Array | ResolvedDirectory> = {};

		for (const entry of listing) {
			const entryPath = `${path}/${entry}`;
			try {
				const contents = await this.executionContext.readFileAsBuffer(entryPath);
				files[entry] = new Uint8Array(contents);
			} catch {
				// If reading as file fails, try as directory
				files[entry] = await this.readDirectoryFromContext(entryPath, entry);
			}
		}

		return { name, files };
	}

	private resolveInlineDirectory(ref: InlineDirectory): ResolvedDirectory {
		const files: Record<string, Uint8Array | ResolvedDirectory> = {};

		for (const [key, value] of Object.entries(ref.files)) {
			if (typeof value === 'string') {
				files[key] = textEncoder.encode(value);
			} else {
				files[key] = this.resolveInlineDirectory(value);
			}
		}

		return { name: ref.directoryName, files };
	}

	private async resolveGitPath(ref: GitPath): Promise<ResolvedFile> {
		// Git paths are resolved by fetching the repository archive
		// This is a simplified implementation — full git clone
		// support can be added later via @wp-playground/storage
		const archiveUrl = buildGitArchiveUrl(ref.gitRepository, ref.ref);
		return this.fetchUrl(archiveUrl);
	}

	private async resolveGitDirectoryPath(ref: GitPath): Promise<ResolvedDirectory> {
		// For git directories, we fetch as an archive and extract
		// the specified path. Full implementation deferred.
		throw new DataReferenceResolutionError('Git directory references are not yet implemented', ref);
	}
}

// --- Helper functions ---

function isInlineFile(ref: unknown): ref is InlineFile {
	return typeof ref === 'object' && ref !== null && 'filename' in ref && 'content' in ref;
}

function isInlineDirectory(ref: unknown): ref is InlineDirectory {
	return typeof ref === 'object' && ref !== null && 'directoryName' in ref && 'files' in ref;
}

function isUrlReference(ref: string): ref is URLReference {
	return ref.startsWith('http://') || ref.startsWith('https://');
}

function isExecutionContextPath(ref: string): boolean {
	return ref.startsWith('./') || ref.startsWith('/');
}

function isGitPath(ref: unknown): ref is GitPath {
	return typeof ref === 'object' && ref !== null && 'gitRepository' in ref;
}

/**
 * Parse a slug that may include a version suffix.
 * E.g., "jetpack@6.4.3" → { name: "jetpack", version: "6.4.3" }
 */
function parseSlugWithVersion(slug: string): {
	name: string;
	version?: string;
} {
	const atIndex = slug.indexOf('@');
	if (atIndex === -1) {
		return { name: slug };
	}
	return {
		name: slug.substring(0, atIndex),
		version: slug.substring(atIndex + 1),
	};
}

/**
 * Normalize an execution context path by resolving "./"
 * and preventing "../" escapes.
 */
function normalizePath(path: string): string {
	// Strip leading ./ — both ./ and / are relative to context root
	let normalized = path.replace(/^\.\//, '/');
	if (!normalized.startsWith('/')) {
		normalized = '/' + normalized;
	}

	// Prevent path traversal
	const segments = normalized.split('/').filter(Boolean);
	const resolved: string[] = [];
	for (const segment of segments) {
		if (segment === '..') {
			// Per spec: cannot escape execution context
			continue;
		}
		if (segment !== '.') {
			resolved.push(segment);
		}
	}

	return '/' + resolved.join('/');
}

function buildGitArchiveUrl(repoUrl: string, ref?: string): string {
	// Convert GitHub repo URLs to archive download URLs
	const githubMatch = repoUrl.match(/github\.com\/([^/]+)\/([^/]+?)(\.git)?$/);
	if (githubMatch) {
		const [, owner, repo] = githubMatch;
		const branch = ref ?? 'HEAD';
		return `https://github.com/${owner}/${repo}/archive/${branch}.zip`;
	}

	// For non-GitHub repos, attempt a generic archive URL
	const branch = ref ?? 'HEAD';
	return `${repoUrl}/archive/${branch}.zip`;
}

export { isInlineFile, isInlineDirectory, isUrlReference, isExecutionContextPath, isGitPath, parseSlugWithVersion, normalizePath };
```

**Step 5: Run tests to verify they pass**

```bash
npx nx test playground-blueprints --testFile=resolver.spec.ts
```

Expected: All tests pass.

**Step 6: Commit**

```bash
git add packages/playground/blueprints/src/lib/v2/data-references/
git commit -m "feat(blueprints): implement V2 data reference resolver"
```

---

## Phase 3: Compilation Pipeline

### Task 6: Implement schema validation

**Files:**

- Create: `packages/playground/blueprints/src/lib/v2/compile/validate.ts`
- Create: `packages/playground/blueprints/src/lib/v2/compile/validate.spec.ts`

**Context:** Validate a blueprint object against the V2 JSON schema using AJV. The package already depends on AJV for V1 validation — check `package.json` for the exact version. Follow the same validation approach as V1 (see `packages/playground/blueprints/src/lib/v1/compile.ts` around line 200 where `validateBlueprint()` is called).

For the initial implementation, write a structural validator that checks the key properties and types without a full JSON schema. A full AJV-based JSON schema can be generated from the TypeScript types later (same as V1 does with its build step `build:blueprint-schema`).

**Step 1: Write failing tests**

```typescript
import { describe, it, expect } from 'vitest';
import { validateBlueprintV2 } from './validate';

describe('validateBlueprintV2', () => {
	it('should accept a valid minimal V2 blueprint', () => {
		const result = validateBlueprintV2({ version: 2 });
		expect(result.valid).toBe(true);
	});

	it('should reject a blueprint without version: 2', () => {
		const result = validateBlueprintV2({} as any);
		expect(result.valid).toBe(false);
	});

	it('should reject a blueprint with wrong version', () => {
		const result = validateBlueprintV2({ version: 1 } as any);
		expect(result.valid).toBe(false);
	});

	it('should accept a blueprint with plugins', () => {
		const result = validateBlueprintV2({
			version: 2,
			plugins: ['jetpack', 'akismet'],
		});
		expect(result.valid).toBe(true);
	});

	it('should accept a blueprint with all declarative properties', () => {
		const result = validateBlueprintV2({
			version: 2,
			wordpressVersion: '6.6',
			phpVersion: '8.1',
			plugins: ['jetpack'],
			themes: ['twentytwentyfour'],
			activeTheme: 'twentytwentyfour',
			constants: { WP_DEBUG: true },
			siteOptions: { blogname: 'Test Site' },
			siteLanguage: 'en_US',
		});
		expect(result.valid).toBe(true);
	});

	it('should provide human-friendly error messages', () => {
		const result = validateBlueprintV2({
			version: 2,
			additionalStepsAfterExecution: [{ step: 'intallPlugi' }],
		} as any);
		// Should suggest correct step name
		if (!result.valid) {
			expect(result.errors[0]).toContain('installPlugin');
		}
	});
});
```

**Step 2: Run tests, verify failure**

```bash
npx nx test playground-blueprints --testFile=validate.spec.ts
```

**Step 3: Implement the validator**

Write `validate.ts` with structural validation. Check `version: 2` is present, validate known property types, and for `additionalStepsAfterExecution`, validate step names against the known set with fuzzy matching for error messages.

**Step 4: Run tests, verify pass**

**Step 5: Commit**

```bash
git add packages/playground/blueprints/src/lib/v2/compile/validate.ts packages/playground/blueprints/src/lib/v2/compile/validate.spec.ts
git commit -m "feat(blueprints): implement V2 blueprint validation"
```

---

### Task 7: Implement runtime configuration extraction

**Files:**

- Modify: `packages/playground/blueprints/src/lib/v2/compile/compile.ts`
- Create: `packages/playground/blueprints/src/lib/v2/compile/compile.spec.ts`

**Context:** Extract `phpVersion`, `wordpressVersion`, and `applicationOptions` from the blueprint into a normalized `V2RuntimeConfig`. Version constraints can be a string (`"8.1"`, `"latest"`) or an object (`{ min: "8.0", max: "8.2" }`).

**Step 1: Write failing tests**

```typescript
import { describe, it, expect } from 'vitest';
import { compileBlueprintV2 } from './compile';

describe('compileBlueprintV2 — runtime config', () => {
	it('should extract simple PHP version', async () => {
		const compiled = await compileBlueprintV2({
			version: 2,
			phpVersion: '8.1',
		} as any);
		expect(compiled.runtimeConfig.phpVersion).toBe('8.1');
	});

	it('should extract PHP version constraint', async () => {
		const compiled = await compileBlueprintV2({
			version: 2,
			phpVersion: { min: '8.0', max: '8.2' },
		} as any);
		expect(compiled.runtimeConfig.phpVersion).toEqual({
			min: '8.0',
			max: '8.2',
		});
	});

	it('should extract WordPress version', async () => {
		const compiled = await compileBlueprintV2({
			version: 2,
			wordpressVersion: '6.6',
		} as any);
		expect(compiled.runtimeConfig.wordpressVersion).toBe('6.6');
	});

	it('should extract application options', async () => {
		const compiled = await compileBlueprintV2({
			version: 2,
			applicationOptions: {
				'wordpress-playground': {
					landingPage: '/wp-admin/plugins.php',
					login: true,
					networkAccess: true,
				},
			},
		} as any);
		const opts = compiled.runtimeConfig.applicationOptions?.['wordpress-playground'];
		expect(opts?.landingPage).toBe('/wp-admin/plugins.php');
		expect(opts?.login).toBe(true);
		expect(opts?.networkAccess).toBe(true);
	});

	it('should return empty config for minimal blueprint', async () => {
		const compiled = await compileBlueprintV2({
			version: 2,
		} as any);
		expect(compiled.runtimeConfig.phpVersion).toBeUndefined();
		expect(compiled.runtimeConfig.wordpressVersion).toBeUndefined();
	});
});
```

**Step 2: Run tests, verify failure**

**Step 3: Implement `extractRuntimeConfig()` in compile.ts**

Fill in the `extractRuntimeConfig` function to read `phpVersion`, `wordpressVersion`, and `applicationOptions` from the blueprint and return them in the `V2RuntimeConfig` shape.

**Step 4: Run tests, verify pass**

**Step 5: Commit**

```bash
git add packages/playground/blueprints/src/lib/v2/compile/
git commit -m "feat(blueprints): implement V2 runtime configuration extraction"
```

---

### Task 8: Implement declarative-to-step transpilation

**Files:**

- Create: `packages/playground/blueprints/src/lib/v2/compile/transpile-declarative.ts`
- Create: `packages/playground/blueprints/src/lib/v2/compile/transpile-declarative.spec.ts`

**Context:** This is the core of the V2 compilation. Declarative properties are transpiled into ordered steps following the spec-defined order (constants → siteOptions → muPlugins → themes → activeTheme → plugins → fonts → media → siteLanguage → roles → users → postTypes → content → additionalStepsAfterExecution).

**Step 1: Write failing tests**

Test that each declarative property produces the correct step type in the correct position. Test ordering especially — this is critical for spec compliance.

```typescript
import { describe, it, expect } from 'vitest';
import { transpileDeclarativeToSteps } from './transpile-declarative';
import type { CompiledV2Step } from '../types';

describe('transpileDeclarativeToSteps', () => {
	it('should return empty array for minimal blueprint', () => {
		const steps = transpileDeclarativeToSteps({ version: 2 } as any);
		expect(steps).toEqual([]);
	});

	it('should transpile constants to defineConstants step', () => {
		const steps = transpileDeclarativeToSteps({
			version: 2,
			constants: { WP_DEBUG: true, SCRIPT_DEBUG: true },
		} as any);
		expect(steps).toHaveLength(1);
		expect(steps[0].step).toBe('defineConstants');
		expect(steps[0].args).toEqual({
			constants: { WP_DEBUG: true, SCRIPT_DEBUG: true },
		});
	});

	it('should transpile plugins to installPlugin steps', () => {
		const steps = transpileDeclarativeToSteps({
			version: 2,
			plugins: ['jetpack', 'akismet'],
		} as any);
		expect(steps).toHaveLength(2);
		expect(steps[0].step).toBe('installPlugin');
		expect(steps[0].args).toEqual({
			source: 'jetpack',
			active: true,
		});
		expect(steps[1].step).toBe('installPlugin');
		expect(steps[1].args).toEqual({
			source: 'akismet',
			active: true,
		});
	});

	it('should transpile plugin objects with active: false', () => {
		const steps = transpileDeclarativeToSteps({
			version: 2,
			plugins: [{ source: 'jetpack', active: false }],
		} as any);
		expect(steps[0].args).toMatchObject({ active: false });
	});

	it('should transpile activeTheme to installTheme + activateTheme', () => {
		const steps = transpileDeclarativeToSteps({
			version: 2,
			activeTheme: 'twentytwentyfour',
		} as any);
		expect(steps).toHaveLength(2);
		expect(steps[0].step).toBe('installTheme');
		expect(steps[1].step).toBe('activateTheme');
	});

	it('should maintain the spec-defined step order', () => {
		const steps = transpileDeclarativeToSteps({
			version: 2,
			plugins: ['jetpack'],
			constants: { WP_DEBUG: true },
			siteOptions: { blogname: 'Test' },
			siteLanguage: 'de_DE',
			activeTheme: 'twentytwentyfour',
			additionalStepsAfterExecution: [{ step: 'runPHP', code: { filename: 's.php', content: '<?php' } }],
		} as any);

		const stepOrder = steps.map((s) => s.step);
		const constantsIdx = stepOrder.indexOf('defineConstants');
		const siteOptionsIdx = stepOrder.indexOf('setSiteOptions');
		const installThemeIdx = stepOrder.indexOf('installTheme');
		const activateThemeIdx = stepOrder.indexOf('activateTheme');
		const installPluginIdx = stepOrder.indexOf('installPlugin');
		const siteLanguageIdx = stepOrder.indexOf('setSiteLanguage');
		const runPhpIdx = stepOrder.indexOf('runPHP');

		// Spec order: constants < siteOptions < themes < plugins
		//   < siteLanguage < additionalSteps
		expect(constantsIdx).toBeLessThan(siteOptionsIdx);
		expect(siteOptionsIdx).toBeLessThan(installThemeIdx);
		expect(installThemeIdx).toBeLessThan(activateThemeIdx);
		expect(activateThemeIdx).toBeLessThan(installPluginIdx);
		expect(installPluginIdx).toBeLessThan(siteLanguageIdx);
		expect(siteLanguageIdx).toBeLessThan(runPhpIdx);
	});

	it('should append additionalStepsAfterExecution at the end', () => {
		const steps = transpileDeclarativeToSteps({
			version: 2,
			plugins: ['jetpack'],
			additionalStepsAfterExecution: [
				{ step: 'runPHP', code: { filename: 's.php', content: '<?php echo 1;' } },
				{ step: 'setSiteOptions', options: { blogname: 'Final' } },
			],
		} as any);

		const lastTwo = steps.slice(-2);
		expect(lastTwo[0].step).toBe('runPHP');
		expect(lastTwo[1].step).toBe('setSiteOptions');
	});
});
```

**Step 2: Run tests, verify failure**

**Step 3: Implement `transpileDeclarativeToSteps()`**

Build the ordered step list by checking each declarative property in order and appending the corresponding steps. Each declarative property handler is a small function that returns `CompiledV2Step[]`.

**Step 4: Run tests, verify pass**

**Step 5: Commit**

```bash
git add packages/playground/blueprints/src/lib/v2/compile/transpile-declarative.ts packages/playground/blueprints/src/lib/v2/compile/transpile-declarative.spec.ts
git commit -m "feat(blueprints): implement declarative-to-step transpilation"
```

---

### Task 9: Implement the step execution loop

**Files:**

- Modify: `packages/playground/blueprints/src/lib/v2/compile/compile.ts`

**Context:** The `run()` function on `CompiledBlueprintV2` needs to execute steps sequentially. For each step: look up the handler in the registry, resolve any data references in the args, call the handler, track progress, handle errors.

**Step 1: Implement the execution loop in compile.ts**

Fill in the `executeSteps` function:

- Create a `DataReferenceResolverImpl` from options
- Create a `StepExecutionContext`
- For each step: look up handler in `v2StepHandlers`, call it, catch errors and wrap in `BlueprintV2StepExecutionError`
- Track progress: split total progress across steps by weight, update captions

**Step 2: Wire validation and transpilation into `compileBlueprintV2()`**

Replace the TODO comments with actual calls to `validateBlueprintV2()` and `transpileDeclarativeToSteps()`.

**Step 3: Commit**

```bash
git add packages/playground/blueprints/src/lib/v2/compile/compile.ts
git commit -m "feat(blueprints): implement V2 step execution loop"
```

---

## Phase 4: Step Handlers

Each task in this phase implements one or more step handlers. These can be worked on in parallel since they're independent.

### Task 10: Implement filesystem step handlers (cp, mv, mkdir, rm, rmdir)

**Files:**

- Create: `packages/playground/blueprints/src/lib/v2/steps/filesystem.ts`
- Create: `packages/playground/blueprints/src/lib/v2/steps/filesystem.spec.ts`

**Context:** These are the simplest handlers. Each operates on the Playground VFS via the `UniversalPHP` interface. Use path utilities from `@php-wasm/util` (`joinPaths`, etc.) — never ad-hoc string concatenation.

Implement handlers for: `cp`, `mv`, `mkdir`, `rm`, `rmdir`. Each reads args (paths), calls the corresponding PHP filesystem function via `playground.run()`.

Register each handler in the step registry via `registerV2StepHandler()`.

Write tests using a mock `UniversalPHP` or the real PHP runtime (follow the pattern from V1's `compile.spec.ts`).

**Commit message:** `feat(blueprints): implement V2 filesystem step handlers`

---

### Task 11: Implement defineConstants step handler

**Files:**

- Create: `packages/playground/blueprints/src/lib/v2/steps/define-constants.ts`
- Create: `packages/playground/blueprints/src/lib/v2/steps/define-constants.spec.ts`

**Context:** Writes `define()` calls to `wp-config.php`. Read the existing V1 implementation at `packages/playground/blueprints/src/lib/steps/define-wp-config-consts.ts` for reference on how to modify wp-config.php safely.

The V2 version receives `{ constants: Record<string, boolean | string | number> }`.

**Commit message:** `feat(blueprints): implement V2 defineConstants step handler`

---

### Task 12: Implement setSiteOptions step handler

**Files:**

- Create: `packages/playground/blueprints/src/lib/v2/steps/set-site-options.ts`
- Create: `packages/playground/blueprints/src/lib/v2/steps/set-site-options.spec.ts`

**Context:** Calls `update_option()` for each key-value pair via PHP. Special handling for `permalink_structure` (must flush rewrite rules). V2 supports JSON-serializable values (strings, numbers, booleans, arrays, objects).

Reference V1: `packages/playground/blueprints/src/lib/steps/set-site-options.ts`

**Commit message:** `feat(blueprints): implement V2 setSiteOptions step handler`

---

### Task 13: Implement installPlugin step handler

**Files:**

- Create: `packages/playground/blueprints/src/lib/v2/steps/install-plugin.ts`
- Create: `packages/playground/blueprints/src/lib/v2/steps/install-plugin.spec.ts`

**Context:** This is the most complex step. The `source` can be:

- A WordPress.org slug (`"jetpack"`, `"jetpack@6.4.3"`)
- A URL (`"https://example.com/plugin.zip"`)
- An execution context path (`"./wp-content/plugins/my-plugin/"`)
- An inline file or directory

Steps:

1. Resolve the source via the data reference resolver
2. Detect format (ZIP, directory, single .php file)
3. Extract/copy to `wp-content/plugins/`
4. Optionally activate via `activate_plugin()`
5. Handle `activationOptions`, `onError`, `targetDirectoryName`

Reference V1: `packages/playground/blueprints/src/lib/steps/install-plugin.ts` and `install-asset.ts`

**Commit message:** `feat(blueprints): implement V2 installPlugin step handler`

---

### Task 14: Implement activatePlugin step handler

**Files:**

- Create: `packages/playground/blueprints/src/lib/v2/steps/activate-plugin.ts`

**Context:** Calls `activate_plugin()` in PHP. Receives `pluginPath` (path to plugin entry file relative to plugins directory).

**Commit message:** `feat(blueprints): implement V2 activatePlugin step handler`

---

### Task 15: Implement installTheme and activateTheme step handlers

**Files:**

- Create: `packages/playground/blueprints/src/lib/v2/steps/install-theme.ts`
- Create: `packages/playground/blueprints/src/lib/v2/steps/activate-theme.ts`

**Context:** Similar to installPlugin but targets `wp-content/themes/`. `activateTheme` calls `switch_theme()`. Theme sources follow the same resolution logic as plugins.

**Commit message:** `feat(blueprints): implement V2 theme step handlers`

---

### Task 16: Implement writeFiles step handler

**Files:**

- Create: `packages/playground/blueprints/src/lib/v2/steps/write-files.ts`

**Context:** Receives `{ files: Record<string, DataReference> }`. For each entry, resolves the data reference and writes the result to the specified path on the VFS.

**Commit message:** `feat(blueprints): implement V2 writeFiles step handler`

---

### Task 17: Implement runPHP step handler

**Files:**

- Create: `packages/playground/blueprints/src/lib/v2/steps/run-php.ts`

**Context:** Receives `{ code: DataReference, env?: Record<string, string> }`. Resolves the code data reference to PHP source, writes it to a temp file, and executes via `playground.run()`. Set environment variables before execution if provided.

**Commit message:** `feat(blueprints): implement V2 runPHP step handler`

---

### Task 18: Implement runSQL step handler

**Files:**

- Create: `packages/playground/blueprints/src/lib/v2/steps/run-sql.ts`

**Context:** Resolves the SQL source data reference, then executes the SQL statements. Can be done via a PHP script that reads and executes the SQL file using `$wpdb`.

**Commit message:** `feat(blueprints): implement V2 runSQL step handler`

---

### Task 19: Implement wp-cli step handler

**Files:**

- Create: `packages/playground/blueprints/src/lib/v2/steps/wp-cli.ts`

**Context:** Runs a WP-CLI command string. Reference V1: `packages/playground/blueprints/src/lib/steps/wp-cli.ts`. Uses `playground.cli()` or runs PHP with WP-CLI included.

**Commit message:** `feat(blueprints): implement V2 wp-cli step handler`

---

### Task 20: Implement setSiteLanguage step handler

**Files:**

- Create: `packages/playground/blueprints/src/lib/v2/steps/set-site-language.ts`

**Context:** Sets WPLANG constant and downloads translations. Reference V1: `packages/playground/blueprints/src/lib/steps/set-site-language.ts`.

**Commit message:** `feat(blueprints): implement V2 setSiteLanguage step handler`

---

### Task 21: Implement unzip step handler

**Files:**

- Create: `packages/playground/blueprints/src/lib/v2/steps/unzip.ts`

**Context:** Resolves the zip file data reference, extracts to the specified path. Use the zip utilities already available in the codebase (check `@wp-playground/storage` or the V1 unzip step).

**Commit message:** `feat(blueprints): implement V2 unzip step handler`

---

### Task 22: Implement importContent step handler

**Files:**

- Create: `packages/playground/blueprints/src/lib/v2/steps/import-content.ts`

**Context:** Handles three content types: `mysql-dump` (execute SQL), `posts` (insert via PHP), and `wxr` (WordPress XML import). For WXR, delegate to the WordPress importer plugin via PHP. For `posts`, generate PHP code that calls `wp_insert_post()` for each post object.

This is a complex handler. For inline post objects (the `WordPressPost` type from the schema), generate PHP that serializes the post data and inserts it. For file-based sources, resolve the data reference and use the appropriate importer.

**Commit message:** `feat(blueprints): implement V2 importContent step handler`

---

### Task 23: Implement importMedia step handler

**Files:**

- Create: `packages/playground/blueprints/src/lib/v2/steps/import-media.ts`

**Context:** Uploads media files to the WordPress Media Library. Each `MediaDefinition` can be a simple data reference or an object with `source`, `title`, `description`, `alt`, `caption`. Resolve the file, write it to a temp location, then use `wp_insert_attachment()` / `wp_handle_sideload()` via PHP.

**Commit message:** `feat(blueprints): implement V2 importMedia step handler`

---

### Task 24: Implement importThemeStarterContent step handler

**Files:**

- Create: `packages/playground/blueprints/src/lib/v2/steps/import-theme-starter-content.ts`

**Context:** Triggers theme starter content import via PHP. Reference V1: `packages/playground/blueprints/src/lib/steps/import-theme-starter-content.ts`.

**Commit message:** `feat(blueprints): implement V2 importThemeStarterContent step handler`

---

## Phase 5: V1→V2 Transpilation

### Task 25: Implement V1 to V2 transpiler

**Files:**

- Create: `packages/playground/blueprints/src/lib/v2/compile/v1-to-v2-transpiler.ts`
- Create: `packages/playground/blueprints/src/lib/v2/compile/v1-to-v2-transpiler.spec.ts`

**Context:** The spec requires V2 runners to accept V1 blueprints (any blueprint without a `version` property). The transpiler converts V1 schema to V2 schema following the mapping tables in the spec's "Backwards compatibility with Blueprints v1" section.

Key mappings:

- `preferredVersions.php/wp` → `phpVersion`/`wordpressVersion`
- `landingPage`, `login`, `features.networking` → `applicationOptions['wordpress-playground']`
- `meta.*` → `blueprintMeta.*`
- `steps` → `additionalStepsAfterExecution` (with per-step rewrites)
- `plugins` (shorthand) → `additionalStepsAfterExecution[].installPlugin`
- Resource objects → V2 data references

**Step 1: Write comprehensive tests**

Test every row in the spec's mapping tables:

- Top-level property mapping (each property individually)
- Step mapping (each V1 step type → V2 equivalent)
- Resource → DataReference conversion (each resource type)
- Path translation (`/wordpress/` → docroot-relative)
- Edge cases: empty blueprint, blueprint with only steps, deprecated steps

**Step 2: Implement the transpiler**

A function `transpileV1toV2(v1: object): BlueprintV2Declaration` that:

1. Sets `version: 2`
2. Maps top-level properties
3. Rewrites each step in `steps[]`
4. Converts resource objects to data references
5. Translates `/wordpress/` paths

**Step 3: Wire into compile.ts**

In `compileBlueprintV2()`, before validation, check if the blueprint lacks a `version` property. If so, validate it as V1 (using the existing V1 schema validator), then transpile to V2.

**Commit message:** `feat(blueprints): implement V1 to V2 blueprint transpiler`

---

## Phase 6: Blueprint Composition

### Task 26: Implement blueprint merge algorithm

**Files:**

- Create: `packages/playground/blueprints/src/lib/v2/compile/merge.ts`
- Create: `packages/playground/blueprints/src/lib/v2/compile/merge.spec.ts`

**Context:** The spec's composition section defines a property-by-property merge algorithm. Implement `mergeBlueprintsV2(blueprints: BlueprintV2Declaration[]): BlueprintV2Declaration` following the spec rules:

- `version`: assert same
- `blueprintMeta`, `$schema`: ignore
- `siteLanguage`, `activeTheme`: conflict if both differ
- `constants`, `siteOptions`, `postTypes`, `fonts`: append, fail on key conflicts
- `phpVersion`, `wordpressVersion`: intersect version ranges
- `plugins`, `themes`, `muPlugins`: merge by slug
- `additionalStepsAfterExecution`, `content`, `media`: append
- `users`, `roles`: merge with conflict detection

**Step 1: Write tests for each merge rule**

**Step 2: Implement the merge function**

**Step 3: Export from the V2 module**

**Commit message:** `feat(blueprints): implement V2 blueprint merge algorithm`

---

## Phase 7: Integration

### Task 27: Update CLI integration

**Files:**

- Modify: `packages/playground/cli/src/blueprints-v2/worker-thread-v2.ts`

**Context:** Replace the call to the old `runBlueprintV2()` (which uses the PHP .phar) with the new `compileBlueprintV2()` + `compiled.run()`. The key call site is around line 346 in the `runBlueprintV2()` method of the worker thread class.

The new flow:

1. Parse the blueprint declaration (keep existing parsing logic)
2. Call `compileBlueprintV2(blueprint, { progress, ... })`
3. Extract runtime config for PHP/WP version selection
4. Call `compiled.run(php)`
5. Dispatch progress events from the progress tracker (replace the PHP message-based progress with direct TS progress tracking)

Note: The `onMessage` callback pattern for `blueprint.target_resolved`, `blueprint.progress`, `blueprint.error` should be replaced with direct progress tracker callbacks and try/catch error handling.

Also check `blueprints-v2-handler.ts` in the CLI to see if any changes are needed there.

**Step 1: Update imports**

**Step 2: Replace the runBlueprintV2 call with compile + run**

**Step 3: Test manually with the CLI**

```bash
cd .worktrees/blueprints-v2-ts-runner
npx nx dev playground-cli server --experimental-blueprints-v2-runner --blueprint='{"version":2,"plugins":["hello-dolly"]}'
```

**Commit message:** `feat(blueprints): integrate V2 TS runner into CLI`

---

### Task 28: Update website remote worker integration

**Files:**

- Modify: `packages/playground/remote/src/lib/playground-worker-endpoint-blueprints-v2.ts`

**Context:** Same pattern as CLI — replace the `runBlueprintV2()` call with `compileBlueprintV2()` + `compiled.run()`. The remote worker dispatches `blueprint.message` events for the client to consume.

Update the `boot()` method to:

1. Compile the blueprint
2. Set up progress tracking that dispatches `blueprint.message` events
3. Run the compiled blueprint
4. Dispatch completion event

**Step 1: Update imports and replace the execution call**

**Step 2: Wire progress tracking to event dispatch**

**Step 3: Test via `npm run dev` and loading a V2 blueprint in the browser**

```bash
cd .worktrees/blueprints-v2-ts-runner
npm run dev
# Then open: http://localhost:5400/?experimental-blueprints-v2-runner&blueprint={"version":2,"plugins":["hello-dolly"]}
```

**Commit message:** `feat(blueprints): integrate V2 TS runner into website remote worker`

---

### Task 29: Verify client integration (no changes expected)

**Files:**

- Read: `packages/playground/client/src/blueprints-v2-handler.ts`

**Context:** The client handler listens for `blueprint.message` events from the remote worker. Since we're keeping the same event format in Task 28, the client should work without changes. Verify this by reading the code and testing.

**Step 1: Read the client handler and verify no changes needed**

**Step 2: End-to-end test via the dev server**

**Commit message:** (no commit if no changes needed)

---

## Phase 8: Cleanup

### Task 30: Remove PHP runner files

**Files:**

- Delete: `packages/playground/blueprints/src/lib/v2/get-v2-runner.ts`
- Delete: `packages/playground/blueprints/src/lib/v2/run-blueprint-v2.ts`
- Modify: `packages/playground/blueprints/src/index.ts` (remove legacy exports)

**Context:** Now that the TS runner is integrated, remove the PHP .phar wrapper files and their exports. Also remove any `.phar` binary imports from the build pipeline.

**Step 1: Delete the PHP wrapper files**

**Step 2: Remove legacy exports from index.ts**

Remove these lines:

```typescript
export { getV2Runner } from './lib/v2/get-v2-runner';
export { runBlueprintV2 } from './lib/v2/run-blueprint-v2';
export type { BlueprintMessage } from './lib/v2/run-blueprint-v2';
```

**Step 3: Search for any other references to the deleted files**

```bash
grep -r "get-v2-runner\|run-blueprint-v2\|getV2Runner\|blueprints\.phar" packages/ --include="*.ts" --include="*.tsx" -l
```

Update or remove any remaining references.

**Step 4: Verify the package builds**

```bash
npx nx build playground-blueprints
```

**Step 5: Run all tests**

```bash
npx nx test playground-blueprints
```

**Step 6: Commit**

```bash
git add -A
git commit -m "chore(blueprints): remove PHP .phar runner files"
```

---

### Task 31: Update blueprint-v2-declaration.ts

**Files:**

- Modify: `packages/playground/blueprints/src/lib/v2/blueprint-v2-declaration.ts`

**Context:** This file has parsing utilities and type exports. Update it to use the new V2 types from `types.ts` and ensure the `parseBlueprintDeclaration()` function works with the new compilation pipeline.

**Commit message:** `refactor(blueprints): update V2 declaration parsing for TS runner`

---

### Task 32: Run full test suite and fix issues

**Files:** Various

**Context:** Run the complete test suite for the blueprints package and any dependent packages. Fix any failures.

```bash
npx nx test playground-blueprints
npx nx test playground-cli
npx nx e2e playground-website  # if feasible
```

**Commit message:** `fix(blueprints): resolve test failures from V2 TS runner integration`

---

## Task Dependency Graph

```
Phase 1 (Foundation):
  Task 1 (types)
  Task 2 (step registry) ← depends on Task 1
  Task 3 (compile skeleton) ← depends on Task 1, 2
  Task 4 (exports) ← depends on Task 1, 2, 3

Phase 2 (Data References):
  Task 5 (resolver) ← depends on Task 1

Phase 3 (Compilation):
  Task 6 (validation) ← depends on Task 3
  Task 7 (runtime config) ← depends on Task 3
  Task 8 (transpilation) ← depends on Task 3
  Task 9 (execution loop) ← depends on Task 2, 3, 5

Phase 4 (Step Handlers) — all depend on Task 2, 5:
  Tasks 10-24 can be worked in parallel

Phase 5 (V1→V2 Transpiler):
  Task 25 ← depends on Task 3, 8

Phase 6 (Composition):
  Task 26 ← depends on Task 6

Phase 7 (Integration):
  Tasks 27-29 ← depend on Phase 4 completion

Phase 8 (Cleanup):
  Tasks 30-32 ← depend on Phase 7 completion
```

**Parallelizable groups:**

- Tasks 10-24 (step handlers) — all independent
- Tasks 6, 7, 8 (compilation sub-tasks) — independent of each other
- Tasks 27, 28 (CLI + website integration) — independent of each other
