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

export type BuiltInPHPWebExtensionName = 'intl';

export type RuntimePHPWebExtensionSource = Omit<
	ResolvePHPExtensionInstallPlanOptions,
	'phpVersion' | 'asyncMode'
>;

export type PHPWebLoaderExtension =
	| BuiltInPHPWebExtensionName
	| {
			name: BuiltInPHPWebExtensionName;
	  }
	| RuntimePHPWebExtensionSource;

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
