import { StreamedFile } from '@php-wasm/stream-compression';
import { LatestSupportedPHPVersion } from '@php-wasm/universal';
import { RecommendedPHPVersion } from '@wp-playground/common';
import { resolveRuntimeConfiguration } from '../../lib/resolve-runtime-configuration';
import type { BlueprintBundle } from '../../lib/types';
import type { BlueprintV2Declaration } from '../../lib/v2/blueprint-v2-declaration';

describe('Blueprint v2 runtime configuration', () => {
	const expectedDefaults = {
		phpVersion: RecommendedPHPVersion,
		wpVersion: 'latest',
		intl: false,
		networking: true,
		constants: {},
		extraLibraries: [],
	};

	it('resolves default runtime configuration from a declaration', async () => {
		const blueprint = {
			version: 2,
		} satisfies BlueprintV2Declaration;

		await expect(resolveRuntimeConfiguration(blueprint)).resolves.toEqual(
			expectedDefaults
		);
	});

	it('resolves default runtime configuration from a bundle declaration', async () => {
		const blueprint = createBundle({
			version: 2,
		});

		await expect(resolveRuntimeConfiguration(blueprint)).resolves.toEqual(
			expectedDefaults
		);
	});

	it('resolves networking from Playground application options', async () => {
		await expect(
			resolveRuntimeConfiguration({
				version: 2,
				applicationOptions: {
					'wordpress-playground': {
						networkAccess: false,
					},
				},
			})
		).resolves.toMatchObject({
			networking: false,
		});

		await expect(
			resolveRuntimeConfiguration({
				version: 2,
				applicationOptions: {
					'wordpress-playground': {
						networkAccess: true,
					},
				},
			})
		).resolves.toMatchObject({
			networking: true,
		});
	});

	it('uses the default networking value when network access is omitted', async () => {
		await expect(
			resolveRuntimeConfiguration({
				version: 2,
				applicationOptions: {
					'wordpress-playground': {},
				},
			})
		).resolves.toMatchObject({
			networking: true,
		});
	});

	it('resolves constants from the declaration', async () => {
		const constants = {
			WP_DEBUG: true,
			WP_ENVIRONMENT_TYPE: 'local',
			AUTOSAVE_INTERVAL: 120,
		};

		await expect(
			resolveRuntimeConfiguration({
				version: 2,
				constants,
			})
		).resolves.toMatchObject({
			constants,
		});
	});

	it('resolves exact PHP version strings', async () => {
		await expect(
			resolveRuntimeConfiguration({
				version: 2,
				phpVersion: '8.2',
			})
		).resolves.toMatchObject({
			phpVersion: '8.2',
		});

		await expect(
			resolveRuntimeConfiguration({
				version: 2,
				phpVersion: 'next',
			})
		).resolves.toMatchObject({
			phpVersion: 'next',
		});
	});

	it('resolves the latest PHP version label', async () => {
		await expect(
			resolveRuntimeConfiguration({
				version: 2,
				phpVersion: 'latest',
			})
		).resolves.toMatchObject({
			phpVersion: LatestSupportedPHPVersion,
		});
	});

	it('resolves recommended PHP versions from constraint objects', async () => {
		await expect(
			resolveRuntimeConfiguration({
				version: 2,
				phpVersion: {
					min: '8.1',
					recommended: '8.2',
					max: '8.4',
				},
			})
		).resolves.toMatchObject({
			phpVersion: '8.2',
		});
	});

	it('uses the default PHP version for constraints without a recommended version', async () => {
		await expect(
			resolveRuntimeConfiguration({
				version: 2,
				phpVersion: {
					min: '8.1',
					max: '8.4',
				},
			})
		).resolves.toMatchObject({
			phpVersion: RecommendedPHPVersion,
		});
	});

	it('uses the highest supported PHP version matching version constraints', async () => {
		await expect(
			resolveRuntimeConfiguration({
				version: 2,
				phpVersion: {
					min: LatestSupportedPHPVersion,
				},
			})
		).resolves.toMatchObject({
			phpVersion: LatestSupportedPHPVersion,
		});
	});

	it('uses a lower supported PHP version when max excludes the default', async () => {
		await expect(
			resolveRuntimeConfiguration({
				version: 2,
				phpVersion: {
					max: '8.2',
				},
			})
		).resolves.toMatchObject({
			phpVersion: '8.2',
		});
	});

	it('rejects unsupported PHP version strings', async () => {
		await expect(
			resolveRuntimeConfiguration({
				version: 2,
				phpVersion: '8.9',
			} as BlueprintV2Declaration)
		).rejects.toThrow(
			'Unsupported Blueprint v2 PHP version "8.9". Supported versions:'
		);
	});

	it('rejects unsatisfied PHP version constraints', async () => {
		await expect(
			resolveRuntimeConfiguration({
				version: 2,
				phpVersion: {
					min: '8.5',
					max: '8.4',
				},
			})
		).rejects.toThrow(
			'Unsatisfiable Blueprint v2 PHP version constraints {"min":"8.5","max":"8.4"}. Supported versions:'
		);
	});

	it('resolves simple WordPress version strings', async () => {
		for (const wordpressVersion of [
			'latest',
			'6.8',
			'6.8.1',
			'6.8-rc1',
			'beta',
			'trunk',
			'nightly',
		]) {
			await expect(
				resolveRuntimeConfiguration({
					version: 2,
					wordpressVersion,
				} as BlueprintV2Declaration)
			).resolves.toMatchObject({
				wpVersion: wordpressVersion,
			});
		}
	});

	it('resolves preferred WordPress versions from constraint objects', async () => {
		await expect(
			resolveRuntimeConfiguration({
				version: 2,
				wordpressVersion: {
					min: '6.8',
					preferred: '6.8',
				},
			})
		).resolves.toMatchObject({
			wpVersion: '6.8',
		});
	});

	it('uses the default WordPress version for constraints without a preferred version', async () => {
		await expect(
			resolveRuntimeConfiguration({
				version: 2,
				wordpressVersion: {
					min: '6.8',
				},
			})
		).resolves.toMatchObject({
			wpVersion: 'latest',
		});
	});

	it('rejects unsupported WordPress version strings', async () => {
		await expect(
			resolveRuntimeConfiguration({
				version: 2,
				wordpressVersion: 'not-a-version',
			} as unknown as BlueprintV2Declaration)
		).rejects.toThrow(
			'Unsupported Blueprint v2 WordPress version "not-a-version".'
		);
	});
});

function createBundle(blueprint: BlueprintV2Declaration): BlueprintBundle {
	return {
		async read(path: string) {
			if (path !== 'blueprint.json') {
				throw new Error(`Unexpected bundle read: ${path}`);
			}
			return StreamedFile.fromArrayBuffer(
				new TextEncoder().encode(JSON.stringify(blueprint)),
				'blueprint.json'
			);
		},
	} satisfies BlueprintBundle;
}
