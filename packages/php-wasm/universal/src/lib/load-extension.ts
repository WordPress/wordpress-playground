/**
 * During startup, PHP loads .so extensions that are explicitly listed in one
 * of the loaded `php.ini` files.
 *
 * PHP.wasm can be configured to run arbitrary extensions, so that `.ini`
 * configuration must be constructed dynamically. That's what this module does.
 * It fetches the `.so` bytes, stages them in the PHP virtual filesystem, writes a small
 * per-extension `.ini` file next to them, stages any sidecar files, and adds
 * the extension directory to `PHP_INI_SCAN_DIR` before PHP starts.
 *
 * This module only supports loading extensions **before** the PHP runtime
 * initialization. Once PHP has started, the ini scan is over.
 * Technically, some regular extensions can be loaded later with `dl()`, and
 * a support for that could be added eventually. However, Zend extensions
 * cannot be loaded that way. Also, extensions that depend on startup-time files
 * or environment variables are easy to initialize incorrectly. PHP.wasm therefore
 * treats extension loading as part of runtime creation.
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
 * External extensions use the same startup path. A manifest selects the
 * correct `.so` artifact and may declare URL-backed sidecar files:
 *
 * ```json
 * {
 *   "name": "wp_mysql_parser",
 *   "artifacts": [
 *     {
 *       "phpVersion": "8.4",
 *       "file": "wp_mysql_parser-php8.4-jspi.so"
 *     }
 *   ],
 *   "extraFiles": {
 *     "targetPath": "/internal/shared",
 *     "directories": ["spx-data"],
 *     "files": [
 *       { "path": "spx-web-ui/index.html", "file": "web-ui/index.html" }
 *     ]
 *   }
 * }
 * ```
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
import type { FileTree } from './write-files';
import validatePHPExtensionManifest from '../../public/php-extension-manifest-schema-validator';

/**
 * Default VFS directory where PHP.wasm stages extension `.so` files and
 * writes their per-extension ini files.
 */
export const PHP_EXTENSIONS_DIR = '/internal/shared/extensions';

/**
 * Maximum number of sidecar file responses read at the same time.
 *
 * SPX ships multiple UI assets next to its `.so` file. Fetching those assets in
 * parallel keeps startup responsive, while this limit avoids flooding the host.
 */
const MAX_EXTENSION_SIDECAR_FILE_REQUESTS = 5;

/**
 * The php.ini directive used to load the extension.
 *
 * Use `extension` for regular PHP extensions and `zend_extension` for Zend
 * extensions such as Xdebug.
 */
export type PHPExtensionIniDirective = 'extension' | 'zend_extension';

/**
 * One compiled extension artifact in a manifest.
 */
export interface PHPExtensionManifestArtifact {
	/**
	 * PHP major/minor version the artifact was compiled against, e.g. `8.4`.
	 */
	phpVersion: string;

	/**
	 * Relative to the manifest URL/base URL, or an absolute URL.
	 */
	file: string;

	/**
	 * Optional SHA-256 checksum for the fetched `.so` artifact.
	 */
	sha256?: string;

	/**
	 * URL-backed files needed only by this artifact.
	 *
	 * Use this for files that differ by PHP version or async mode. Shared
	 * files, such as an extension web UI, belong in manifest-level
	 * `extraFiles` instead.
	 */
	extraFiles?: PHPExtensionManifestExtraFiles;
}

/**
 * One sidecar file declared by an extension manifest.
 */
export interface PHPExtensionManifestExtraFile {
	/**
	 * Relative VFS path under `PHPExtensionManifestExtraFiles.targetPath`.
	 */
	path: string;

	/**
	 * Relative to the manifest URL/base URL, or an absolute URL.
	 */
	file: string;
}

/**
 * URL-backed files to stage with a manifest extension.
 */
export interface PHPExtensionManifestExtraFiles {
	/**
	 * Files and directories are written here. Defaults to
	 * `/internal/shared/extensions/<name>-assets`.
	 */
	targetPath?: string;

	/**
	 * Empty directories to create under `targetPath`.
	 */
	directories?: string[];

	/**
	 * Files to fetch and stage under `targetPath`.
	 */
	files?: PHPExtensionManifestExtraFile[];
}

