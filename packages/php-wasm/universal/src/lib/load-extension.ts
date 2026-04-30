/**
 * PHP.wasm extensions are Emscripten side modules. They are just `.so` files
 * until PHP is told to load them.
 *
 * In native PHP that usually happens through an ini file. The ini file says
 * which shared object to load, and may provide extension-specific settings.
 * In PHP.wasm we cannot assume that such a file already exists in the runtime
 * filesystem, because an extension may arrive as bytes, a URL, or a manifest
 * artifact after the PHP build was packaged.
 *
 * This module therefore does three things:
 *
 * 1. Resolve the extension source into `.so` bytes.
 * 2. Stage those bytes in the PHP VFS.
 * 3. Create the small ini/preload files PHP needs in order to see the module.
 *
 * When this file says "generated `.ini` file", it means a file created by
 * `buildPHPExtensionInstallPlan()`, not a file shipped by the extension
 * author. The loader derives it from `LoadPHPExtensionOptions`:
 *
 * - `name` and `extensionDir` decide the file path.
 *   Example: `/internal/shared/extensions/xdebug.ini`.
 * - `loadWithIniDirective` decides whether the first line is `extension=...`
 *   or `zend_extension=...`.
 * - `iniEntries` become the remaining `key=value` lines.
 *
 * For example, these options:
 *
 * ```ts
 * {
 *   name: 'xdebug',
 *   loadWithIniDirective: 'zend_extension',
 *   iniEntries: {
 *     'xdebug.mode': 'debug,develop',
 *     'xdebug.start_with_request': 'yes',
 *   },
 * }
 * ```
 *
 * produce this file:
 *
 * ```ini
 * ; /internal/shared/extensions/xdebug.ini
 * zend_extension=/internal/shared/extensions/xdebug.so
 * xdebug.mode=debug,develop
 * xdebug.start_with_request=yes
 * ```
 *
 * `installPHPExtensionFiles()` and `installPHPExtensionFilesSync()` write that
 * ini file into the PHP VFS next to the staged `.so` file.
 *
 * The remaining question is when PHP can read that file. There are two cases:
 *
 * 1. Startup-time
 * 2. Post-startup
 *
 * ## Startup-time loading
 *
 * If the runtime has not started yet, we can use PHP's normal extension
 * loading path. The loader stages the `.so` file and generated `.ini` file,
 * then adds the extension directory to `PHP_INI_SCAN_DIR`. When PHP starts, it
 * scans that directory and reads the generated file.
 *
 * This is required for `zend_extension` entries such as Xdebug:
 *
 * ```ini
 * zend_extension=/internal/shared/extensions/xdebug.so
 * xdebug.mode=debug,develop
 * xdebug.start_with_request=yes
 * xdebug.idekey="PHPSTORM"
 * ```
 *
 * ```sh
 * PHP_INI_SCAN_DIR=/internal/shared/extensions
 * ```
 *
 * It is also useful for regular extensions that need startup-time state. For
 * example, even though `intl` is a regular `extension`, it must be loaded
 * before PHP startup because it relies on the `ICU_DATA` environment variable:
 *
 * ```ini
 * extension=/internal/shared/extensions/intl.so
 * ```
 *
 * ```sh
 * PHP_INI_SCAN_DIR=/internal/shared/extensions
 * ICU_DATA=/internal/shared
 * ```
 *
 * ## Post-startup loading
 *
 * If PHP is already running, the startup scan is over. Writing
 * `/internal/shared/extensions/example.ini` still records the intended load
 * directive, but it will not make the current PHP process load the extension.
 *
 * Regular PHP extensions have one remaining path: `dl()`. For those
 * extensions we create a preload script in `/internal/shared/preload`; the PHP
 * wrapper requires those scripts before user code and the script calls
 * `dl('name.so')`.
 *
 * PHP's `dl()` accepts a file name rather than an absolute path. The preload
 * script therefore sets `extension_dir` to the directory where the side module
 * was staged before calling `dl()`.
 *
 * A manifest-loaded extension such as `wp_mysql_parser` can therefore be
 * installed into an already-running PHP instance with:
 *
 * ```ini
 * extension=/internal/shared/extensions/wp_mysql_parser.so
 * extension_dir=/internal/shared/extensions
 * enable_dl=On
 * ```
 *
 * ```php
 * <?php
 * ini_set('extension_dir', '/internal/shared/extensions');
 * dl('wp_mysql_parser.so');
 * ```
 *
 * Manifest URLs are URLs, not filesystem-relative paths. In Node, pass a URL
 * object such as `new URL('./manifest.json', import.meta.url)` and provide a
 * `fetch` implementation for schemes that global `fetch` does not support,
 * such as `file:`.
 */
