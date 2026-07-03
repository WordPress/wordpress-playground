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
});

function createBundle(blueprint: BlueprintV2Declaration): BlueprintBundle {
	return {
		read(path: string) {
			if (path !== 'blueprint.json') {
				throw new Error(`Unexpected bundle read: ${path}`);
			}
			return Promise.resolve(
				new File([JSON.stringify(blueprint)], 'blueprint.json')
			);
		},
	} as BlueprintBundle;
}
