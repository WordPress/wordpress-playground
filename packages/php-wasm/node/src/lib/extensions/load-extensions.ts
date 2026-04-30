import { DEFAULT_IDE_KEY } from '@php-wasm/cli-util';
import type {
	EmscriptenOptions,
	PHPExtensionRuntimeInstall,
	PHPRuntime,
	PHPWasmAsyncMode,
	ResolvePHPExtensionInstallPlanOptions,
	SupportedPHPVersion,
} from '@php-wasm/universal';
import {
	appendPHPExtensionInstallPlans,
	buildPHPExtensionInstallPlan,
	resolvePHPExtensionInstallPlan,
	SupportedPHPVersions,
	SupportedPHPVersionsList,
} from '@php-wasm/universal';
import fs from 'fs';
import path from 'path';
import { getIntlExtensionModule } from './intl/get-intl-extension-module';
import { getMemcachedExtensionModule } from './memcached/get-memcached-extension-module';
import { getRedisExtensionModule } from './redis/get-redis-extension-module';
import { type XdebugOptions, type PathMapping } from './xdebug/with-xdebug';
import { getXdebugExtensionModule } from './xdebug/get-xdebug-extension-module';

/**
 * Built-in PHP extensions shipped with `@php-wasm/node`.
 */
export type BuiltInPHPExtensionName = 'intl' | 'xdebug' | 'redis' | 'memcached';

/**
 * External PHP extension source that can be installed before PHP starts.
 *
 * The loader supplies the active PHP version and async mode before resolving
 * the source, so callers only provide the artifact source and install options.
 */
export type RuntimePHPExtensionSource = Omit<
	ResolvePHPExtensionInstallPlanOptions,
	'phpVersion' | 'asyncMode'
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
 * PHP extension request accepted by the Node runtime loader.
 *
 * The array may mix built-in extension names with external extension sources:
 *
 * ```ts
 * await loadNodeRuntime('8.4', {
 *   extensions: [
 *     'intl',
 *     { source: { format: 'manifest', url: manifestUrl } },
 *   ],
 * });
 * ```
 */
export type PHPLoaderExtension =
	| BuiltInPHPExtension
	| RuntimePHPExtensionSource;

/**
 * Resolves all requested Node runtime extensions and appends their install
 * plans to Emscripten options.
 *
 * Extension sources are resolved in parallel so multiple manifest or artifact
 * downloads do not block each other.
 */
export async function applyPHPLoaderExtensions(
	version: SupportedPHPVersion,
	asyncMode: PHPWasmAsyncMode,
	options: EmscriptenOptions,
	extensions: PHPLoaderExtension[] = []
): Promise<EmscriptenOptions> {
	if (!extensions.length) {
		return options;
	}

	const resolvedExtensions = await Promise.all(
		extensions.map((extension) =>
			resolveRuntimePHPExtension(version, asyncMode, extension)
		)
	);
	return appendPHPExtensionInstallPlans(options, resolvedExtensions);
}

async function resolveRuntimePHPExtension(
	version: SupportedPHPVersion,
	asyncMode: PHPWasmAsyncMode,
	extension: PHPLoaderExtension
): Promise<PHPExtensionRuntimeInstall> {
	if (isRuntimePHPExtensionSource(extension)) {
		const { plan } = await resolvePHPExtensionInstallPlan({
			...extension,
			loadTiming: extension.loadTiming ?? 'before-php-startup',
			phpVersion: version,
			asyncMode,
		});
		return { plan };
	}

	const builtIn: { name: BuiltInPHPExtensionName; options?: XdebugOptions } =
		typeof extension === 'string' ? { name: extension } : extension;

	switch (builtIn.name) {
		case 'intl':
			return await resolveIntlExtension(version);
		case 'redis':
			return await resolveRedisExtension(version);
		case 'memcached':
			return await resolveMemcachedExtension(version);
		case 'xdebug':
			return await resolveXdebugExtension(version, builtIn.options ?? {});
		default:
			throw new Error(
				`Unknown bundled PHP extension: ${String(builtIn.name)}.`
			);
	}
}

function isRuntimePHPExtensionSource(
	extension: PHPLoaderExtension
): extension is RuntimePHPExtensionSource {
	return typeof extension === 'object' && 'source' in extension;
}