import { dirname, joinPaths } from '@php-wasm/util';
import type { Emscripten } from './emscripten-types';
import { FSHelpers } from './fs-helpers';
import type { EmscriptenOptions, PHPRuntime } from './load-php-runtime';
import { PHP, PHP_INI_PATH } from './php';
import type { UniversalPHP } from './universal-php';
import type { FileTree } from './write-files';
import { writeFiles } from './write-files';

/**
 * Default VFS directory where PHP extension `.so` files and generated `.ini`
 * files are installed.
 */
export const PHP_EXTENSIONS_DIR = '/internal/shared/extensions';

/**
 * Default VFS directory for preload scripts that call `dl()` after PHP has
 * already started.
 */
export const PHP_EXTENSION_PRELOAD_DIR = '/internal/shared/preload';

/**
 * Async mode used by the PHP.wasm build that will load the extension.
 *
 * Extension side modules must be compiled for the same mode as the main PHP
 * module.
 */
export type PHPWasmAsyncMode = 'jspi' | 'asyncify';

/**
 * Point in the PHP lifecycle where the extension should become available.
 *
 * Use `before-php-startup` for extensions that must be present while PHP
 * starts. Use `after-php-startup` for regular extensions that can be loaded
 * with `dl()`. `auto` chooses the correct default for `extension` versus
 * `zend_extension`.
 */
export type PHPExtensionLoadTiming =
	| 'before-php-startup'
	| 'after-php-startup'
	| 'auto';

/**
 * The php.ini directive used to load the extension.
 *
 * Use `extension` for regular PHP extensions and `zend_extension` for Zend
 * extensions such as Xdebug.
 */
export type PHPExtensionIniDirective = 'extension' | 'zend_extension';

/**
 * Format of an extension source that can be resolved without an already
 * running PHP instance.
 */
export type PHPExtensionSourceFormat = 'so' | 'url' | 'manifest';

/**
 * One compiled extension artifact in a manifest.
 */
export interface PHPExtensionManifestArtifact {
	/**
	 * PHP major/minor version the artifact was compiled against, e.g. `8.4`.
	 */
	phpVersion: string;

	/**
	 * PHP.wasm async mode the artifact was compiled against.
	 */
	asyncMode: PHPWasmAsyncMode;

	/**
	 * Relative to the manifest URL/base URL, or an absolute URL.
	 */
	file: string;

	/**
	 * Optional SHA-256 checksum for the fetched `.so` artifact.
	 */
	sha256?: string;
}

/**
 * Extension artifact manifest.
 *
 * A manifest lets callers publish a matrix of `.so` files and lets
 * `loadPHPExtension()` select the artifact that matches the current PHP
 * version and async mode.
 */
export interface PHPExtensionManifest {
	name: string;
	version?: string;
	mode?: 'php-extension';
	artifacts: PHPExtensionManifestArtifact[];
}

/**
 * Source for a PHP extension `.so`.
 *
 * Use `format: 'so'` when the caller already has bytes, `format: 'url'` for a
 * direct artifact URL, and `format: 'manifest'` when the loader should select
 * the right artifact from a manifest.
 */