/**
 * Extension artifact manifest.
 *
 * A manifest lets callers publish a matrix of `.so` files and lets
 * `resolvePHPExtension()` select the artifact that matches the current PHP
 * version. External extension artifacts are JSPI-only.
 */
export interface PHPExtensionManifest {
	name: string;
	version?: string;
	mode?: 'php-extension';
	artifacts: PHPExtensionManifestArtifact[];
	/**
	 * URL-backed files shared by every artifact in this manifest.
	 *
	 * Use this for common sidecars such as an extension web UI. Files needed
	 * only by one compiled artifact belong in that artifact's `extraFiles`.
	 */
	extraFiles?: PHPExtensionManifestExtraFiles;
}

/**
 * Source for a PHP extension `.so`.
 *
 * Use `format: 'so'` when the caller already has bytes, `format: 'url'` for a
 * direct artifact URL, and `format: 'manifest'` when PHP.wasm should select
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
			 * Optional extension name. If omitted, PHP.wasm infers the name
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
			 * `file:` URL; `@php-wasm/node` resolves local paths before fetching.
			 */
			manifestUrl: string | URL;
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
	 * The directive PHP.wasm writes as the first line of the generated
	 * startup `.ini` file for this extension.
	 *
	 * Regular PHP extensions need `extension=/path/to/name.so`. Zend
	 * extensions, such as Xdebug, need `zend_extension=/path/to/name.so`.
	 * This does not edit the main `php.ini`; it controls the generated
	 * per-extension `.ini` file PHP reads while starting.
	 */
	loadWithIniDirective?: PHPExtensionIniDirective;

	/**
	 * Additional `key=value` lines written to the generated startup `.ini`
	 * file after the `extension=` or `zend_extension=` directive.
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
	 * VFS directory where PHP.wasm writes the extension `.so` file and its
	 * per-extension ini file. Defaults to `PHP_EXTENSIONS_DIR`.
	 */
	extensionDir?: string;

	/**
	 * Fetch implementation used for `format: 'url'`, `manifestUrl`, and
	 * manifest artifacts.
	 *
	 * Runtimes may provide environment-specific defaults. For example,
	 * `@php-wasm/node` provides local file support for extension manifests and
	 * artifacts.
	 */
	fetch?: typeof fetch;
}

/**
 * Options for resolving an extension before a PHP instance exists.
 */
