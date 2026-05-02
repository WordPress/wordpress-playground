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
import { dirname, joinPaths, normalizePath, Semaphore } from '@php-wasm/util';
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

export interface PHPExtensionManifestArtifact {
	/** PHP major/minor version, e.g. `8.4`. */
	phpVersion: string;
	/** Relative to the manifest URL/base URL, or an absolute URL. */
	file: string;
	sha256?: string;
	/** URL-backed files needed only by this artifact. */
	extraFiles?: PHPExtensionManifestExtraFiles;
}

export interface PHPExtensionManifestExtraFile {
	/** Relative VFS path under `PHPExtensionManifestExtraFiles.targetPath`. */
	path: string;
	/** Relative to the manifest URL/base URL, or an absolute URL. */
	file: string;
}

export interface PHPExtensionManifestExtraFiles {
	/** Files and directories are written here. */
	targetPath?: string;
	directories?: string[];
	files?: PHPExtensionManifestExtraFile[];
}

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
			sha256?: string;
	  }
	| {
			format: 'url';
			name?: string;
			url: string | URL;
			sha256?: string;
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

/**
 * Sidecar files to stage next to an extension. Use this for data files or
 * native-library assets the extension expects at runtime.
 */
export interface PHPExtensionExtraFiles {
	/** Defaults to `/internal/shared/extensions/<name>-assets`. */
	targetPath?: string;
	directories?: string[];
	/** Flat map of relative VFS paths to file contents. */
	files: Record<string, Uint8Array | string>;
}

export interface PHPExtensionInstallOptions {
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
	extraFiles?: PHPExtensionExtraFiles;
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

export type ResolvePHPExtensionOptions = PHPExtensionInstallOptions & {
	phpVersion: string;
};

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
 */
export interface ResolvedPHPExtension {
	soPath: string;
	soBytes: Uint8Array;
	iniPath: string;
	iniContent: string;
	extraFiles?: PHPExtensionExtraFiles & { targetPath: string };
	env?: Record<string, string>;
	extensionDir: string;
}

/**
 * Resolves an extension source without mutating a PHP instance. Use this from
 * runtimes that need to fetch extension bytes and compute `iniPath`/`iniContent`
 * before Emscripten initializes PHP.
 */
export async function resolvePHPExtension(
	options: ResolvePHPExtensionOptions
): Promise<ResolvedPHPExtension> {
	const fetchFn = options.fetch ?? globalThis.fetch;
	const resolved = await resolvePHPExtensionSource(options, fetchFn);
	return buildResolvedPHPExtension({
		name: options.name ?? resolved.name,
		soBytes: resolved.soBytes,
		loadWithIniDirective: options.loadWithIniDirective,
		iniEntries: options.iniEntries,
		extraFiles: mergeExtraFiles([resolved.extraFiles, options.extraFiles]),
		env: options.env,
		extensionDir: options.extensionDir,
	});
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
	if (ext.extraFiles) {
		const { targetPath, directories = [], files } = ext.extraFiles;
		mkdirIfMissing(fs, targetPath);
		for (const dir of directories) {
			mkdirIfMissing(fs, joinPaths(targetPath, dir));
		}
		for (const [path, content] of Object.entries(files)) {
			const filePath = joinPaths(targetPath, path);
			mkdirIfMissing(fs, dirname(filePath));
			fs.writeFile(filePath, content);
		}
	}
	return ext;
}

function mkdirIfMissing(fs: Emscripten.RootFS, path: string): void {
	if (!FSHelpers.fileExists(fs, path)) {
		fs.mkdirTree(path);
	}
}

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
			([k, v]) => `${k}=${v}`
		),
	].join('\n');

	let extraFiles: ResolvedPHPExtension['extraFiles'];
	if (options.extraFiles) {
		const merged = mergeExtraFiles([options.extraFiles])!;
		extraFiles = {
			...merged,
			targetPath:
				merged.targetPath ?? joinPaths(extensionDir, `${name}-assets`),
		};
	}

	return {
		soPath,
		soBytes: toUint8Array(options.soBytes),
		iniPath,
		iniContent,
		extraFiles,
		env: options.env,
		extensionDir,
	};
}

interface ResolvedPHPExtensionSource {
	name: string;
	soBytes: Uint8Array;
	extraFiles?: PHPExtensionExtraFiles;
}

/**
 * Resolves the three supported source shapes into the extension name and
 * `.so` bytes. Manifests are validated here because they may come from
 * user-provided URLs and their values later decide what gets written into the
 * PHP virtual filesystem.
 */