export type PHPExtensionSource =
	| {
			format: 'so';
			/**
			 * Required when `LoadPHPExtensionOptions.name` is not set.
			 */
			name?: string;
			bytes: Uint8Array | ArrayBuffer;
			sha256?: string;
	  }
	| {
			format: 'url';
			/**
			 * Optional extension name. If omitted, the loader infers the name
			 * from a `.so` filename in the URL.
			 */
			name?: string;
			url: string | URL;
			sha256?: string;
	  }
	| {
			format: 'manifest';
			/**
			 * URL of the extension manifest.
			 *
			 * String values must be absolute URLs, not filesystem-relative
			 * paths. In Node, use a URL object for local package assets, e.g.
			 * `new URL('./manifest.json', import.meta.url)`, and pass a
			 * `fetch` implementation that supports `file:` URLs.
			 */
			manifestUrl: string | URL;
			/**
			 * @deprecated Use `manifestUrl` instead.
			 */
			url?: string | URL;
	  }
	| {
			format: 'manifest';
			/**
			 * @deprecated Use `manifestUrl` instead.
			 */
			url: string | URL;
			manifestUrl?: string | URL;
	  }
	| {
			format: 'manifest';
			manifest: PHPExtensionManifest;
			/**
			 * Base URL used to resolve relative artifact paths in an inline
			 * manifest.
			 */
			baseUrl?: string | URL;
	  };

/**
 * Extra files to stage next to an extension.
 *
 * Use this for sidecar data files such as ICU data or native-library assets
 * that the extension expects to find at runtime.
 */
export interface PHPExtensionExtraFiles {
	/**
	 * Files are written here. Defaults to
	 * `/internal/shared/extensions/<name>-assets`.
	 */
	targetPath?: string;
	files: FileTree;
}

/**
 * Options for loading a PHP extension into an existing PHP instance.
 */
export interface LoadPHPExtensionOptions {
	/**
	 * The extension artifact bytes, URL, or manifest.
	 */
	source: PHPExtensionSource;

	/**
	 * Extension name used for generated file names and ini entries.
	 *
	 * This overrides a name inferred from `source`.
	 */
	name?: string;

	/**
	 * PHP version used to select a manifest artifact.
	 *
	 * If omitted, the loader reads it from the PHP runtime when possible.
	 */
	phpVersion?: string;

	/**
	 * PHP.wasm async mode used to select a manifest artifact.
	 *
	 * If omitted, the loader reads it from the PHP runtime when possible.
	 */
	asyncMode?: PHPWasmAsyncMode;

	/**
	 * When the extension should become available.
	 *
	 * Defaults to `auto`: regular `extension` entries load after startup with
	 * `dl()`, while `zend_extension` entries load before startup via
	 * `PHP_INI_SCAN_DIR`.
	 */
	loadTiming?: PHPExtensionLoadTiming;

	/**
	 * php.ini directive used to load the staged `.so`.
	 *
	 * Use `extension` for regular PHP extensions. Use `zend_extension` for
	 * Zend extensions such as Xdebug. Defaults to `extension`.
	 */
	loadWithIniDirective?: PHPExtensionIniDirective;

	/**
	 * Additional php.ini entries to write next to the generated extension
	 * directive, e.g. extension-specific settings.
	 */
	iniEntries?: Record<string, string>;

	/**
	 * Sidecar files to write into the PHP VFS before the extension is loaded.
	 *
	 * Use this for data files or dependency assets the extension expects at
	 * runtime.
	 */
	extraFiles?: PHPExtensionExtraFiles;

	/**
	 * Environment variables to add to the PHP runtime before the extension is
	 * loaded.
	 */
	env?: Record<string, string>;

	/**
	 * VFS directory where the extension `.so` and generated `.ini` file are
	 * staged. Defaults to `PHP_EXTENSIONS_DIR`.
	 */
	extensionDir?: string;

	/**
	 * Fetch implementation used for `format: 'url'`, `manifestUrl`, and
	 * manifest artifacts.
	 *
	 * In Node, provide this when loading `file:` URLs or any other scheme not
	 * supported by global `fetch`.
	 */
	fetch?: typeof fetch;
}

/**
 * Options for resolving an install plan before a PHP instance exists.
 */
export type ResolvePHPExtensionInstallPlanOptions = Omit<
	LoadPHPExtensionOptions,
	'phpVersion' | 'asyncMode'
> & {
	phpVersion: string;
	asyncMode: PHPWasmAsyncMode;
};

/**
 * Inputs needed to build or install extension files directly.
 */
