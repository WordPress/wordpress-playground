import { DEFAULT_IDE_KEY } from '@php-wasm/cli-util';
import type {
	Emscripten,
	EmscriptenOptions,
	ResolvedInstallOptions,
	ResolvedPHPExtension,
	SupportedPHPVersion,
} from '@php-wasm/universal';
import {
	PHP_EXTENSIONS_DIR,
	installPHPExtensionFilesSync,
	resolvePHPExtension,
	SupportedPHPVersions,
} from '@php-wasm/universal';
import fs from 'fs';
import path from 'path';
import { dirname, joinPaths } from '@php-wasm/util';
import { getIntlExtensionModule } from './intl/get-intl-extension-module';
import { getMemcachedExtensionModule } from './memcached/get-memcached-extension-module';
import { getRedisExtensionModule } from './redis/get-redis-extension-module';
import { getXdebugExtensionModule } from './xdebug/get-xdebug-extension-module';
import {
	fetchNodeExtensionResource,
	normalizeNodeExtensionSource,
} from './node-extension-resources';

type PHPWasmAsyncMode = 'jspi' | 'asyncify';

export interface PathMapping {
	hostPath: string;
	vfsPath: string;
}

export interface XdebugOptions {
	ideKey?: string;
	pathMappings?: PathMapping[];
	pathSkippings?: string[];
}

/**
 * Built-in PHP extensions shipped with `@php-wasm/node`.
 */
export type BuiltInPHPExtensionName = 'intl' | 'xdebug' | 'redis' | 'memcached';

/**
 * External PHP extension source that can be installed before PHP starts.
 *
 * External sources are supported in JSPI runtimes only. Asyncify support is
 * limited to bundled extensions shipped with this package.
 */
export type RuntimePHPExtensionSource = Omit<
	ResolvedInstallOptions,
	'phpVersion'
>;

/**
 * Built-in PHP extension request accepted by `loadNodeRuntime()`.
 *
 * Pass a string for defaults, or an object when a built-in extension exposes
 * options. Currently only `xdebug` has options.
 */
export type BuiltInPHPExtension =
	| BuiltInPHPExtensionName
	| {
			name: 'xdebug';
			options?: XdebugOptions;
	  }
	| {
			name: Exclude<BuiltInPHPExtensionName, 'xdebug'>;
	  };

/**
 * PHP extension request accepted by `loadNodeRuntime()`.
 *
 * The array may mix built-in extension names with external extension sources:
 *
 * ```ts
 * await loadNodeRuntime('8.4', {
 *   extensions: [
 *     'intl',
 *     { source: { format: 'manifest', manifestUrl: './manifest.json' } },
 *   ],
 * });
 * ```
 *
 * In Node, local manifest and artifact files work without a custom `fetch`
 * implementation. Pass `manifestUrl` as a filesystem path, a `file:` URL, or
 * an HTTP URL.
 */
export type PHPExtension = BuiltInPHPExtension | RuntimePHPExtensionSource;

/**
 * Adds PHP extensions to Emscripten options before the Node runtime starts.
 *
 * Extension sources are resolved in parallel so multiple manifest or artifact
 * downloads do not block each other.
 */
export async function withPHPExtensions(
	version: SupportedPHPVersion,
	asyncMode: PHPWasmAsyncMode,
	options: EmscriptenOptions,
	extensions: PHPExtension[] = []
): Promise<EmscriptenOptions> {
	if (!extensions.length) {
		return options;
	}

	const resolvedExtensions = await Promise.all(
		extensions.map((extension) =>
			resolveRuntimePHPExtension(version, asyncMode, extension)
		)
	);
	return withResolvedNodePHPExtensions(options, resolvedExtensions);
}

interface NodeFilesystemPHPExtension {
	soPath: string;
	soHostPath: string;
	iniPath?: string;
	iniContent?: string;
	extraFiles?: ResolvedInstallOptions['extraFiles'];
	env?: Record<string, string>;
	extensionDir: string;
}

type ResolvedNodePHPExtension =
	| ResolvedPHPExtension
	| NodeFilesystemPHPExtension;

function withResolvedNodePHPExtensions(
	options: EmscriptenOptions,
	extensions: ResolvedNodePHPExtension[]
): EmscriptenOptions {
	if (!extensions.length) {
		return options;
	}
	const env = { ...options.ENV };
	for (const extension of extensions) {
		Object.assign(env, extension.env);
		if (!extension.iniPath) {
			continue;
		}
		const paths = env['PHP_INI_SCAN_DIR']?.split(':') ?? [];
		if (!paths.includes(extension.extensionDir)) {
			paths.push(extension.extensionDir);
			env['PHP_INI_SCAN_DIR'] = paths.join(':');
		}
	}
	const preRun = options['preRun'] ?? [];
	return {
		...options,
		ENV: env,
		['preRun']: [
			...preRun,
			(phpRuntime: { FS: any }) => {
				for (const extension of extensions) {
					if ('soBytes' in extension) {
						installPHPExtensionFilesSync(phpRuntime.FS, extension);
					} else {
						installNodeFilesystemExtensionFilesSync(
							phpRuntime.FS,
							extension
						);
					}
				}
			},
		],
	};
}

