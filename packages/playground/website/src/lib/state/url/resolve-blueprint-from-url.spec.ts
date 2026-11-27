// @vitest-environment jsdom

import type {
	Blueprint,
	BlueprintBundle,
	BlueprintV1Declaration,
	BlueprintV2Declaration,
} from '@wp-playground/client';
import { InMemoryFilesystem } from '@wp-playground/storage';
import { applyQueryOverrides } from './resolve-blueprint-from-url';

const createBlueprint = {
	v1: (networking: boolean): Blueprint => ({ features: { networking } }),
	v2: (networkAccess: boolean): Blueprint => ({
		version: 2,
		applicationOptions: {
			'wordpress-playground': { networkAccess },
		},
	}),
};

const readNetworking = (blueprint: Blueprint) =>
	'version' in blueprint
		? (blueprint as BlueprintV2Declaration).applicationOptions?.[
				'wordpress-playground'
			]?.networkAccess
		: (blueprint as BlueprintV1Declaration).features?.networking;

describe('applyQueryOverrides', () => {
	describe.each(['v1', 'v2'] as const)('Blueprint %s', (version) => {
		it.each([
			['yes', true],
			['no', false],
		])(
			'applies networking=%s over the Blueprint',
			async (networking, expected) => {
				const overridden = await applyQueryOverrides(
					createBlueprint[version](!expected),
					new URLSearchParams({ networking })
				);

				expect(readNetworking(overridden)).toBe(expected);
			}
		);

		it('keeps the Blueprint setting when networking is omitted', async () => {
			const overridden = await applyQueryOverrides(
				createBlueprint[version](false),
				new URLSearchParams()
			);

			expect(readNetworking(overridden)).toBe(false);
		});

		it('keeps bundled files when it replaces the declaration', async () => {
			const bundle = new InMemoryFilesystem({
				'blueprint.json': JSON.stringify(
					createBlueprint[version](false)
				),
				'foo.txt': 'bar',
			});

			const overridden = (await applyQueryOverrides(
				bundle,
				new URLSearchParams({ networking: 'yes' })
			)) as BlueprintBundle;

			const declaration = JSON.parse(
				await (await overridden.read('blueprint.json')).text()
			);
			expect(readNetworking(declaration)).toBe(true);
			expect(await (await overridden.read('foo.txt')).text()).toBe('bar');
		});
	});

	it('applies networking to a PHP-only Blueprint v1', async () => {
		const overridden = await applyQueryOverrides(
			{ preferredVersions: { php: '8.3', wp: false } },
			new URLSearchParams({ networking: 'no' })
		);

		expect(overridden).toEqual({
			preferredVersions: { php: '8.3', wp: false },
			features: { networking: false },
		});
	});
});