export interface InstallPHPExtensionFilesOptions {
	name: string;
	soBytes: Uint8Array | ArrayBuffer;
	loadTiming?: PHPExtensionLoadTiming;
	loadWithIniDirective?: PHPExtensionIniDirective;
	iniEntries?: Record<string, string>;
	extraFiles?: PHPExtensionExtraFiles;
	env?: Record<string, string>;
	extensionDir?: string;
}

/**
 * Fully resolved set of files and ini entries needed to install one extension.
 */
export interface PHPExtensionInstallPlan {
	name: string;
	soPath: string;
	soBytes: Uint8Array;
	iniPath: string;
	iniContent: string;
	preloadPath?: string;
	extraFiles?: PHPExtensionExtraFiles & { targetPath: string };
	env?: Record<string, string>;
	loadTiming: Exclude<PHPExtensionLoadTiming, 'auto'>;
	loadWithIniDirective: PHPExtensionIniDirective;
	extensionDir: string;
}

/**
 * Result returned after `loadPHPExtension()` installs an extension.
 */
export interface LoadedPHPExtension {
	name: string;
	path: string;
	iniPath: string;
	preloadPath?: string;
	manifest?: PHPExtensionManifest;
	artifact?: PHPExtensionManifestArtifact;
}

/**
 * Resolved install plan plus manifest metadata, when the source was a manifest.
 */
export interface ResolvedPHPExtensionInstallPlan {
	plan: PHPExtensionInstallPlan;
	manifest?: PHPExtensionManifest;
	artifact?: PHPExtensionManifestArtifact;
}

/**
 * Extension install payload applied while the Emscripten PHP runtime starts.
 */
export interface PHPExtensionRuntimeInstall {
	plan: PHPExtensionInstallPlan;
	onInstalled?: (phpRuntime: PHPRuntime) => void;
}

interface ResolvedPHPExtensionSource {
	name: string;
	soBytes: Uint8Array;
	manifest?: PHPExtensionManifest;
	artifact?: PHPExtensionManifestArtifact;
}

/**
 * Loads a PHP extension into an already-running PHP instance.
 *
 * The loader writes the `.so`, generates an `.ini` file, stages any
 * `extraFiles`, updates `php.ini`, and creates a preload script when the
 * extension should load after PHP startup.
 *
 * @param php - PHP instance that will receive the extension files.
 * @param options - Extension source and install options.
 * @returns Metadata for the installed extension and selected manifest artifact.
 */
export async function loadPHPExtension(
	php: UniversalPHP,
	options: LoadPHPExtensionOptions
): Promise<LoadedPHPExtension> {
	const phpVersion = options.phpVersion ?? getPHPVersionFromRuntime(php);
	const asyncMode = options.asyncMode ?? getAsyncModeFromRuntime(php);
	if (!phpVersion) {
		throw new Error(
			'Could not determine the PHP version for this runtime. Pass phpVersion explicitly.'
		);
	}
	if (!asyncMode) {
		throw new Error(
			'Could not determine the PHP.wasm async mode for this runtime. Pass asyncMode explicitly.'
		);
	}

	const resolved = await resolvePHPExtensionInstallPlan({
		...options,
		phpVersion,
		asyncMode,
	});

	await installPHPExtensionFiles(php, resolved.plan);

	return {
		name: resolved.plan.name,
		path: resolved.plan.soPath,
		iniPath: resolved.plan.iniPath,
		preloadPath: resolved.plan.preloadPath,
		manifest: resolved.manifest,
		artifact: resolved.artifact,
	};
}

/**
 * Resolves an extension source into an install plan without mutating a PHP
 * instance.
 *
 * Use this from runtime loaders that need to fetch extension bytes before
 * Emscripten initializes PHP.
 */
export async function resolvePHPExtensionInstallPlan(
	options: ResolvePHPExtensionInstallPlanOptions
): Promise<ResolvedPHPExtensionInstallPlan> {
	const resolved = await resolvePHPExtensionSource(
		options,
		options.fetch ?? globalThis.fetch
	);
	const plan = buildPHPExtensionInstallPlan({
		name: options.name ?? resolved.name,
		soBytes: resolved.soBytes,
		loadTiming: options.loadTiming,
		loadWithIniDirective: options.loadWithIniDirective,
		iniEntries: options.iniEntries,
		extraFiles: options.extraFiles,
		env: options.env,
		extensionDir: options.extensionDir,
	});

	return {
		plan,
		manifest: resolved.manifest,
		artifact: resolved.artifact,
	};
}

