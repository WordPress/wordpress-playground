import { createMemoizedFetch } from '@wp-playground/common';
import type {
	EmscriptenOptions,
	PHPExtensionRuntimeInstall,
	PHPWasmAsyncMode,
	ResolvePHPExtensionInstallPlanOptions,
	SupportedPHPVersion,
} from '@php-wasm/universal';
import {
	appendPHPExtensionInstallPlans,
	buildPHPExtensionInstallPlan,
	resolvePHPExtensionInstallPlan,
} from '@php-wasm/universal';
import { getIntlExtensionModule } from './intl/get-intl-extension-module';

/**
 * Built-in PHP extensions shipped with `@php-wasm/web`.
 */
export type BuiltInPHPWebExtensionName = 'intl';

/**
 * External PHP extension source that can be installed before PHP starts.
 *
 * The web loader supplies the active PHP version and async mode before
 * resolving the source, so callers only provide the artifact source and
 * install options.
 */
export type RuntimePHPWebExtensionSource = Omit<
	ResolvePHPExtensionInstallPlanOptions,
	'phpVersion' | 'asyncMode'
>;

/**
 * PHP extension request accepted by the Web runtime loader.
 *
 * The array may mix built-in extension names with external extension sources:
 *
 * ```ts
 * await loadWebRuntime('8.4', {
 *   extensions: [
 *     'intl',
 *     { source: { format: 'manifest', url: manifestUrl } },
 *   ],
 * });
 * ```
 */
export type PHPWebLoaderExtension =
	| BuiltInPHPWebExtensionName
	| {
			name: BuiltInPHPWebExtensionName;
	  }
	| RuntimePHPWebExtensionSource;

/**
 * Resolves all requested Web runtime extensions and appends their install
 * plans to Emscripten options.
 *
 * Extension sources are resolved in parallel so multiple manifest or artifact
 * downloads do not block each other.
 */
export async function applyPHPWebLoaderExtensions(
	version: SupportedPHPVersion,
	asyncMode: PHPWasmAsyncMode,
	options: EmscriptenOptions,
	extensions: PHPWebLoaderExtension[] = []
): Promise<EmscriptenOptions> {
	if (!extensions.length) {
		return options;
	}

	const resolvedExtensions = await Promise.all(
		extensions.map((extension) =>
			resolveRuntimePHPWebExtension(version, asyncMode, extension)
		)
	);
	return appendPHPExtensionInstallPlans(options, resolvedExtensions);
}

async function resolveRuntimePHPWebExtension(
	version: SupportedPHPVersion,
	asyncMode: PHPWasmAsyncMode,
	extension: PHPWebLoaderExtension
): Promise<PHPExtensionRuntimeInstall> {
	if (isRuntimePHPWebExtensionSource(extension)) {
		const { plan } = await resolvePHPExtensionInstallPlan({
			...extension,
			loadTiming: extension.loadTiming ?? 'before-php-startup',
			phpVersion: version,
			asyncMode,
		});
		return { plan };
	}

	const name = typeof extension === 'string' ? extension : extension.name;
	if (name !== 'intl') {
		throw new Error(`Unknown bundled PHP web extension: ${String(name)}.`);
	}
	return await resolveIntlExtension(version);
}

function isRuntimePHPWebExtensionSource(
	extension: PHPWebLoaderExtension
): extension is RuntimePHPWebExtensionSource {
	return typeof extension === 'object' && 'source' in extension;
}

async function resolveIntlExtension(
	version: SupportedPHPVersion
): Promise<PHPExtensionRuntimeInstall> {
	const memoizedFetch = createMemoizedFetch(fetch);

	const extensionPath = await getIntlExtensionModule(version);
	// @ts-ignore
	const dataPath = (await import('./intl/shared/icu.dat')).default;

	const [extension, ICUData] = await Promise.all([
		memoizedFetch(extensionPath).then((response) => response.arrayBuffer()),
		memoizedFetch(dataPath).then((response) => response.arrayBuffer()),
	]);

	return {
		plan: buildPHPExtensionInstallPlan({
			name: 'intl',
			soBytes: new Uint8Array(extension),
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
