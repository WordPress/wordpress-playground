/**
 * PHP does not load an extension because a `.so` file exists. It loads an
 * extension because, during startup, PHP reads an `.ini` entry that points at
 * that file.
 *
 * In PHP.wasm that `.ini` entry cannot always be baked into the PHP build. A
 * caller may provide an extension as bytes, as a URL, or through a manifest
 * that chooses the right artifact for the active PHP version and async mode.
 * The extension may also need extra files or environment variables before PHP
 * starts.
 *
 * This module turns those inputs into a startup install plan. The runtime
 * loader resolves the `.so` bytes, stages them in the PHP virtual filesystem,
 * writes a small per-extension `.ini` file next to them, stages any sidecar
 * files, and adds the extension directory to `PHP_INI_SCAN_DIR` before PHP
 * starts.
 *
 * The startup boundary matters. This module does not load extensions into an
 * already-running PHP instance. Once PHP has started, the ini scan is over.
 * Some regular extensions can be loaded later with `dl()`, but Zend extensions
 * cannot, and extensions that depend on startup-time files or environment
 * variables are easy to initialize incorrectly. PHP.wasm therefore treats
 * extension loading as part of runtime creation.
 *
 * A Zend extension such as Xdebug becomes an `.ini` file like this:
 *
 * ```ini
 * zend_extension=/internal/shared/extensions/xdebug.so
 * xdebug.mode=debug,develop
 * xdebug.start_with_request=yes
 * xdebug.idekey="PHPSTORM"
 * ```
 *
 * A regular extension such as `intl` uses the same startup path. Its `.ini`
 * file contains the regular `extension=` directive, and its ICU data is staged
 * before startup with `ICU_DATA` pointing at that staged file:
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
 * External extensions use the same plan. A manifest is only a selector for the
 * correct `.so` artifact:
 *
 * ```json
 * {
 *   "name": "wp_mysql_parser",
 *   "artifacts": [
 *     {
 *       "phpVersion": "8.4",
 *       "asyncMode": "jspi",
 *       "file": "wp_mysql_parser-php8.4-jspi.so"
 *     }
 *   ]
 * }
 * ```
 *
 * In `@php-wasm/universal`, URL sources are resolved with the provided
 * `fetch` implementation. In `@php-wasm/node`, the runtime loader also accepts
 * local manifest paths and `file:` URLs, then normalizes them before calling
 * this resolver.
 */
import { dirname, joinPaths } from '@php-wasm/util';
import type { Emscripten } from './emscripten-types';
import { FSHelpers } from './fs-helpers';
import type { EmscriptenOptions, PHPRuntime } from './load-php-runtime';
import type { FileTree } from './write-files';

/**
 * Default VFS directory where this loader stages extension `.so` files and
 * writes their per-extension ini files.
 */
export const PHP_EXTENSIONS_DIR = '/internal/shared/extensions';

/**
 * Async mode used by the PHP.wasm build that will load the extension.
 *
 * Extension side modules must be compiled for the same mode as the main PHP
 * module.
 */
export type PHPWasmAsyncMode = 'jspi' | 'asyncify';

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
 * `resolvePHPExtensionInstallPlan()` select the artifact that matches the current PHP
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
			 * Required when `PHPExtensionInstallOptions.name` is not set.
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
			 * In `@php-wasm/universal`, string values must be absolute URLs.
			 * In `@php-wasm/node`, this may also be a filesystem path or a
			 * `file:` URL; the Node loader resolves local paths before fetching.
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
 * Options for staging a PHP extension before startup.
 */
export interface PHPExtensionInstallOptions {
	/**
	 * The extension artifact bytes, URL, or manifest.
	 */
	source: PHPExtensionSource;

	/**
	 * Extension name used for staged file names and the first ini directive.
	 *
	 * This overrides a name inferred from `source`.
	 */
	name?: string;

	/**
	 * First directive written to the per-extension ini file.
	 *
	 * Use `extension` for regular PHP extensions. Use `zend_extension` for
	 * Zend extensions such as Xdebug. Defaults to `extension`.
	 */
	loadWithIniDirective?: PHPExtensionIniDirective;

