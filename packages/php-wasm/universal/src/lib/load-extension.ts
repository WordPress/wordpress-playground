/**
 * During startup, PHP loads .so extensions that are explicitly listed in one
 * of the loaded `php.ini` files.
 *
 * PHP.wasm can be configured to run arbitrary extensions, so that `.ini`
 * configuration must be constructed dynamically. That's what this module does.
 * It fetches the `.so` bytes, stages them in the PHP virtual filesystem, writes
 * a small per-extension `.ini` file next to them, stages any sidecar files, and
 * adds the extension directory to `PHP_INI_SCAN_DIR` before PHP starts.
 *
 * This module only supports loading extensions **before** the PHP runtime
 * initialization. Once PHP has started, the ini scan is over. Technically,
 * some regular extensions can be loaded later with `dl()`, and support for
 * that could be added eventually. However, Zend extensions cannot be loaded
 * that way. Also, extensions that depend on startup-time files or environment
 * variables are easy to initialize incorrectly. PHP.wasm therefore treats
 * extension loading as part of runtime creation.
 *
 * A Zend extension such as Xdebug becomes an `.ini` file like this:
 *
 * ```ini
 * zend_extension=/internal/shared/extensions/xdebug.so
 * xdebug.mode=debug,develop
 * ```
 *
 * External extensions use the same startup path. A manifest selects the
 * correct `.so` artifact and may declare URL-backed sidecar files.
 *
 * In `@php-wasm/universal`, URL sources are resolved with the provided
 * `fetch` implementation. In `@php-wasm/node`, `loadNodeRuntime()` also
 * accepts local manifest paths and `file:` URLs, then normalizes them before
 * calling this resolver.
 */
import { dirname, joinPaths, Semaphore } from '@php-wasm/util';
import type { Emscripten } from './emscripten-types';
import { FSHelpers } from './fs-helpers';
import type { EmscriptenOptions, PHPRuntime } from './load-php-runtime';
import validatePHPExtensionManifest from '../../public/php-extension-manifest-schema-validator';

/**
 * Default VFS directory where PHP.wasm stages extension `.so` files and
 * writes their per-extension ini files.
 */
export const PHP_EXTENSIONS_DIR = '/internal/shared/extensions';

/**
 * Maximum number of sidecar file responses read at the same time. Fetching
 * sidecar assets in parallel keeps startup responsive while avoiding flooding
 * the host.
 */
const MAX_EXTENSION_SIDECAR_FILE_REQUESTS = 5;

/**
 * The php.ini directive used to load the extension. Use `extension` for
 * regular PHP extensions and `zend_extension` for Zend extensions like Xdebug.
 */
export type PHPExtensionIniDirective = 'extension' | 'zend_extension';

/**
 * Extension artifact manifest. Lets callers publish a matrix of `.so` files
 * and lets `resolvePHPExtension()` select the artifact matching the current
 * PHP version. External extension artifacts are JSPI-only.
 */
export interface PHPExtensionManifest {
	name: string;
	version?: string;
	mode?: 'php-extension';
	artifacts: PHPExtensionManifestArtifact[];
	/** URL-backed files shared by every artifact in this manifest. */
	extraFiles?: PHPExtensionManifestExtraFiles;
}

export interface PHPExtensionManifestArtifact {
	/** PHP major/minor version, e.g. `8.4`. */
	phpVersion: string;
	/** Relative to the manifest URL/base URL, or an absolute URL. */
	sourcePath: string;
	/** URL-backed files needed only by this artifact. */
	extraFiles?: PHPExtensionManifestExtraFiles;
}

export interface PHPExtensionManifestExtraFiles {
	/**
	 * Absolute VFS path where files and directories are written. When a
	 * manifest declares both top-level and per-artifact `extraFiles`, the
	 * first declared `targetPath` wins. Defaults to
	 * `<extensionDir>/<name>-assets`.
	 */
	vfsRoot?: string;
	nodes?: PHPExtensionManifestExtraFile[];
}

export interface PHPExtensionManifestExtraFile {
	/** Joined with the group's `vfsRoot` to form the final VFS path. */
	vfsPath: string;
	/** Defaults to "file". Only file nodes need a `sourcePath`. */
	type?: 'file' | 'directory';
	/** Relative to the manifest URL/base URL, or an absolute URL. */
	sourcePath?: string;
}

