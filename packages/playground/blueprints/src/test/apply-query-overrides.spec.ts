import { describe, it, expect } from 'vitest';
import { applyQueryOverrides } from '../lib/apply-query-overrides';
import type { BlueprintV1Declaration } from '../lib/v1/types';
import { getBlueprintDeclaration } from '../lib/v1/compile';

describe('applyQueryOverrides', () => {
	it('should override PHP version from query param', async () => {
		const blueprint: BlueprintV1Declaration = {
			preferredVersions: { php: '7.4', wp: 'latest' },
		};
		const query = new URLSearchParams('php=8.0');

		const result = (await applyQueryOverrides(
			blueprint,
			query
		)) as BlueprintV1Declaration;

		expect(result.preferredVersions?.php).toBe('8.0');
	});

	it('should override WordPress version from query param', async () => {
		const blueprint: BlueprintV1Declaration = {
			preferredVersions: { php: '8.0', wp: '6.3' },
		};
		const query = new URLSearchParams('wp=6.4');

		const result = (await applyQueryOverrides(
			blueprint,
			query
		)) as BlueprintV1Declaration;

		expect(result.preferredVersions?.wp).toBe('6.4');
	});

	it('should disable networking when query param is not "yes"', async () => {
		const blueprint: BlueprintV1Declaration = {};
		const query = new URLSearchParams('networking=no');

		const result = (await applyQueryOverrides(
			blueprint,
			query
		)) as BlueprintV1Declaration;

		expect(result.features?.networking).toBe(false);
	});

	it('should add setSiteLanguage step from query param', async () => {
		const blueprint: BlueprintV1Declaration = { steps: [] };
		const query = new URLSearchParams('language=es_ES');

		const result = (await applyQueryOverrides(
			blueprint,
			query
		)) as BlueprintV1Declaration;

		expect(result.steps).toContainEqual({
			step: 'setSiteLanguage',
			language: 'es_ES',
		});
	});

	it('should not duplicate setSiteLanguage step if already exists', async () => {
		const blueprint: BlueprintV1Declaration = {
			steps: [{ step: 'setSiteLanguage', language: 'fr_FR' }],
		};
		const query = new URLSearchParams('language=es_ES');

		const result = (await applyQueryOverrides(
			blueprint,
			query
		)) as BlueprintV1Declaration;

		// Should not add another setSiteLanguage step
		const languageSteps = result.steps?.filter(
			(step: any) => step && step.step === 'setSiteLanguage'
		);
		expect(languageSteps).toHaveLength(1);
		expect(languageSteps?.[0]).toMatchObject({
			step: 'setSiteLanguage',
			language: 'fr_FR',
		});
	});

	it('should add enableMultisite step when multisite=yes', async () => {
		const blueprint: BlueprintV1Declaration = { steps: [] };
		const query = new URLSearchParams('multisite=yes');

		const result = (await applyQueryOverrides(
			blueprint,
			query
		)) as BlueprintV1Declaration;

		expect(result.steps).toContainEqual({
			step: 'enableMultisite',
		});
	});

	it('should not duplicate enableMultisite step if already exists', async () => {
		const blueprint: BlueprintV1Declaration = {
			steps: [{ step: 'enableMultisite' }],
		};
		const query = new URLSearchParams('multisite=yes');

		const result = (await applyQueryOverrides(
			blueprint,
			query
		)) as BlueprintV1Declaration;

		// Should not add another enableMultisite step
		const multisiteSteps = result.steps?.filter(
			(step: any) => step && step.step === 'enableMultisite'
		);
		expect(multisiteSteps).toHaveLength(1);
	});

	it('should set login to true unless explicitly set to "no"', async () => {
		const blueprint1: BlueprintV1Declaration = {};
		const query1 = new URLSearchParams('login=yes');

		const result1 = (await applyQueryOverrides(
			blueprint1,
			query1
		)) as BlueprintV1Declaration;
		expect(result1.login).toBe(true);

		const blueprint2: BlueprintV1Declaration = {};
		const query2 = new URLSearchParams('login=no');

		const result2 = (await applyQueryOverrides(
			blueprint2,
			query2
		)) as BlueprintV1Declaration;
		expect(result2.login).toBeUndefined();
	});

	it('should override landingPage from url query param', async () => {
		const blueprint: BlueprintV1Declaration = {
			landingPage: '/',
		};
		const query = new URLSearchParams('url=/wp-admin');

		const result = (await applyQueryOverrides(
			blueprint,
			query
		)) as BlueprintV1Declaration;

		expect(result.landingPage).toBe('/wp-admin');
	});

	it('should override WordPress version with core-pr query param', async () => {
		const blueprint: BlueprintV1Declaration = {
			preferredVersions: { php: '8.0', wp: '6.4' },
		};
		const query = new URLSearchParams('core-pr=12345');

		const result = (await applyQueryOverrides(
			blueprint,
			query
		)) as BlueprintV1Declaration;

		expect(result.preferredVersions?.wp).toContain('12345');
		expect(result.preferredVersions?.wp).toContain('plugin-proxy.php');
	});

	it('should handle blueprint bundles (filesystems)', async () => {
		const { InMemoryFilesystem } = await import('@wp-playground/storage');
		const blueprintBundle = new InMemoryFilesystem({
			'blueprint.json': JSON.stringify({ landingPage: '/test' }),
		});

		const query = new URLSearchParams('php=8.2');
		const result = await applyQueryOverrides(blueprintBundle, query);

		const blueprint = await getBlueprintDeclaration(result);
		expect(blueprint).toEqual({
			landingPage: '/test',
			preferredVersions: { php: '8.2', wp: 'latest' },
			features: {},
			login: true,
		});
	});
});
