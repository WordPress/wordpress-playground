import { createMemoizedFetch } from '@wp-playground/common';
import type {
	EmscriptenOptions,
	ResolvedInstallOptions,
	ResolvedPHPExtension,
	SupportedPHPVersion,
} from '@php-wasm/universal';
import {
	withResolvedPHPExtensions,
	resolvePHPExtension,
} from '@php-wasm/universal';
import { getIntlExtensionModule } from './intl/get-intl-extension-module';

type PHPWasmAsyncMode = 'jspi' | 'asyncify';

/**
 * Built-in PHP extensions shipped with `@php-wasm/web`.
 */
export type BuiltInPHPWebExtensionName = 'intl';

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
	| BuiltInPHPWebExtensionName
	| {
			name: BuiltInPHPWebExtensionName;
	  }
	| RuntimePHPWebExtensionSource;

/**
 * Adds PHP extensions to Emscripten options before the Web runtime starts.
 *
 * Extension sources are resolved in parallel so multiple manifest or artifact
 * downloads do not block each other.
 */
export async function withPHPExtensions(
	version: SupportedPHPVersion,
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
 * resolver after rejecting external Asyncify requests. Built-in `intl` is
 * different: its `.so` and ICU data are bundled assets that must both be
 * fetched and staged before PHP reads the generated `intl.ini`.
 */
async function resolveRuntimePHPWebExtension(
	version: SupportedPHPVersion,
	asyncMode: PHPWasmAsyncMode,
	extension: PHPWebExtension
): Promise<ResolvedPHPExtension> {
	/*
	 * External extension requests always carry a `source`. Built-in web
	 * extension requests are either strings or `{ name }` objects. This shape
	 * check lets the `extensions` array mix both forms without treating a
	 * caller-provided manifest, URL, or byte source as the bundled `intl`
	 * extension.
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

	const name = typeof extension === 'string' ? extension : extension.name;
	if (name !== 'intl') {
		throw new Error(`Unknown bundled PHP web extension: ${String(name)}.`);
	}
	const memoizedFetch = createMemoizedFetch(fetch);

	const extensionPath = await getIntlExtensionModule(version);
	// @ts-ignore
	const dataPath = (await import('./intl/shared/icu.dat')).default;

	const [extensionBytes, ICUData] = await Promise.all(
		[extensionPath, dataPath].map(async (url) => {
			const response = await memoizedFetch(url);
			if (!response.ok) {
				throw new Error(
					`Failed to fetch bundled PHP web extension asset: ${
						response.url || url
					} (${response.status} ${response.statusText}).`
				);
			}
			return await response.arrayBuffer();
		})
	);

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
				'/internal/shared/icudt74l.dat': new Uint8Array(ICUData),
			},
		},
	});
}