/**
 * Source for a PHP extension `.so`. Use `format: 'so'` when the caller has
 * bytes, `format: 'url'` for a direct artifact URL, and `format: 'manifest'`
 * when PHP.wasm should select the right artifact from a manifest.
 */
export type PHPExtensionSource =
	| {
			format: 'so';
			name?: string;
			bytes: Uint8Array | ArrayBuffer;
	  }
	| {
			format: 'url';
			name?: string;
			url: string | URL;
	  }
	| {
			format: 'manifest';
			/**
			 * In `@php-wasm/universal`, must be an absolute URL. `@php-wasm/node`
			 * also accepts filesystem paths and `file:` URLs.
			 */
			manifestUrl: string | URL;
	  }
	| {
			format: 'manifest';
			manifest: PHPExtensionManifest;
			/** Base URL for resolving relative artifact paths. */
			baseUrl?: string | URL;
	  };

export interface ResolvedInstallOptions {
	phpVersion: string;
	source: PHPExtensionSource;
	/** Overrides the name inferred from `source`. */
	name?: string;
	/**
	 * The first directive of the generated startup `.ini` file. Regular
	 * extensions need `extension=...`; Zend extensions like Xdebug need
	 * `zend_extension=...`.
	 */
	loadWithIniDirective?: PHPExtensionIniDirective;
	/** Additional `key=value` lines for the generated startup `.ini` file. */
	iniEntries?: Record<string, string>;
	extraFiles?: ResolvedExtraNodes;
	/** Environment variables added before the extension is loaded. */
	env?: Record<string, string>;
	/** Defaults to `PHP_EXTENSIONS_DIR`. */
	extensionDir?: string;
	/**
	 * Fetch implementation used for URL and manifest sources. Runtimes may
	 * provide environment-specific defaults; for example, `@php-wasm/node`
	 * adds local file support.
	 */
	fetch?: typeof fetch;
}

/**
 * Fully resolved files and settings needed to install one extension.
 */
export interface ResolvedPHPExtension {
	soPath: string;
	soBytes: Uint8Array;
	iniPath: string;
	iniContent: string;
	extraNodes?: ResolvedExtraNodes;
	env?: Record<string, string>;
	extensionDir: string;
}

/**
 * Sidecar files to stage next to an extension. Use this for data files or
 * native-library assets the extension expects at runtime.
 */
export interface ResolvedExtraNodes {
	/** Defaults to `/internal/shared/extensions/<name>-assets`. */
	targetPath?: string;
	directories?: string[];
	/** Flat map of relative VFS paths to file contents. */
	files: Record<string, Uint8Array | string>;
}

export interface InstallPHPExtensionFilesOptions {
	name: string;
	soBytes: Uint8Array | ArrayBuffer;
	loadWithIniDirective?: PHPExtensionIniDirective;
	iniEntries?: Record<string, string>;
	extraFiles?: ResolvedExtraNodes;
	env?: Record<string, string>;
	extensionDir?: string;
}

/**
 * Resolves an extension source without mutating a PHP instance. Use this from
 * runtimes that need to fetch extension bytes and compute `iniPath`/`iniContent`
 * before Emscripten initializes PHP.
 *
 * Manifest-declared extra files are joined with their group's `vfsRoot` so the
 * returned `extraNodes` always uses absolute VFS paths.
 */