export type ResolvePHPExtensionOptions = PHPExtensionInstallOptions & {
	phpVersion: string;
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
 * `iniPath` and `iniContent` describe the per-extension ini file PHP.wasm
 * writes into the PHP VFS.
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

interface ResolvedPHPExtensionSource {
	name: string;
	soBytes: Uint8Array;
	extraFiles?: PHPExtensionExtraFiles;
}

/**
 * Error shape returned by the generated AJV extension manifest validator.
 */
interface ManifestValidationError {
	instancePath?: string;
	message?: string;
	params?: Record<string, unknown>;
}

/**
 * Resolves an extension source without mutating a PHP instance.
 *
 * Use this from runtimes that need to fetch extension bytes and compute
 * `iniPath`/`iniContent` before Emscripten initializes PHP.
 */
export async function resolvePHPExtension(
	options: ResolvePHPExtensionOptions
): Promise<ResolvedPHPExtension> {
	const resolved = await resolvePHPExtensionSource(
		options,
		options.fetch ?? globalThis.fetch
	);
	const name = options.name ?? resolved.name;
	return buildResolvedPHPExtension({
		name,
		soBytes: resolved.soBytes,
		loadWithIniDirective: options.loadWithIniDirective,
		iniEntries: options.iniEntries,
		extraFiles: mergeExtraFiles(options.extraFiles, resolved.extraFiles),
		env: options.env,
		extensionDir: options.extensionDir,
	});
}

/**
 * Adds resolved extensions to Emscripten options.
 *
 * The returned options install extension files during `onRuntimeInitialized`
 * and update `PHP_INI_SCAN_DIR` before PHP startup.
 */
export function withResolvedPHPExtensions(
	options: EmscriptenOptions,
	extensions: ResolvedPHPExtension[]
): EmscriptenOptions {
	if (!extensions.length) {
		return options;
	}

	const env = {
		...options.ENV,
	};

	for (const extension of extensions) {
		Object.assign(env, extension.env);
		const currentScanDir = env['PHP_INI_SCAN_DIR'];
		const paths = currentScanDir ? currentScanDir.split(':') : [];
		env['PHP_INI_SCAN_DIR'] =
			!currentScanDir || !paths.includes(extension.extensionDir)
				? [...paths, extension.extensionDir].join(':')
				: currentScanDir;
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
 * Builds the VFS paths and per-extension ini content for an extension.
 */
function buildResolvedPHPExtension(
	options: InstallPHPExtensionFilesOptions
): ResolvedPHPExtension {
	const extensionDir = options.extensionDir ?? PHP_EXTENSIONS_DIR;
	const name = options.name;
	if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
		throw new Error(
			`Invalid PHP extension name ${JSON.stringify(
				name
			)}. Extension names are used to build VFS file names and ini paths, so they may only contain [a-zA-Z0-9_-].`
		);
	}
	const loadWithIniDirective = options.loadWithIniDirective ?? 'extension';
	const soPath = joinPaths(extensionDir, `${name}.so`);
	const iniPath = joinPaths(extensionDir, `${name}.ini`);
	const iniContent = [
		`${loadWithIniDirective}=${soPath}`,
		...Object.entries(options.iniEntries ?? {}).map(
			([key, value]) => `${key}=${value}`
		),
	].join('\n');
	const extraFiles = options.extraFiles
		? {
				...options.extraFiles,
				targetPath:
					options.extraFiles.targetPath ??
					joinPaths(extensionDir, `${name}-assets`),
			}
		: undefined;

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

/**
 * Installs extension files through Emscripten's synchronous filesystem API.
 *
 * Use this while the PHP runtime is initializing and only the raw Emscripten
 * `FS` object is available. This writes the `.so` file and generated `.ini`
 * file to their resolved VFS paths.
 */
export function installPHPExtensionFilesSync(
	fs: Emscripten.RootFS,
	options: InstallPHPExtensionFilesOptions | ResolvedPHPExtension
): ResolvedPHPExtension {
	const extension =
		'soPath' in options ? options : buildResolvedPHPExtension(options);
	if (!FSHelpers.fileExists(fs, extension.extensionDir)) {
		fs.mkdirTree(extension.extensionDir);
	}
	fs.writeFile(extension.soPath, extension.soBytes);
	fs.writeFile(extension.iniPath, extension.iniContent);
	if (extension.extraFiles) {
		writeFileTreeSync(
			fs,
			extension.extraFiles.targetPath,
			extension.extraFiles.files
		);
	}
	return extension;
}

/**
 * Resolves the three supported source shapes into the extension name and the
 * `.so` bytes PHP will load.
 *
 * Direct byte sources are already available, URL sources are fetched as a
 * single artifact, and manifest sources first choose the artifact matching the
 * active PHP version. External extension artifacts are JSPI-only, so the
 * manifest does not expose an async-mode selector. Manifests are validated
 * here because they may come from user-provided URLs and their `name`/`file`
 * values later decide what gets written into the PHP virtual filesystem.
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
		if (source.sha256) {
			await assertSha256(source.bytes, source.sha256, name);
		}
		return { name, soBytes: toUint8Array(source.bytes) };
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
		const name =
			options.name ??
			source.name ??
			(() => {
				const path = sourceUrl.pathname;
				const file = path.split('/').pop() ?? '';
				return file.endsWith('.so') ? file.slice(0, -3) : undefined;
			})();
		if (!name) {
			throw new Error(
				'name is required when loading an extension from a direct URL.'
			);
		}
		if (!fetchFn) {
			throw new Error(
				'resolvePHPExtension() requires a fetch implementation.'
			);
		}
		const response = await fetchFn(sourceUrl);
		if (!response.ok) {
			throw new Error(
				`Failed to fetch ${String(sourceUrl)}: ${response.status}`
			);
		}
		const soBytes = new Uint8Array(await response.arrayBuffer());
		if (source.sha256) {
			await assertSha256(soBytes, source.sha256, String(sourceUrl));
		}
		return { name, soBytes };
	}

	const manifestUrl =
		'manifestUrl' in source
			? new URL(String(source.manifestUrl))
			: undefined;
	let manifestCandidate: unknown;
	if ('manifest' in source) {
		manifestCandidate = source.manifest;
	} else {
		if (!fetchFn) {
			throw new Error(
				'resolvePHPExtension() requires a fetch implementation.'
			);
		}
		const response = await fetchFn(manifestUrl!);
		if (!response.ok) {
			throw new Error(
				`Failed to fetch ${String(manifestUrl)}: ${response.status}`
			);
		}
		manifestCandidate = await response.json();
	}
	// The generated validator is built from `PHPExtensionManifest`, so runtime
	// checks stay aligned with the public TypeScript type.
	if (!validatePHPExtensionManifest(manifestCandidate)) {
		throw new Error(
			`Invalid PHP extension manifest: ${formatManifestValidationErrors(
				validatePHPExtensionManifest.errors
			)}`
		);
	}
	const manifest = manifestCandidate as PHPExtensionManifest;
	validateManifestExtraFilePaths(manifest.extraFiles);
	for (const artifact of manifest.artifacts) {
		validateManifestExtraFilePaths(artifact.extraFiles);
	}
	const baseUrl =
		'baseUrl' in source && source.baseUrl
			? new URL(String(source.baseUrl))
			: manifestUrl;
	const artifact = manifest.artifacts.find(
		(candidate) => candidate.phpVersion === options.phpVersion
	);
	if (!artifact) {
		throw new Error(
			`No extension artifact found for PHP ${options.phpVersion}.`
		);
	}
	if (!baseUrl) {
		throw new Error(
			'Manifest artifacts require a manifest URL or baseUrl so relative files can be resolved.'
		);
	}

	const artifactUrl = new URL(artifact.file, baseUrl);
	if (!fetchFn) {
		throw new Error(
			'resolvePHPExtension() requires a fetch implementation.'
		);
	}
	const response = await fetchFn(artifactUrl);
	if (!response.ok) {
		throw new Error(
			`Failed to fetch ${String(artifactUrl)}: ${response.status}`
		);
	}
	const soBytes = new Uint8Array(await response.arrayBuffer());
	if (artifact.sha256) {
		await assertSha256(soBytes, artifact.sha256, artifact.file);
	}
	const extraFiles = await resolveManifestExtraFiles(
		fetchFn,
		baseUrl,
		manifest.extraFiles,
		artifact.extraFiles
	);

	return {
		name: manifest.name,
		soBytes,
		extraFiles,
	};
}

/**
 * Resolves all manifest sidecar file groups into one staged file tree.
 *
 * A manifest may declare shared sidecars once at the top level and
 * artifact-specific sidecars next to the selected `.so` file:
 *
 * ```json
 * {
 *   "extraFiles": { "files": [{ "path": "spx/ui.html", "file": "ui.html" }] },
 *   "artifacts": [
 *     {
 *       "phpVersion": "8.4",
 *       "file": "spx-php8.4.so",
 *       "extraFiles": {
 *         "files": [{ "path": "spx/8.4.ini", "file": "8.4.ini" }]
 *       }
 *     }
 *   ]
 * }
 * ```
 *
 * Both groups are fetched in parallel and then merged in declaration order:
 * manifest-level first, selected artifact second. Paths must not conflict.
 */
async function resolveManifestExtraFiles(
	fetchFn: typeof fetch | undefined,
	baseUrl: URL,
	...extraFilesList: Array<PHPExtensionManifestExtraFiles | undefined>
): Promise<PHPExtensionExtraFiles | undefined> {
	const definedExtraFiles = extraFilesList.filter(
		(extraFiles): extraFiles is PHPExtensionManifestExtraFiles =>
			!!extraFiles
	);
	const fetchQueue = new Semaphore({
		concurrency: MAX_EXTENSION_SIDECAR_FILE_REQUESTS,
	});
	const resolvedExtraFiles = await Promise.all(
		definedExtraFiles.map((extraFiles) =>
			fetchManifestExtraFiles(fetchFn, baseUrl, extraFiles, fetchQueue)
		)
	);
	return resolvedExtraFiles.reduce<PHPExtensionExtraFiles | undefined>(
		(mergedExtraFiles, extraFiles) =>
			mergeExtraFiles(mergedExtraFiles, extraFiles),
		undefined
	);
}

/**
 * Fetches one manifest sidecar file group and converts it to a VFS file tree.
 *
 * Directory entries are materialized as empty nested objects. File entries are
 * resolved relative to the manifest base URL and stored at their declared VFS
 * path under the group's target path.
 */
async function fetchManifestExtraFiles(
	fetchFn: typeof fetch | undefined,
	baseUrl: URL,
	extraFiles: PHPExtensionManifestExtraFiles,
	fetchQueue: Semaphore
): Promise<PHPExtensionExtraFiles> {
	if (!fetchFn) {
		throw new Error(
			'resolvePHPExtension() requires a fetch implementation.'
		);
	}

	const files: FileTree = {};
	for (const directory of extraFiles.directories ?? []) {
		setFileTreeEntry(files, directory, {});
	}
	await Promise.all(
		(extraFiles.files ?? []).map(async (file) => {
			const fileUrl = new URL(file.file, baseUrl);
			const bytes = await fetchQueue.run(async () => {
				const response = await fetchFn(fileUrl);
				if (!response.ok) {
					throw new Error(
						`Failed to fetch ${String(fileUrl)}: ${response.status}`
					);
				}
				return new Uint8Array(await response.arrayBuffer());
			});
			setFileTreeEntry(files, file.path, bytes);
		})
	);

	return {
		targetPath: extraFiles.targetPath,
		files,
	};
}

/**
 * Merges two staged sidecar file groups.
 *
 * If both inputs declare `targetPath`, they must declare the same one. An input
 * without `targetPath` inherits the other input's root:
 *
 * ```ts
 * mergeExtraFiles(
 *     { targetPath: '/internal/shared', files: { 'spx/ui.html': bytes } },
 *     { targetPath: '/internal/shared', files: { 'spx/ui.css': bytes } }
 * );
 *
 * // Throws because the merged result can only represent one VFS root.
 * mergeExtraFiles(
 *     { targetPath: '/internal/shared', files: {} },
 *     { targetPath: '/tmp/spx', files: {} }
 * );
 * ```
 *
 * Sidecar file paths must be disjoint; directory nodes are the only entries
 * that may be merged.
 */
function mergeExtraFiles(
	first?: PHPExtensionExtraFiles,
	second?: PHPExtensionExtraFiles
): PHPExtensionExtraFiles | undefined {
	if (!first) {
		return second;
	}
	if (!second) {
		return first;
	}
	const targetPath = first.targetPath ?? second.targetPath;
	if (
		first.targetPath &&
		second.targetPath &&
		first.targetPath !== second.targetPath
	) {
		throw new Error(
			'Cannot merge extension extra files with different targetPath values.'
		);
	}
	return {
		targetPath,
		files: mergeFileTrees(first.files, second.files),
	};
}

/**
 * Recursively merges two VFS file trees.
 *
 * Directory nodes are merged so manifest-level directories can receive files
 * from artifact-level sidecars. File paths must be unique across all sidecar
 * groups, which keeps manifests explicit and avoids hidden override rules.
 */
function mergeFileTrees(
	first: FileTree,
	second: FileTree,
	currentPath = ''
): FileTree {
	const merged: FileTree = { ...first };
	for (const [path, content] of Object.entries(second)) {
		const existing = merged[path];
		if (existing === undefined) {
			merged[path] = content;
			continue;
		}
		if (isFileTreeDirectory(existing) && isFileTreeDirectory(content)) {
			merged[path] = mergeFileTrees(
				existing,
				content,
				currentPath ? joinPaths(currentPath, path) : path
			);
			continue;
		}
		const conflictingPath = currentPath
			? joinPaths(currentPath, path)
			: path;
		throw new Error(
			`Extension sidecar files declare conflicting path: ${conflictingPath}`
		);
	}
	return merged;
}

/**
 * Writes a file or directory entry into a nested VFS file tree.
 *
 * Manifest paths are normalized and validated before insertion. Directories may
 * be declared more than once, but file paths and file/directory paths must not
 * conflict inside the same sidecar group.
 */
function setFileTreeEntry(
	files: FileTree,
	relativePath: string,
	content: Uint8Array | FileTree
) {
	const normalizedPath = validateRelativeManifestPath(relativePath);
	const parts = normalizedPath.split('/');
	let current = files;
	for (const part of parts.slice(0, -1)) {
		const next = current[part];
		if (next === undefined) {
			current[part] = {};
		}
		if (!isFileTreeDirectory(current[part])) {
			throw new Error(
				`Extension sidecar files declare conflicting path: ${normalizedPath}`
			);
		}
		current = current[part] as FileTree;
	}
	const leafName = parts[parts.length - 1];
	const existing = current[leafName];
	if (
		existing !== undefined &&
		!(isFileTreeDirectory(existing) && isFileTreeDirectory(content))
	) {
		throw new Error(
			`Extension sidecar files declare conflicting path: ${normalizedPath}`
		);
	}
	current[leafName] = content;
}

/**
 * Checks whether a staged sidecar entry is a directory node.
 *
 * `FileTree` can also contain bytes and strings. This guard keeps merge and
 * insertion logic focused on the only node type that may be merged.
 */
function isFileTreeDirectory(
	content: Uint8Array | string | FileTree
): content is FileTree {
	return !(content instanceof Uint8Array) && typeof content !== 'string';
}

/**
 * Formats generated validator errors into a concise exception message.
 *
 * AJV reports structural failures in a machine-oriented form. This preserves
 * the failing location while spelling out missing and unknown properties in a
 * way that is useful to manifest authors.
 */
function formatManifestValidationErrors(
	errors: ManifestValidationError[] | null | undefined
): string {
	if (!errors?.length) {
		return 'unknown validation error.';
	}
	return errors
		.map((error) => {
			const location = error.instancePath || '<root>';
			if (typeof error.params?.['missingProperty'] === 'string') {
				return `${location} must include ${JSON.stringify(
					error.params['missingProperty']
				)}`;
			}
			if (typeof error.params?.['additionalProperty'] === 'string') {
				return `${location} must not include ${JSON.stringify(
					error.params['additionalProperty']
				)}`;
			}
			return `${location} ${error.message ?? 'is invalid'}`;
		})
		.join('; ');
}

/**
 * Validates sidecar VFS paths after the manifest schema passes.
 *
 * The generated schema verifies object shape. This extra pass enforces the
 * path-specific constraint that sidecar files must remain inside `targetPath`.
 */
function validateManifestExtraFilePaths(
	extraFiles: PHPExtensionManifestExtraFiles | undefined
) {
	if (!extraFiles) {
		return;
	}
	if (extraFiles.targetPath !== undefined) {
		const normalizedTargetPath = normalizePath(extraFiles.targetPath);
		if (
			!extraFiles.targetPath.startsWith('/') ||
			normalizedTargetPath !== extraFiles.targetPath
		) {
			throw new Error(
				`Invalid extension extra file targetPath: ${extraFiles.targetPath}`
			);
		}
	}
	for (const directory of extraFiles.directories ?? []) {
		validateRelativeManifestPath(directory);
	}
	for (const file of extraFiles.files ?? []) {
		validateRelativeManifestPath(file.path);
	}
}

/**
 * Returns a normalized manifest sidecar path if it stays inside targetPath.
 *
 * Manifest sidecar paths are relative VFS paths, not host paths or URLs. This
 * rejects absolute paths and parent-directory escapes before building the file
 * tree that will be mounted into the PHP runtime.
 */
function validateRelativeManifestPath(path: string): string {
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

function writeFileTreeSync(
	fs: Emscripten.RootFS,
	root: string,
	files: FileTree
) {
	if (!FSHelpers.fileExists(fs, root)) {
		fs.mkdirTree(root);
	}
	for (const [relativePath, content] of Object.entries(files)) {
		const filePath = joinPaths(root, relativePath);
		const directory = dirname(filePath);
		if (!FSHelpers.fileExists(fs, directory)) {
			fs.mkdirTree(directory);
		}
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
