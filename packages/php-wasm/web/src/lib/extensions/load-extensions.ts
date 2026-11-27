import { createMemoizedFetch } from '@wp-playground/common';
import type {
	EmscriptenOptions,
	ResolvedInstallOptions,
	ResolvedPHPExtension,
	AllPHPVersion,
	SupportedPHPVersion,
} from '@php-wasm/universal';
import {
	withResolvedPHPExtensions,
	resolvePHPExtension,
	isLegacyPHPVersion,
	isPHPNextVersion,
	SupportedPHPVersions,
} from '@php-wasm/universal';
import { getIntlExtensionModule } from './intl/get-intl-extension-module';
import { getXdebugExtensionModule } from './xdebug/get-xdebug-extension-module';

type PHPWasmAsyncMode = 'jspi' | 'asyncify';

const DEFAULT_IDE_KEY = 'PHPWASMWEB';

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
 * Built-in PHP extensions shipped with `@php-wasm/web`.
 */
export type BuiltInPHPWebExtensionName = 'intl' | 'xdebug';

/**
 * Built-in PHP extension request accepted by `loadWebRuntime()`.
 *
 * Pass a string for defaults, or an object when a built-in extension exposes
 * options. Currently only `xdebug` has options.
 */
export type BuiltInPHPWebExtension =
	| BuiltInPHPWebExtensionName
	| {
			name: 'xdebug';
			options?: XdebugOptions;
	  }
	| {
			name: Exclude<BuiltInPHPWebExtensionName, 'xdebug'>;
	  };

/**
 * External PHP extension source that can be installed before PHP starts.
 *
 * External sources are supported in JSPI runtimes only. Asyncify support is
 * limited to bundled extensions shipped with this package.
 */
export type RuntimePHPWebExtensionSource = Omit<
	ResolvedInstallOptions,
	'phpVersion'
>;

/**
 * PHP extension request accepted by `loadWebRuntime()`.
 *
 * The array may mix built-in extension names with external extension sources:
 *
 * ```ts
 * await loadWebRuntime('8.4', {
 *   extensions: [
 *     'intl',
 *     { source: { format: 'manifest', manifestUrl } },
 *   ],
 * });
 * ```
 */
export type PHPWebExtension =
	| BuiltInPHPWebExtension
	| RuntimePHPWebExtensionSource;

/**
 * Adds PHP extensions to Emscripten options before the Web runtime starts.
 *
 * Extension sources are resolved in parallel so multiple manifest or artifact
 * downloads do not block each other.
 */
export async function withPHPExtensions(
	version: AllPHPVersion,
	asyncMode: PHPWasmAsyncMode,
	options: EmscriptenOptions,
	extensions: PHPWebExtension[] = []
): Promise<EmscriptenOptions> {
	if (!extensions.length) {
		return options;
	}

	const resolvedExtensions = await Promise.all(
		extensions.map((extension) =>
			resolveRuntimePHPWebExtension(version, asyncMode, extension)
		)
	);
	return withResolvedPHPExtensions(options, resolvedExtensions);
}

/**
 * Resolves one Web runtime extension request before PHP starts.
 *
 * Web has two extension sources. External extensions already describe their
 * own artifact source, so this passes the active PHP version to the universal
 * resolver after rejecting external Asyncify requests. Built-in extensions
 * are different: their `.so` files are bundled assets that must be fetched and
 * staged before PHP reads the generated `.ini` file. `intl` also stages its
 * ICU data, and `xdebug` also stages its ini entries.
 */
async function resolveRuntimePHPWebExtension(
	version: AllPHPVersion,
	asyncMode: PHPWasmAsyncMode,
	extension: PHPWebExtension
): Promise<ResolvedPHPExtension> {
	if (isLegacyPHPVersion(version)) {
		throw new Error(
			`Extensions are not available for legacy PHP ${version}.`
		);
	}

	if (isPHPNextVersion(version)) {
		// PHP extension side modules must be built against the same ABI as
		// the main module. The PHP next publisher only ships main modules.
		throw new Error('Extensions are not available for PHP next.');
	}

	/*
	 * External extension requests always carry a `source`. Built-in web
	 * extension requests are either strings or `{ name }` objects. This shape
	 * check lets the `extensions` array mix both forms without treating a
	 * caller-provided manifest, URL, or byte source as one of the bundled
	 * extensions.
	 */
	if (typeof extension === 'object' && 'source' in extension) {
		if (asyncMode === 'asyncify') {
			throw new Error(
				'External PHP extensions require JSPI. Asyncify is only supported for PHP.wasm bundled extensions.'
			);
		}
		return await resolvePHPExtension({
			...extension,
			phpVersion: version,
		});
	}

	const builtIn: {
		name: BuiltInPHPWebExtensionName;
		options?: XdebugOptions;
	} = typeof extension === 'string' ? { name: extension } : extension;

	const memoizedFetch = createMemoizedFetch(fetch);

	const fetchBundledAsset = async (url: string) => {
		const response = await memoizedFetch(url);
		if (!response.ok) {
			throw new Error(
				`Failed to fetch bundled PHP web extension asset: ${
					response.url || url
				} (${response.status} ${response.statusText}).`
			);
		}
		return await response.arrayBuffer();
	};

	switch (builtIn.name) {
		case 'intl': {
			const extensionPath = await getIntlExtensionModule(version);
			// @ts-ignore
			const dataPath = (await import('./intl/shared/icu.dat')).default;

			const [extensionBytes, ICUData] = await Promise.all([
				fetchBundledAsset(extensionPath),
				fetchBundledAsset(dataPath),
			]);

			return await resolvePHPExtension({
				source: {
					format: 'so',
					name: 'intl',
					bytes: new Uint8Array(extensionBytes),
				},
				phpVersion: version,
				env: {
					ICU_DATA: '/internal/shared',
				},
				extraFiles: {
					files: {
						// The Intl extension looks for the hard-coded ICU data name.
						'/internal/shared/icudt74l.dat': new Uint8Array(
							ICUData
						),
					},
				},
			});
		}
		case 'xdebug': {
			const xdebugOptions = builtIn.options ?? {};
			const extensionBytes = await fetchBundledAsset(
				await getXdebugExtensionModule(version)
			);
			const ideKey = xdebugOptions.ideKey || DEFAULT_IDE_KEY;

			return await resolvePHPExtension({
				source: {
					format: 'so',
					name: 'xdebug',
					bytes: new Uint8Array(extensionBytes),
				},
				phpVersion: version,
				loadWithIniDirective: 'zend_extension',
				iniEntries: {
					'xdebug.mode': 'debug,develop',
					'xdebug.start_with_request': 'yes',
					'xdebug.idekey': `"${ideKey}"`,
					// Path mapping is only available starting from Xdebug 3.5,
					// which is used by PHP 8.5+. Previous versions ignore it.
					'xdebug.path_mapping': 'yes',
				},
				extraFiles: resolveXdebugExtraFiles(version, xdebugOptions),
			});
		}
		default:
			throw new Error(
				`Unknown bundled PHP extension: ${String(builtIn.name)}.`
			);
	}
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
