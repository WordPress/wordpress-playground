import { StreamedFile } from '@php-wasm/stream-compression';
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
