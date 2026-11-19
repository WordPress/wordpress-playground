// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import {
	getBlueprintDeclaration,
	isBlueprintBundle,
} from '@wp-playground/client';
import { RecommendedPHPVersion } from '@wp-playground/common';
import { InMemoryFilesystem } from '@wp-playground/storage';
import { applyQueryOverrides } from './resolve-blueprint-from-url';

describe('applyQueryOverrides', () => {
	it('overrides bundle versions while retaining bundled resources', async () => {
		const bundle = new InMemoryFilesystem({
			'blueprint.json': JSON.stringify({
				preferredVersions: { wp: '6.2', php: '7.4' },
			}),
			'message.txt': 'Bundled resource',
		});
		const result = await applyQueryOverrides(
			bundle,
			new URLSearchParams('wp=6.4&php=8.1')
		);

		expect(
			(await getBlueprintDeclaration(result)).preferredVersions
		).toEqual({
			wp: '6.4',
			php: '8.1',
		});
		expect(isBlueprintBundle(result)).toBe(true);
		if (!isBlueprintBundle(result)) {
			throw new Error(
				'Expected the Blueprint to retain its bundled resources'
			);
		}
		expect(await (await result.read('message.txt')).text()).toBe(
			'Bundled resource'
		);
		expect(
			(await getBlueprintDeclaration(bundle)).preferredVersions
		).toEqual({
			wp: '6.2',
			php: '7.4',
		});
	});

	it.each([
		['4.9', '5.2'],
		['5.5', '7.4'],
		['6.3', RecommendedPHPVersion],
	])(
		'infers the default PHP version for WordPress %s from the URL',
		async (wp, php) => {
			const result = await applyQueryOverrides(
				{ steps: [] },
				new URLSearchParams({ wp })
			);
			const declaration = await getBlueprintDeclaration(result);

			expect(declaration.preferredVersions).toEqual({ wp, php });
			if (wp === '6.3') {
				expect(declaration.steps).toContainEqual({
					step: 'defineWpConfigConsts',
					consts: { WP_DEVELOPMENT_MODE: 'all' },
				});
			}
		}
	);
});