	/**
	 * Additional `key=value` lines written after the `extension=` or
	 * `zend_extension=` directive.
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
	 * VFS directory where the loader writes the extension `.so` file and its
	 * per-extension ini file. Defaults to `PHP_EXTENSIONS_DIR`.
	 */
	extensionDir?: string;

	/**
	 * Fetch implementation used for `format: 'url'`, `manifestUrl`, and
	 * manifest artifacts.
	 *
	 * Runtime loaders may provide environment-specific defaults. For example,
	 * `@php-wasm/node` provides local file support for extension manifests and
	 * artifacts.
	 */
	fetch?: typeof fetch;
}

/**
 * Options for resolving an install plan before a PHP instance exists.
 */
export type ResolvePHPExtensionInstallPlanOptions =
	PHPExtensionInstallOptions & {
		phpVersion: string;
		asyncMode: PHPWasmAsyncMode;
	};

/**
 * Inputs used to build the staged `.so` path and per-extension ini file.
 */
export interface InstallPHPExtensionFilesOptions {
	name: string;
	soBytes: Uint8Array | ArrayBuffer;
	loadWithIniDirective?: PHPExtensionIniDirective;
	iniEntries?: Record<string, string>;
	extraFiles?: PHPExtensionExtraFiles;
	env?: Record<string, string>;
	extensionDir?: string;
}

/**
 * Fully resolved files and settings needed to install one extension.
 *
 * `iniPath` and `iniContent` describe the per-extension ini file this loader
 * writes into the PHP VFS.
 */
export interface PHPExtensionInstallPlan {
	name: string;
	soPath: string;
	soBytes: Uint8Array;
	iniPath: string;
	iniContent: string;
	extraFiles?: PHPExtensionExtraFiles & { targetPath: string };
	env?: Record<string, string>;
	loadWithIniDirective: PHPExtensionIniDirective;
	extensionDir: string;
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
 * Resolves an extension source into an install plan without mutating a PHP
 * instance.
 *
 * Use this from runtime loaders that need to fetch extension bytes and compute
 * `iniPath`/`iniContent` before Emscripten initializes PHP.
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
 * and update `PHP_INI_SCAN_DIR` before PHP startup.
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
		env['PHP_INI_SCAN_DIR'] = appendPathEnv(
			env['PHP_INI_SCAN_DIR'],
			plan.extensionDir
		);
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
 * Builds the VFS paths and per-extension ini content for an extension.
 */
export function buildPHPExtensionInstallPlan(
	options: InstallPHPExtensionFilesOptions
): PHPExtensionInstallPlan {
	const extensionDir = options.extensionDir ?? PHP_EXTENSIONS_DIR;
	const name = validateExtensionName(options.name);
	const loadWithIniDirective = options.loadWithIniDirective ?? 'extension';
	const soPath = joinPaths(extensionDir, `${name}.so`);
	const iniPath = joinPaths(extensionDir, `${name}.ini`);
	const iniContent = buildIniContent({
		loadWithIniDirective,
		soPath,
		iniEntries: options.iniEntries ?? {},
	});
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
		extraFiles,
		env: options.env,
		loadWithIniDirective,
		extensionDir,
	};
}

/**
 * Installs extension files through Emscripten's synchronous filesystem API.
 *
 * Use this while the PHP runtime is initializing and only the raw Emscripten
 * `FS` object is available. This writes `plan.soBytes` to `plan.soPath` and
 * `plan.iniContent` to `plan.iniPath`.
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
		throw new Error(
			'resolvePHPExtensionInstallPlan() requires a fetch implementation.'
		);
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
		throw new Error(
			'resolvePHPExtensionInstallPlan() requires a fetch implementation.'
		);
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
			`Invalid PHP extension name ${JSON.stringify(
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

function appendPathEnv(current: string | undefined, path: string): string {
	if (!current) {
		return path;
	}
	const paths = current.split(':');
	return paths.includes(path) ? current : [...paths, path].join(':');
}

function ensureDirectorySync(fs: Emscripten.RootFS, directory: string) {
	if (!FSHelpers.fileExists(fs, directory)) {
		fs.mkdirTree(directory);
	}
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
