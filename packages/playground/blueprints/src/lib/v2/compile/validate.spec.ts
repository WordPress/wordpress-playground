import { describe, it, expect } from 'vitest';
import { validateBlueprintV2 } from './validate';

describe('validateBlueprintV2', () => {
	it('should accept a valid minimal V2 blueprint', () => {
		const result = validateBlueprintV2({ version: 2 });
		expect(result.valid).toBe(true);
		expect(result.errors).toEqual([]);
	});

	it('should reject a blueprint without version', () => {
		const result = validateBlueprintV2({});
		expect(result.valid).toBe(false);
		expect(result.errors).toEqual([
			expect.stringContaining('Missing required property "version"'),
		]);
	});

	it('should reject a blueprint with wrong version (version: 1)', () => {
		const result = validateBlueprintV2({ version: 1 });
		expect(result.valid).toBe(false);
		expect(result.errors).toEqual([
			expect.stringContaining('Invalid version'),
		]);
	});

	it('should accept a blueprint with a plugins array', () => {
		const result = validateBlueprintV2({
			version: 2,
			plugins: ['jetpack', 'akismet'],
		});
		expect(result.valid).toBe(true);
		expect(result.errors).toEqual([]);
	});

	it('should accept a blueprint with all declarative properties', () => {
		const result = validateBlueprintV2({
			version: 2,
			plugins: ['jetpack'],
			themes: ['twentytwentyfour'],
			muPlugins: [],
			media: [],
			content: [],
			users: [],
			roles: [],
			siteOptions: { blogname: 'Test' },
			constants: { WP_DEBUG: true },
			siteLanguage: 'en_US',
			phpVersion: '8.1',
			wordpressVersion: '6.4',
			applicationOptions: {
				'wordpress-playground': {
					landingPage: '/wp-admin',
					login: true,
					networkAccess: false,
				},
			},
			blueprintMeta: {
				name: 'Test Blueprint',
			},
			additionalStepsAfterExecution: [
				{ step: 'runPHP', code: '<?php echo 1;' },
			],
		});
		expect(result.valid).toBe(true);
		expect(result.errors).toEqual([]);
	});

	it('should provide a human-friendly error for a misspelled step name', () => {
		const result = validateBlueprintV2({
			version: 2,
			additionalStepsAfterExecution: [{ step: 'intallPlugi' }],
		});
		expect(result.valid).toBe(false);
		expect(result.errors.length).toBe(1);
		expect(result.errors[0]).toContain('Unknown step name "intallPlugi"');
		expect(result.errors[0]).toContain('Did you mean "installPlugin"?');
	});

	it('should reject non-object values', () => {
		expect(validateBlueprintV2(null).valid).toBe(false);
		expect(validateBlueprintV2(42).valid).toBe(false);
		expect(validateBlueprintV2('hello').valid).toBe(false);
	});

	it('should report type errors for incorrectly typed properties', () => {
		const result = validateBlueprintV2({
			version: 2,
			plugins: 'not-an-array',
			siteOptions: [],
		});
		expect(result.valid).toBe(false);
		expect(result.errors).toEqual(
			expect.arrayContaining([
				expect.stringContaining('"plugins" must be an array'),
				expect.stringContaining('"siteOptions" must be an object'),
			])
		);
	});

	it('should accept valid step names without errors', () => {
		const result = validateBlueprintV2({
			version: 2,
			additionalStepsAfterExecution: [
				{ step: 'installPlugin' },
				{ step: 'activatePlugin' },
				{ step: 'runPHP' },
				{ step: 'wp-cli' },
			],
		});
		expect(result.valid).toBe(true);
		expect(result.errors).toEqual([]);
	});

	it('should accept phpVersion as an object', () => {
		const result = validateBlueprintV2({
			version: 2,
			phpVersion: { min: '8.0', recommended: '8.2' },
		});
		expect(result.valid).toBe(true);
		expect(result.errors).toEqual([]);
	});

	it('should reject phpVersion as a number', () => {
		const result = validateBlueprintV2({
			version: 2,
			phpVersion: 8.1,
		});
		expect(result.valid).toBe(false);
		expect(result.errors).toEqual([
			expect.stringContaining(
				'"phpVersion" must be a string or an object'
			),
		]);
	});
});
