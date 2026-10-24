import { InMemoryFilesystem } from '@wp-playground/storage';
import { resolveRuntimeConfiguration } from '../lib/resolve-runtime-configuration';
import type { BlueprintV1Declaration } from '../lib/v1/types';

// Contract: only an initial executable language step influences installation.
// Regressions can come from step filtering, shorthand expansion, or bundle loading.
describe('Blueprint v1 installation language', () => {
	it.each([
		{
			steps: [{ step: 'setSiteLanguage', language: 'de_DE' }],
			expected: 'de_DE',
		},
		{
			steps: [
				'A comment',
				false,
				null,
				{ step: 'setSiteLanguage', language: 'fr_FR' },
			],
			expected: 'fr_FR',
		},
		{
			steps: [
				{ step: 'runPHP', code: '<?php' },
				{ step: 'setSiteLanguage', language: 'de_DE' },
			],
			expected: undefined,
		},
		{
			steps: [
				{ step: 'setSiteLanguage', language: 'de_DE' },
				{ step: 'setSiteLanguage', language: 'fr_FR' },
			],
			expected: 'de_DE',
		},
		{ steps: [], expected: undefined },
	])('resolves $expected from $steps', async ({ steps, expected }) => {
		const declaration = { steps } as BlueprintV1Declaration;
		const original = structuredClone(declaration);
		const config = await resolveRuntimeConfiguration(declaration);
		expect(config.installationLanguage).toBe(expected);
		expect(declaration).toEqual(original);
	});

	it('reads the initial language from a Blueprint bundle', async () => {
		const bundle = new InMemoryFilesystem({
			'blueprint.json': JSON.stringify({
				steps: [{ step: 'setSiteLanguage', language: 'de_DE' }],
			}),
		});
		expect(
			(await resolveRuntimeConfiguration(bundle)).installationLanguage
		).toBe('de_DE');
	});
});