export async function resolvePHPExtension(
	options: ResolvedInstallOptions
): Promise<ResolvedPHPExtension> {
	const fetchFn = options.fetch ?? globalThis.fetch;
	const source = options.source;

	let name = options.name;
	let soBytes: Uint8Array;
	const files: Record<string, Uint8Array | string> = {};
	const directories: string[] = [];

	if (source.format === 'so') {
		name ??= source.name;
		if (!name) {
			throw new Error(
				'name is required when loading an extension from direct bytes.'
			);
		}
		soBytes = toUint8Array(source.bytes);
	} else if (source.format === 'url') {
		let sourceUrl: URL;
		try {
			sourceUrl = new URL(String(source.url));
		} catch {
			throw new Error(
				`source.url must be an absolute URL when loading a PHP extension from a direct URL. Received: ${String(
					source.url
				)}`
			);
		}
		const inferred = sourceUrl.pathname.split('/').pop() ?? '';
		name ??=
			source.name ??
			(inferred.endsWith('.so') ? inferred.slice(0, -3) : undefined);
		if (!name) {
			throw new Error(
				'name is required when loading an extension from a direct URL.'
			);
		}
		soBytes = await fetchBytes(fetchFn, sourceUrl);
	} else {
		let manifestCandidate: unknown;
		let baseUrl: URL | undefined;
		if ('manifest' in source) {
			manifestCandidate = source.manifest;
			if (source.baseUrl) {
				baseUrl = new URL(String(source.baseUrl));
			}
		} else {
			baseUrl = new URL(String(source.manifestUrl));
			manifestCandidate = await (await fetchFn(baseUrl)).json();
		}
		if (!validatePHPExtensionManifest(manifestCandidate)) {
			throw new Error(
				`Invalid PHP extension manifest: ${JSON.stringify(
					validatePHPExtensionManifest.errors
				)}`
			);
		}
		const manifest = manifestCandidate as PHPExtensionManifest;
		if (!baseUrl) {
			throw new Error(
				'Manifest artifacts require a manifest URL or baseUrl so relative files can be resolved.'
			);
		}

		const artifact = manifest.artifacts.find(
			(candidate) => candidate.phpVersion === options.phpVersion
		);
		if (!artifact) {
			throw new Error(
				`No extension artifact found for PHP ${options.phpVersion}.`
			);
		}
		name ??= manifest.name;

		const queue = new Semaphore({
			concurrency: MAX_EXTENSION_SIDECAR_FILE_REQUESTS,
		});
		const fetches: Array<Promise<void>> = [];
		for (const group of [manifest.extraFiles, artifact.extraFiles]) {
			for (const node of group?.nodes ?? []) {
				const vfsPath = joinPaths(group!.vfsRoot ?? '', node.vfsPath);
				if (node.type === 'directory') {
					directories.push(vfsPath);
					continue;
				}
				if (!node.sourcePath) continue;
				const sourceUrl = new URL(node.sourcePath, baseUrl);
				fetches.push(
					queue
						.run(() => fetchBytes(fetchFn, sourceUrl))
						.then((bytes) => {
							files[vfsPath] = bytes;
						})
				);
			}
		}
		const [fetchedSoBytes] = await Promise.all([
			fetchBytes(fetchFn, new URL(artifact.sourcePath, baseUrl)),
			...fetches,
		]);
		soBytes = fetchedSoBytes;
	}

	const extensionDir = options.extensionDir ?? PHP_EXTENSIONS_DIR;
	if (options.extraFiles) {
		const target =
			options.extraFiles.targetPath ??
			joinPaths(extensionDir, `${name}-assets`);
		for (const [relPath, content] of Object.entries(
			options.extraFiles.files
		)) {
			files[joinPaths(target, relPath)] = content;
		}
		for (const directory of options.extraFiles.directories ?? []) {
			directories.push(joinPaths(target, directory));
		}
	}

	if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
		throw new Error(
			`Invalid PHP extension name ${JSON.stringify(
				name
			)}. Extension names are used to build VFS file names and ini paths, so they may only contain [a-zA-Z0-9_-].`
		);
	}
	const directive = options.loadWithIniDirective ?? 'extension';
	const soPath = joinPaths(extensionDir, `${name}.so`);
	const iniPath = joinPaths(extensionDir, `${name}.ini`);
	const iniContent = [
		`${directive}=${soPath}`,
		...Object.entries(options.iniEntries ?? {}).map(
			([key, value]) => `${key}=${value}`
		),
	].join('\n');

	let extraNodes: ResolvedExtraNodes | undefined;
	if (Object.keys(files).length || directories.length) {
		extraNodes = { files };
		if (directories.length) extraNodes.directories = directories;
	}

	return {
		soPath,
		soBytes,
		iniPath,
		iniContent,
		extraNodes,
		env: options.env,
		extensionDir,
	};
}

/**
 * Adds resolved extensions to Emscripten options. The returned options install
 * extension files during `onRuntimeInitialized` and update `PHP_INI_SCAN_DIR`
 * before PHP startup.
 */
