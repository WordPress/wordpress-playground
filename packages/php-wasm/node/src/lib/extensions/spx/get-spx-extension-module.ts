import type { SupportedPHPVersion } from '@php-wasm/universal';

export interface SpxExtensionPaths {
	extensionPath: string;
	webUiPath: string;
}

export async function getSpxExtensionModule(
	version: SupportedPHPVersion
): Promise<SpxExtensionPaths> {
	switch (version) {
		case '8.2': {
			// @ts-ignore
			const mod = await import('@php-wasm/node-8-2');
			return {
				extensionPath: await mod.getSpxExtensionPath(),
				webUiPath: await mod.getSpxWebUiPath(),
			};
		}
	}
	throw new Error(`SPX extension not available for PHP ${version}`);
}