async function resolvePHPExtensionSource(
	options: ResolvePHPExtensionOptions,
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
		const soBytes = toUint8Array(source.bytes);
		if (source.sha256) {
			await assertSha256(soBytes, source.sha256, name);
		}
		return { name, soBytes };
	}

	if (source.format === 'url') {
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
		const name =
			options.name ??
			source.name ??
			(inferred.endsWith('.so') ? inferred.slice(0, -3) : undefined);
		if (!name) {
			throw new Error(
				'name is required when loading an extension from a direct URL.'
			);
		}
		const soBytes = await fetchBytes(fetchFn, sourceUrl);
		if (source.sha256) {
			await assertSha256(soBytes, source.sha256, String(sourceUrl));
		}
		return { name, soBytes };
	}

	const manifestUrl =
		'manifestUrl' in source
			? new URL(String(source.manifestUrl))
			: undefined;
	const manifestCandidate =
		'manifest' in source
			? source.manifest
			: await (await requireFetch(fetchFn)(manifestUrl!)).json();
	if (!validatePHPExtensionManifest(manifestCandidate)) {
		throw new Error(
			`Invalid PHP extension manifest: ${JSON.stringify(
				validatePHPExtensionManifest.errors
			)}`
		);
	}
	const manifest = manifestCandidate as PHPExtensionManifest;
	const baseUrl =
		'baseUrl' in source && source.baseUrl
			? new URL(String(source.baseUrl))
			: manifestUrl;
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

	const queue = new Semaphore({
		concurrency: MAX_EXTENSION_SIDECAR_FILE_REQUESTS,
	});
	const [soBytes, ...resolvedSidecarGroups] = await Promise.all([
		fetchBytes(fetchFn, new URL(artifact.file, baseUrl)),
		...[manifest.extraFiles, artifact.extraFiles]
			.filter((g): g is PHPExtensionManifestExtraFiles => !!g)
			.map((group) =>
				fetchManifestExtraFiles(fetchFn, baseUrl, group, queue)
			),
	]);
	if (artifact.sha256) {
		await assertSha256(soBytes, artifact.sha256, artifact.file);
	}

	return {
		name: manifest.name,
		soBytes,
		extraFiles: mergeExtraFiles(resolvedSidecarGroups),
	};
}

async function fetchManifestExtraFiles(
	fetchFn: typeof fetch | undefined,
	baseUrl: URL,
	group: PHPExtensionManifestExtraFiles,
	queue: Semaphore
): Promise<PHPExtensionExtraFiles> {
	const files: Record<string, Uint8Array> = {};
	await Promise.all(
		(group.files ?? []).map(async ({ path, file }) => {
			files[path] = await queue.run(() =>
				fetchBytes(fetchFn, new URL(file, baseUrl))
			);
		})
	);
	return {
		targetPath: group.targetPath,
		directories: group.directories,
		files,
	};
}

/**
 * Merges and validates sidecar groups into a single one. Validates that
 * declared `targetPath`s agree, normalizes relative paths, and rejects
 * duplicate or shadowing file paths.
 */
function mergeExtraFiles(
	groups: Array<PHPExtensionExtraFiles | undefined>
): PHPExtensionExtraFiles | undefined {
	const present = groups.filter((g): g is PHPExtensionExtraFiles => !!g);
	if (!present.length) {
		return undefined;
	}

	let targetPath: string | undefined;
	for (const g of present) {
		if (g.targetPath === undefined) continue;
		const normalized = normalizePath(g.targetPath);
		if (!normalized.startsWith('/')) {
			throw new Error(
				`Invalid extension extra file targetPath: ${g.targetPath}`
			);
		}
		if (targetPath !== undefined && targetPath !== normalized) {
			throw new Error(
				'Cannot merge extension extra files with different targetPath values.'
			);
		}
		targetPath = normalized;
	}

	const directories = new Set<string>();
	const files: Record<string, Uint8Array | string> = {};
	for (const g of present) {
		for (const dir of g.directories ?? []) {
			directories.add(validateRelativePath(dir));
		}
		for (const [rawPath, content] of Object.entries(g.files)) {
			const path = validateRelativePath(rawPath);
			const conflicts =
				path in files ||
				Object.keys(files).some(
					(p) => path.startsWith(`${p}/`) || p.startsWith(`${path}/`)
				);
			if (conflicts) {
				throw new Error(
					`Extension sidecar files declare conflicting path: ${path}`
				);
			}
			files[path] = content;
		}
	}

	return {
		targetPath,
		directories: directories.size ? [...directories] : undefined,
		files,
	};
}

/**
 * Returns a normalized relative VFS path. Rejects absolute paths and
 * parent-directory escapes.
 */
function validateRelativePath(path: string): string {
	const normalized = normalizePath(path);
	if (
		!normalized ||
		normalized.startsWith('/') ||
		normalized === '..' ||
		normalized.startsWith('../')
	) {
		throw new Error(
			`Invalid extension extra file path ${JSON.stringify(path)}.`
		);
	}
	return normalized;
}

function requireFetch(fetchFn: typeof fetch | undefined): typeof fetch {
	if (!fetchFn) {
		throw new Error(
			'resolvePHPExtension() requires a fetch implementation.'
		);
	}
	return fetchFn;
}

async function fetchBytes(
	fetchFn: typeof fetch | undefined,
	url: URL
): Promise<Uint8Array> {
	const response = await requireFetch(fetchFn)(url);
	if (!response.ok) {
		throw new Error(`Failed to fetch ${String(url)}: ${response.status}`);
	}
	return new Uint8Array(await response.arrayBuffer());
}

async function assertSha256(
	bytes: Uint8Array | ArrayBuffer,
	expected: string,
	file: string
): Promise<void> {
	const subtle = globalThis.crypto?.subtle;
	if (!subtle) {
		throw new Error(
			`Cannot verify ${file}: crypto.subtle is not available.`
		);
	}
	const digest = await subtle.digest('SHA-256', toUint8Array(bytes));
	const actual = Array.from(new Uint8Array(digest))
		.map((byte) => byte.toString(16).padStart(2, '0'))
		.join('');
	if (actual !== expected) {
		throw new Error(`SHA-256 mismatch for ${file}.`);
	}
}

function toUint8Array(bytes: Uint8Array | ArrayBuffer): Uint8Array {
	return bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
}