/**
 * Appends extension install plans to Emscripten options.
 *
 * The returned options install extension files during `onRuntimeInitialized`
 * and update `PHP_INI_SCAN_DIR` before startup for extensions that require it.
 */
export function appendPHPExtensionInstallPlans(
	options: EmscriptenOptions,
	extensions: PHPExtensionRuntimeInstall[]
): EmscriptenOptions {
	if (!extensions.length) {
		return options;
	}

	const env = {
		...options.ENV,
	};

	for (const { plan } of extensions) {
		Object.assign(env, plan.env);
		if (plan.loadTiming === 'before-php-startup') {
			env['PHP_INI_SCAN_DIR'] = appendPathEnv(
				env['PHP_INI_SCAN_DIR'],
				plan.extensionDir
			);
		}
	}

	return {
		...options,
		ENV: env,
		onRuntimeInitialized: (phpRuntime: PHPRuntime) => {
			options.onRuntimeInitialized?.(phpRuntime);
			for (const { plan, onInstalled } of extensions) {
				installPHPExtensionFilesSync(phpRuntime.FS, plan);
				onInstalled?.(phpRuntime);
			}
		},
	};
}

/**
 * Builds the VFS paths, ini content, and optional preload path for an
 * extension.
 */
export function buildPHPExtensionInstallPlan(
	options: InstallPHPExtensionFilesOptions
): PHPExtensionInstallPlan {
	const extensionDir = options.extensionDir ?? PHP_EXTENSIONS_DIR;
	const name = validateExtensionName(options.name);
	const loadWithIniDirective = options.loadWithIniDirective ?? 'extension';
	const loadTiming = normalizeLoadTiming(
		options.loadTiming ?? 'auto',
		loadWithIniDirective
	);
	const soPath = joinPaths(extensionDir, `${name}.so`);
	const iniPath = joinPaths(extensionDir, `${name}.ini`);
	const iniContent = buildIniContent({
		loadWithIniDirective,
		soPath,
		iniEntries: options.iniEntries ?? {},
	});
	const preloadPath =
		loadTiming === 'after-php-startup'
			? joinPaths(PHP_EXTENSION_PRELOAD_DIR, `${name}.php`)
			: undefined;
	const extraFiles = options.extraFiles
		? {
				...options.extraFiles,
				targetPath:
					options.extraFiles.targetPath ??
					joinPaths(extensionDir, `${name}-assets`),
			}
		: undefined;

	return {
		name,
		soPath,
		soBytes: toUint8Array(options.soBytes),
		iniPath,
		iniContent,
		preloadPath,
		extraFiles,
		env: options.env,
		loadTiming,
		loadWithIniDirective,
		extensionDir,
	};
}

/**
 * Installs a resolved extension plan into an existing PHP instance.
 */
export async function installPHPExtensionFiles(
	php: UniversalPHP,
	plan: PHPExtensionInstallPlan
): Promise<void> {
	await ensureDirectory(php, plan.extensionDir);
	await php.writeFile(plan.soPath, plan.soBytes);
	await php.writeFile(plan.iniPath, plan.iniContent);

	if (plan.extraFiles) {
		await writeFiles(
			php,
			plan.extraFiles.targetPath,
			plan.extraFiles.files
		);
	}

	if (plan.env && php instanceof PHP) {
		registerRuntimeEnv(php, plan.env);
	}
	if (php instanceof PHP) {
		registerRuntimeEnv(php, {
			PHP_INI_SCAN_DIR: appendPathEnv(
				getRuntimeEnv(php)['PHP_INI_SCAN_DIR'],
				plan.extensionDir
			),
		});
	}

	await upsertPhpIniEntries(php, {
		extension_dir: plan.extensionDir,
		...(plan.loadTiming === 'after-php-startup' ? { enable_dl: 'On' } : {}),
	});

	if (plan.preloadPath) {
		await ensureDirectory(php, dirname(plan.preloadPath));
		await php.writeFile(
			plan.preloadPath,
			createExtensionPreloadScript(plan.name, plan.soPath)
		);
	}
}