async function resolveIntlExtension(
	version: SupportedPHPVersion
): Promise<PHPExtensionRuntimeInstall> {
	const extensionPath = await getIntlExtensionModule(version);
	const soBytes = new Uint8Array(fs.readFileSync(extensionPath));

	const dataName = 'icu.dat';
	const moduleDir =
		typeof __dirname !== 'undefined' ? __dirname : import.meta.dirname;
	const ICUData = fs.readFileSync(resolveIntlDataPath(moduleDir, dataName));

	return {
		plan: buildPHPExtensionInstallPlan({
			name: 'intl',
			soBytes,
			loadTiming: 'before-php-startup',
			env: {
				ICU_DATA: '/internal/shared',
			},
			extraFiles: {
				targetPath: '/internal/shared',
				files: {
					// The Intl extension looks for the hard-coded ICU data name.
					'icudt74l.dat': new Uint8Array(ICUData),
				},
			},
		}),
	};
}

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

async function resolveRedisExtension(
	version: SupportedPHPVersion
): Promise<PHPExtensionRuntimeInstall> {
	const extensionPath = await getRedisExtensionModule(version);
	return {
		plan: buildPHPExtensionInstallPlan({
			name: 'redis',
			soBytes: new Uint8Array(fs.readFileSync(extensionPath)),
			loadTiming: 'before-php-startup',
		}),
	};
}

async function resolveMemcachedExtension(
	version: SupportedPHPVersion
): Promise<PHPExtensionRuntimeInstall> {
	const extensionPath = await getMemcachedExtensionModule(version);
	return {
		plan: buildPHPExtensionInstallPlan({
			name: 'memcached',
			soBytes: new Uint8Array(fs.readFileSync(extensionPath)),
			loadTiming: 'before-php-startup',
		}),
	};
}

async function resolveXdebugExtension(
	version: SupportedPHPVersion,
	xdebugOptions: XdebugOptions
): Promise<PHPExtensionRuntimeInstall> {
	const filePath = await getXdebugExtensionModule(version);
	const ideKey = xdebugOptions.ideKey || DEFAULT_IDE_KEY;

	return {
		plan: buildPHPExtensionInstallPlan({
			name: 'xdebug',
			soBytes: new Uint8Array(fs.readFileSync(filePath)),
			loadTiming: 'before-php-startup',
			loadWithIniDirective: 'zend_extension',
			iniEntries: {
				'xdebug.mode': 'debug,develop',
				'xdebug.start_with_request': 'yes',
				'xdebug.idekey': `"${ideKey}"`,
				// Path mapping is only available starting from Xdebug 3.5,
				// which is used by PHP 8.5+. Previous versions ignore it.
				'xdebug.path_mapping': 'yes',
			},
		}),
		onInstalled: (phpRuntime) => {
			writeXdebugMaps(phpRuntime, version, xdebugOptions);
		},
	};
}

function writeXdebugMaps(
	phpRuntime: PHPRuntime,
	version: SupportedPHPVersion,
	xdebugOptions: XdebugOptions
) {
	/*
	 * Path mapping and skipping is only available starting from Xdebug 3.5,
	 * which is used by PHP 8.5 or higher.
	 */
	const isPHP85orHigher =
		SupportedPHPVersionsList.indexOf(version) <=
		SupportedPHPVersions.indexOf('8.5');

	if (!isPHP85orHigher) {
		return;
	}

	const { pathMappings, pathSkippings } = xdebugOptions;

	if (!pathMappings && !pathSkippings) {
		return;
	}

	phpRuntime.FS.mkdir('/.xdebug');
	if (pathMappings) {
		phpRuntime.FS.writeFile(
			'/.xdebug/path.map',
			serializeXdebugPathMappings(pathMappings)
		);
	}
	if (pathSkippings) {
		phpRuntime.FS.writeFile(
			'/.xdebug/skip.map',
			pathSkippings.map((path) => `${path} = SKIP`).join('\n')
		);
	}
}

function serializeXdebugPathMappings(pathMappings: PathMapping[]) {
	return pathMappings
		.map((map) => `${map.vfsPath} = ${map.hostPath}`)
		.join('\n');
}