function createNodeFilesystemExtension(options: {
	name: BuiltInPHPExtensionName;
	hostPath: string;
	loadWithIniDirective?: 'extension' | 'zend_extension';
	iniEntries?: Record<string, string>;
	extraFiles?: ResolvedInstallOptions['extraFiles'];
	env?: Record<string, string>;
}): NodeFilesystemPHPExtension {
	const extensionDir = PHP_EXTENSIONS_DIR;
	const soPath = joinPaths(extensionDir, `${options.name}.so`);
	return {
		soPath,
		soHostPath: options.hostPath,
		iniPath: joinPaths(extensionDir, `${options.name}.ini`),
		iniContent: createExtensionIniContent({
			directive: options.loadWithIniDirective ?? 'extension',
			soPath,
			iniEntries: options.iniEntries,
		}),
		extraFiles: options.extraFiles,
		env: options.env,
		extensionDir,
	};
}

function createExtensionIniContent(options: {
	directive: 'extension' | 'zend_extension';
	soPath: string;
	iniEntries?: Record<string, string>;
}): string {
	const lines = [`${options.directive}=${options.soPath}`];
	for (const [key, value] of Object.entries(options.iniEntries ?? {})) {
		lines.push(`${key}=${value}`);
	}
	return lines.join('\n');
}

function installNodeFilesystemExtensionFilesSync(
	FS: Emscripten.RootFS,
	extension: NodeFilesystemPHPExtension
) {
	mountHostFile(FS, extension.soHostPath, extension.soPath);
	if (extension.iniPath && extension.iniContent !== undefined) {
		mkdirIfMissing(FS, dirname(extension.iniPath));
		FS.writeFile(extension.iniPath, extension.iniContent);
	}
	if (extension.extraFiles) {
		const { directories = [], files } = extension.extraFiles;
		for (const directory of directories) {
			mkdirIfMissing(FS, directory);
		}
		for (const [path, content] of Object.entries(files)) {
			mkdirIfMissing(FS, dirname(path));
			FS.writeFile(path, content);
		}
	}
}

function mountHostFile(
	FS: Emscripten.RootFS,
	hostPath: string,
	vfsPath: string
) {
	mkdirIfMissing(FS, dirname(vfsPath));
	if (!fileExists(FS, vfsPath)) {
		// Emscripten's mount point must exist before NODEFS can replace it.
		FS.writeFile(vfsPath, '');
	}
	FS.mount(
		FS.filesystems['NODEFS'],
		{ root: fs.realpathSync(hostPath) },
		vfsPath
	);
}

function mkdirIfMissing(FS: Emscripten.RootFS, path: string) {
	if (!fileExists(FS, path)) {
		FS.mkdirTree(path);
	}
}

function fileExists(FS: Emscripten.RootFS, path: string): boolean {
	try {
		FS.lookupPath(path);
		return true;
	} catch (e) {
		const error = e as Emscripten.FS.ErrnoError;
		if (error.errno === 44) {
			return false;
		}
		throw e;
	}
}

/**
 * Resolves one user-facing Node extension request before PHP starts.
 *
 * The request has one of two shapes:
 *
 * 1. An external source supplied by the caller: bytes, a URL, or a manifest.
 *    Node normalizes local paths into `file:` URLs and uses
 *    `fetchNodeExtensionResource()` so local files and remote artifacts go
 *    through the same resolver. External sources are rejected for Asyncify
 *    runtimes.
 * 2. A built-in extension name: `intl`, `redis`, `memcached`, or `xdebug`.
 *    The Node package already knows where those artifacts live and adds any
 *    extra startup state they require, such as ICU data for `intl` or Xdebug
 *    ini entries.
 *
 * This function does not install files into a PHP instance. It only resolves
 * the bytes, sidecar files, environment variables, and ini entries. The caller
 * then adds those resolved extensions to Emscripten options so PHP sees them
 * during startup.
 */