/**
 * Installs extension files through Emscripten's synchronous filesystem API.
 *
 * Use this while the PHP runtime is initializing and only the raw Emscripten
 * `FS` object is available.
 */
export function installPHPExtensionFilesSync(
	fs: Emscripten.RootFS,
	options: InstallPHPExtensionFilesOptions | PHPExtensionInstallPlan
): PHPExtensionInstallPlan {
	const plan =
		'soPath' in options ? options : buildPHPExtensionInstallPlan(options);
	ensureDirectorySync(fs, plan.extensionDir);
	fs.writeFile(plan.soPath, plan.soBytes);
	fs.writeFile(plan.iniPath, plan.iniContent);
	if (plan.extraFiles) {
		writeFileTreeSync(
			fs,
			plan.extraFiles.targetPath,
			plan.extraFiles.files
		);
	}
	if (plan.preloadPath) {
		ensureDirectorySync(fs, dirname(plan.preloadPath));
		fs.writeFile(
			plan.preloadPath,
			createExtensionPreloadScript(plan.name, plan.soPath)
		);
	}
	return plan;
}

async function resolvePHPExtensionSource(
	options: ResolvePHPExtensionInstallPlanOptions,
	fetchFn: typeof fetch | undefined
): Promise<ResolvedPHPExtensionSource> {
	const source = options.source;
	if (source.format === 'so') {
		const name = options.name ?? source.name;
		if (!name) {
			throw new Error(
				'name is required when loading an extension from direct bytes.'
			);
		}
		if (source.sha256) {
			await assertSha256(source.bytes, source.sha256, name);
		}
		return { name, soBytes: toUint8Array(source.bytes) };
	}

	if (source.format === 'url') {
		const name =
			options.name ?? source.name ?? inferExtensionName(source.url);
		if (!name) {
			throw new Error(
				'name is required when loading an extension from a direct URL.'
			);
		}
		const soBytes = await fetchBytes(fetchFn, new URL(String(source.url)));
		if (source.sha256) {
			await assertSha256(soBytes, source.sha256, String(source.url));
		}
		return { name, soBytes };
	}

	const manifestUrl =
		'manifestUrl' in source && source.manifestUrl
			? new URL(String(source.manifestUrl))
			: 'url' in source
				? new URL(String(source.url))
				: undefined;
	const manifest =
		'manifest' in source
			? validateExtensionManifest(source.manifest)
			: validateExtensionManifest(await fetchJson(fetchFn, manifestUrl!));
	const baseUrl =
		'baseUrl' in source && source.baseUrl
			? new URL(String(source.baseUrl))
			: manifestUrl;
	const artifact = manifest.artifacts.find(
		(candidate) =>
			candidate.phpVersion === options.phpVersion &&
			candidate.asyncMode === options.asyncMode
	);
	if (!artifact) {
		throw new Error(
			`No extension artifact found for PHP ${options.phpVersion} ${options.asyncMode}.`
		);
	}
	if (!baseUrl) {
		throw new Error(
			'Manifest artifacts require a manifest URL or baseUrl so relative files can be resolved.'
		);
	}

	const artifactUrl = new URL(artifact.file, baseUrl);
	const soBytes = await fetchBytes(fetchFn, artifactUrl);
	if (artifact.sha256) {
		await assertSha256(soBytes, artifact.sha256, artifact.file);
	}

	return {
		name: manifest.name,
		soBytes,
		manifest,
		artifact,
	};
}

async function fetchJson(
	fetchFn: typeof fetch | undefined,
	url: URL
): Promise<unknown> {
	if (!fetchFn) {
		throw new Error('loadPHPExtension() requires a fetch implementation.');
	}
	const response = await fetchFn(url);
	if (!response.ok) {
		throw new Error(`Failed to fetch ${url}: ${response.status}`);
	}
	return await response.json();
}