export function withResolvedPHPExtensions(
	options: EmscriptenOptions,
	extensions: ResolvedPHPExtension[]
): EmscriptenOptions {
	if (!extensions.length) {
		return options;
	}
	const env = { ...options.ENV };
	for (const extension of extensions) {
		Object.assign(env, extension.env);
		const paths = env['PHP_INI_SCAN_DIR']?.split(':') ?? [];
		if (!paths.includes(extension.extensionDir)) {
			paths.push(extension.extensionDir);
			env['PHP_INI_SCAN_DIR'] = paths.join(':');
		}
	}
	return {
		...options,
		ENV: env,
		onRuntimeInitialized: (phpRuntime: PHPRuntime) => {
			options.onRuntimeInitialized?.(phpRuntime);
			for (const extension of extensions) {
				installPHPExtensionFilesSync(phpRuntime.FS, extension);
			}
		},
	};
}

/**
 * Installs extension files through Emscripten's synchronous filesystem API.
 * Use this while the PHP runtime is initializing and only the raw Emscripten
 * `FS` object is available.
 */
export function installPHPExtensionFilesSync(
	fs: Emscripten.RootFS,
	options: InstallPHPExtensionFilesOptions | ResolvedPHPExtension
): ResolvedPHPExtension {
	const ext =
		'soPath' in options ? options : buildResolvedPHPExtension(options);
	mkdirIfMissing(fs, ext.extensionDir);
	fs.writeFile(ext.soPath, ext.soBytes);
	fs.writeFile(ext.iniPath, ext.iniContent);
	if (ext.extraNodes) {
		const { directories = [], files } = ext.extraNodes;
		for (const directory of directories) {
			mkdirIfMissing(fs, directory);
		}
		for (const [path, content] of Object.entries(files)) {
			mkdirIfMissing(fs, dirname(path));
			fs.writeFile(path, content);
		}
	}
	return ext;
}

function mkdirIfMissing(fs: Emscripten.RootFS, path: string): void {
	if (!FSHelpers.fileExists(fs, path)) {
		fs.mkdirTree(path);
	}
}

/**
 * Builds the staged paths and per-extension ini content for one extension.
 * Used by `installPHPExtensionFilesSync` when callers pass install options
 * directly (bytes already in hand). Joins any caller-supplied relative
 * sidecar paths against `extraFiles.targetPath` so the result mirrors what
 * `resolvePHPExtension` produces from a manifest.
 */
function buildResolvedPHPExtension(
	options: InstallPHPExtensionFilesOptions
): ResolvedPHPExtension {
	const { name } = options;
	if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
		throw new Error(
			`Invalid PHP extension name ${JSON.stringify(
				name
			)}. Extension names are used to build VFS file names and ini paths, so they may only contain [a-zA-Z0-9_-].`
		);
	}
	const extensionDir = options.extensionDir ?? PHP_EXTENSIONS_DIR;
	const directive = options.loadWithIniDirective ?? 'extension';
	const soPath = joinPaths(extensionDir, `${name}.so`);
	const iniPath = joinPaths(extensionDir, `${name}.ini`);
	const iniContent = [
		`${directive}=${soPath}`,
		...Object.entries(options.iniEntries ?? {}).map(
			([key, value]) => `${key}=${value}`
		),
	].join('\n');

	let extraNodes: ResolvedExtraNodes | undefined;
	if (options.extraFiles) {
		const target =
			options.extraFiles.targetPath ??
			joinPaths(extensionDir, `${name}-assets`);
		const files: Record<string, Uint8Array | string> = {};
		for (const [relPath, content] of Object.entries(
			options.extraFiles.files
		)) {
			files[joinPaths(target, relPath)] = content;
		}
		extraNodes = { files };
		const directories = (options.extraFiles.directories ?? []).map(
			(directory) => joinPaths(target, directory)
		);
		if (directories.length) extraNodes.directories = directories;
	}

	return {
		soPath,
		soBytes: toUint8Array(options.soBytes),
		iniPath,
		iniContent,
		extraNodes,
		env: options.env,
		extensionDir,
	};
}

async function fetchBytes(
	fetchFn: typeof fetch,
	url: URL
): Promise<Uint8Array> {
	const response = await fetchFn(url);
	if (!response.ok) {
		throw new Error(`Failed to fetch ${String(url)}: ${response.status}`);
	}
	return new Uint8Array(await response.arrayBuffer());
}

function toUint8Array(bytes: Uint8Array | ArrayBuffer): Uint8Array {
	return bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
}