async function resolveRuntimePHPExtension(
	version: SupportedPHPVersion,
	asyncMode: PHPWasmAsyncMode,
	extension: PHPExtension
): Promise<ResolvedNodePHPExtension> {
	/*
	 * External extension requests always carry a `source`. Built-in extension
	 * requests are either strings or `{ name }` objects. This shape check lets
	 * the `extensions` array mix both forms without treating a caller-provided
	 * manifest, URL, or byte source as one of the bundled extensions.
	 */
	if (typeof extension === 'object' && 'source' in extension) {
		if (asyncMode === 'asyncify') {
			throw new Error(
				'External PHP extensions require JSPI. Asyncify is only supported for PHP.wasm bundled extensions.'
			);
		}
		return await resolvePHPExtension({
			...extension,
			source: normalizeNodeExtensionSource(extension.source),
			phpVersion: version,
			fetch: extension.fetch ?? fetchNodeExtensionResource,
		});
	}

	const builtIn: { name: BuiltInPHPExtensionName; options?: XdebugOptions } =
		typeof extension === 'string' ? { name: extension } : extension;

	switch (builtIn.name) {
		case 'intl': {
			const extensionPath = await getIntlExtensionModule(version);
			const dataName = 'icu.dat';
			const moduleDir =
				typeof __dirname !== 'undefined'
					? __dirname
					: import.meta.dirname;
			const dataPath = resolveIntlDataPath(moduleDir, dataName);
			return createNodeFilesystemExtension({
				name: 'intl',
				hostPath: extensionPath,
				env: {
					ICU_DATA: '/internal/shared',
				},
				extraFiles: {
					files: {
						// Keep ICU data in MEMFS so PROXYFS callers can share it.
						// The Intl extension looks for the hard-coded ICU data name.
						'/internal/shared/icudt74l.dat': new Uint8Array(
							fs.readFileSync(dataPath)
						),
					},
				},
			});
		}
		case 'redis': {
			const extensionPath = await getRedisExtensionModule(version);
			return createNodeFilesystemExtension({
				name: 'redis',
				hostPath: extensionPath,
			});
		}
		case 'memcached': {
			const extensionPath = await getMemcachedExtensionModule(version);
			return createNodeFilesystemExtension({
				name: 'memcached',
				hostPath: extensionPath,
			});
		}
		case 'xdebug': {
			const xdebugOptions = builtIn.options ?? {};
			const ideKey = xdebugOptions.ideKey || DEFAULT_IDE_KEY;
			const extensionPath = await getXdebugExtensionModule(version);
			const iniEntries = {
				'xdebug.mode': 'debug,develop',
				'xdebug.start_with_request': 'yes',
				'xdebug.idekey': `"${ideKey}"`,
				// Path mapping is only available starting from Xdebug 3.5,
				// which is used by PHP 8.5+. Previous versions ignore it.
				'xdebug.path_mapping': 'yes',
			};
			const extraFiles = resolveXdebugExtraFiles(version, xdebugOptions);

			return createNodeFilesystemExtension({
				name: 'xdebug',
				hostPath: extensionPath,
				loadWithIniDirective: 'zend_extension',
				iniEntries,
				extraFiles,
			});
		}
		default:
			throw new Error(
				`Unknown bundled PHP extension: ${String(builtIn.name)}.`
			);
	}
}

/**
 * Finds the bundled ICU data file for Node `intl`.
 *
 * The path is different in source tests and in the built package. Source tests
 * run beside `extensions/intl/shared/icu.dat`; published builds copy the same
 * file to the package-level `shared` directory. `intl` will not initialize
 * correctly without this data, so the error lists every checked path.
 */
function resolveIntlDataPath(moduleDir: string, dataName: string): string {
	const candidatePaths = [
		// Built package layout: dist/packages/php-wasm/node/shared/icu.dat.
		path.join(moduleDir, 'shared', dataName),
		// Source/test layout: src/lib/extensions/intl/shared/icu.dat.
		path.join(moduleDir, 'intl', 'shared', dataName),
	];
	const dataPath = candidatePaths.find((candidate) =>
		fs.existsSync(candidate)
	);
	if (!dataPath) {
		throw new Error(
			`Could not find ${dataName}. Checked: ${candidatePaths.join(', ')}`
		);
	}
	return dataPath;
}

/**
 * Builds Xdebug sidecar files that must exist before PHP starts.
 *
 * Xdebug 3.5 adds path mapping and path skipping files under `/.xdebug`.
 * Older bundled Xdebug versions ignore `xdebug.path_mapping`, so there is no
 * sidecar work to do for PHP builds that ship an older Xdebug. When the caller
 * provides mappings or skippings for a supported version, the returned
 * `extraFiles` object lets the shared extension installer stage those files
 * together with `xdebug.so` and `xdebug.ini`.
 */
function resolveXdebugExtraFiles(
	version: SupportedPHPVersion,
	xdebugOptions: XdebugOptions
): ResolvedInstallOptions['extraFiles'] | undefined {
	/*
	 * Path mapping and skipping is only available starting from Xdebug 3.5,
	 * which is used by PHP 8.5 or higher.
	 */
	const isPHP85orHigher =
		SupportedPHPVersions.indexOf(version) <=
		SupportedPHPVersions.indexOf('8.5');

	if (!isPHP85orHigher) {
		return undefined;
	}

	const { pathMappings, pathSkippings } = xdebugOptions;

	if (!pathMappings && !pathSkippings) {
		return undefined;
	}

	const files: Record<string, string> = {};
	if (pathMappings) {
		files['/.xdebug/path.map'] = pathMappings
			.map((map) => `${map.vfsPath} = ${map.hostPath}`)
			.join('\n');
	}
	if (pathSkippings) {
		files['/.xdebug/skip.map'] = pathSkippings
			.map((path) => `${path} = SKIP`)
			.join('\n');
	}

	return { files };
}