async function fetchBytes(
	fetchFn: typeof fetch | undefined,
	url: URL
): Promise<Uint8Array> {
	if (!fetchFn) {
		throw new Error('loadPHPExtension() requires a fetch implementation.');
	}
	const response = await fetchFn(url);
	if (!response.ok) {
		throw new Error(`Failed to fetch ${url}: ${response.status}`);
	}
	return new Uint8Array(await response.arrayBuffer());
}

function validateExtensionManifest(candidate: unknown): PHPExtensionManifest {
	if (!candidate || typeof candidate !== 'object') {
		throw new Error('Extension manifest must be an object.');
	}
	const manifest = candidate as PHPExtensionManifest;
	if (typeof manifest.name !== 'string' || !manifest.name) {
		throw new Error('Extension manifest must include a name.');
	}
	if (!Array.isArray(manifest.artifacts)) {
		throw new Error('Extension manifest must include an artifacts array.');
	}
	for (const artifact of manifest.artifacts) {
		if (
			!artifact ||
			typeof artifact.phpVersion !== 'string' ||
			(artifact.asyncMode !== 'jspi' &&
				artifact.asyncMode !== 'asyncify') ||
			typeof artifact.file !== 'string'
		) {
			throw new Error('Extension manifest contains an invalid artifact.');
		}
	}
	return manifest;
}

function normalizeLoadTiming(
	loadTiming: PHPExtensionLoadTiming,
	loadWithIniDirective: PHPExtensionIniDirective
): Exclude<PHPExtensionLoadTiming, 'auto'> {
	if (
		loadWithIniDirective === 'zend_extension' &&
		loadTiming === 'after-php-startup'
	) {
		throw new Error('Zend extensions must load before PHP startup.');
	}
	if (loadTiming === 'auto') {
		return loadWithIniDirective === 'zend_extension'
			? 'before-php-startup'
			: 'after-php-startup';
	}
	return loadTiming;
}

function buildIniContent({
	loadWithIniDirective,
	soPath,
	iniEntries,
}: {
	loadWithIniDirective: PHPExtensionIniDirective;
	soPath: string;
	iniEntries: Record<string, string>;
}): string {
	return [
		`${loadWithIniDirective}=${soPath}`,
		...Object.entries(iniEntries).map(([key, value]) => `${key}=${value}`),
	].join('\n');
}

function validateExtensionName(name: string): string {
	if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
		throw new Error(
			`loadPHPExtension: invalid extension name ${JSON.stringify(
				name
			)}. Use only [a-zA-Z0-9_-].`
		);
	}
	return name;
}

function inferExtensionName(url: string | URL): string | undefined {
	const path = new URL(String(url), 'https://example.com').pathname;
	const file = path.split('/').pop() ?? '';
	return file.endsWith('.so') ? file.slice(0, -3) : undefined;
}

function getPHPVersionFromRuntime(php: UniversalPHP): string | undefined {
	if (!(php instanceof PHP)) {
		return undefined;
	}
	const runtime = getPHPRuntime(php);
	const version = runtime?.phpVersion;
	if (
		typeof version?.major === 'number' &&
		typeof version?.minor === 'number'
	) {
		return `${version.major}.${version.minor}`;
	}
	return undefined;
}

function getAsyncModeFromRuntime(
	php: UniversalPHP
): PHPWasmAsyncMode | undefined {
	if (!(php instanceof PHP)) {
		return undefined;
	}
	return getPHPRuntime(php).phpWasmAsyncMode;
}

function getPHPRuntime(php: PHP): {
	ENV?: Record<string, string>;
	phpVersion?: { major?: number; minor?: number };
	phpWasmAsyncMode?: PHPWasmAsyncMode;
} {
	const privateSymbol = Object.getOwnPropertySymbols(php)[0];
	if (!privateSymbol) {
		throw new Error(
			'loadPHPExtension() requires an initialized PHP runtime.'
		);
	}
	// The PHP wrapper intentionally hides the runtime. The loader only reads
	// runtime metadata needed to pick a manifest artifact.
	// @ts-ignore
	const runtime = php[privateSymbol];
	if (!runtime) {
		throw new Error(
			'loadPHPExtension() requires an initialized PHP runtime.'
		);
	}
	return runtime;
}

function getRuntimeEnv(php: PHP): Record<string, string> {
	const runtime = getPHPRuntime(php);
	runtime.ENV = runtime.ENV ?? {};
	return runtime.ENV;
}

function registerRuntimeEnv(php: PHP, env: Record<string, string>) {
	Object.assign(getRuntimeEnv(php), env);
}

function appendPathEnv(current: string | undefined, path: string): string {
	if (!current) {
		return path;
	}
	const paths = current.split(':');
	return paths.includes(path) ? current : [...paths, path].join(':');
}

async function ensureDirectory(php: UniversalPHP, directory: string) {
	if (!(await php.fileExists(directory))) {
		await php.mkdirTree(directory);
	}
}

function ensureDirectorySync(fs: Emscripten.RootFS, directory: string) {
	if (!FSHelpers.fileExists(fs, directory)) {
		fs.mkdirTree(directory);
	}
}

async function upsertPhpIniEntries(
	php: UniversalPHP,
	entries: Record<string, string>
) {
	let phpIni = await php.readFileAsText(PHP_INI_PATH);
	for (const [key, value] of Object.entries(entries)) {
		phpIni = upsertPhpIniEntry(phpIni, key, value);
	}
	await php.writeFile(PHP_INI_PATH, phpIni);
}

function upsertPhpIniEntry(phpIni: string, key: string, value: string): string {
	const entry = `${key}=${value}`;
	const pattern = new RegExp(`^\\s*${escapeRegExp(key)}\\s*=.*$`, 'm');
	if (pattern.test(phpIni)) {
		return phpIni.replace(pattern, entry);
	}
	return `${phpIni.trimEnd()}\n${entry}\n`;
}

function createExtensionPreloadScript(
	extensionName: string,
	extensionPath: string
) {
	const extensionDir = dirname(extensionPath);
	const extensionFile = `${extensionName}.so`;
	return `<?php
if (!extension_loaded(${phpStringLiteral(extensionName)})) {
	if (!function_exists('dl')) {
		throw new RuntimeException(${phpStringLiteral(
			`Cannot load PHP.wasm extension ${extensionName}: dl() is not available.`
		)});
	}
	// PHP's dl() only accepts a filename, so point extension_dir at the
	// directory where PHP.wasm staged the side module before loading it.
	ini_set('extension_dir', ${phpStringLiteral(extensionDir)});
	if (!dl(${phpStringLiteral(extensionFile)}) && !extension_loaded(${phpStringLiteral(
		extensionName
	)})) {
		throw new RuntimeException(${phpStringLiteral(
			`Failed to load PHP.wasm extension ${extensionName}.`
		)});
	}
}
`;
}

function writeFileTreeSync(
	fs: Emscripten.RootFS,
	root: string,
	files: FileTree
) {
	ensureDirectorySync(fs, root);
	for (const [relativePath, content] of Object.entries(files)) {
		const filePath = joinPaths(root, relativePath);
		ensureDirectorySync(fs, dirname(filePath));
		if (content instanceof Uint8Array || typeof content === 'string') {
			fs.writeFile(filePath, content);
		} else {
			writeFileTreeSync(fs, filePath, content);
		}
	}
}

async function assertSha256(
	bytes: Uint8Array | ArrayBuffer,
	expected: string,
	file: string
) {
	const subtle = globalThis.crypto?.subtle;
	if (!subtle) {
		throw new Error(
			`Cannot verify ${file}: crypto.subtle is not available.`
		);
	}
	const actual = bytesToHex(
		await subtle.digest('SHA-256', toUint8Array(bytes))
	);
	if (actual !== expected) {
		throw new Error(`SHA-256 mismatch for ${file}.`);
	}
}

function bytesToHex(bytes: ArrayBuffer): string {
	return Array.from(new Uint8Array(bytes))
		.map((byte) => byte.toString(16).padStart(2, '0'))
		.join('');
}

function toUint8Array(bytes: Uint8Array | ArrayBuffer): Uint8Array {
	return bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
}

function phpStringLiteral(value: string): string {
	return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
