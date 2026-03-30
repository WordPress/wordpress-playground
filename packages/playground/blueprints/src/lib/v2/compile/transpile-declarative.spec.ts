import { describe, it, expect } from 'vitest';
import { transpileDeclarativeToSteps } from './transpile-declarative';
import type { BlueprintV2Declaration } from '../types';

describe('transpileDeclarativeToSteps', () => {
	it('should return an empty array for a minimal blueprint', () => {
		const blueprint: BlueprintV2Declaration = { version: 2 };
		const steps = transpileDeclarativeToSteps(blueprint);
		expect(steps).toEqual([]);
	});

	it('should transpile constants to a defineConstants step', () => {
		const blueprint = {
			version: 2,
			constants: { WP_DEBUG: true, WP_DEBUG_LOG: true },
		} as BlueprintV2Declaration;
		const steps = transpileDeclarativeToSteps(blueprint);
		expect(steps).toHaveLength(1);
		expect(steps[0].step).toBe('defineConstants');
		expect(steps[0].args).toEqual({
			constants: { WP_DEBUG: true, WP_DEBUG_LOG: true },
		});
	});

	it('should transpile plugins array to installPlugin steps with active: true default', () => {
		const blueprint = {
			version: 2,
			plugins: ['jetpack', 'akismet'],
		} as BlueprintV2Declaration;
		const steps = transpileDeclarativeToSteps(blueprint);
		expect(steps).toHaveLength(2);
		expect(steps[0].step).toBe('installPlugin');
		expect(steps[0].args).toEqual({
			source: 'jetpack',
			active: true,
		});
		expect(steps[1].step).toBe('installPlugin');
		expect(steps[1].args).toEqual({
			source: 'akismet',
			active: true,
		});
	});

	it('should preserve active: false from plugin objects', () => {
		const blueprint = {
			version: 2,
			plugins: [
				{
					source: 'woocommerce',
					active: false,
				},
			],
		} as BlueprintV2Declaration;
		const steps = transpileDeclarativeToSteps(blueprint);
		expect(steps).toHaveLength(1);
		expect(steps[0].step).toBe('installPlugin');
		expect(steps[0].args.active).toBe(false);
		expect(steps[0].args.source).toBe('woocommerce');
	});

	it('should transpile activeTheme to installTheme + activateTheme', () => {
		const blueprint = {
			version: 2,
			activeTheme: 'twentytwentyfour',
		} as BlueprintV2Declaration;
		const steps = transpileDeclarativeToSteps(blueprint);
		expect(steps).toHaveLength(2);
		expect(steps[0].step).toBe('installTheme');
		expect(steps[0].args).toEqual({
			source: 'twentytwentyfour',
		});
		expect(steps[1].step).toBe('activateTheme');
		expect(steps[1].args).toEqual({
			themeDirectoryName: 'twentytwentyfour',
		});
	});

	it('should maintain spec-defined step order', () => {
		const blueprint = {
			version: 2,
			// Deliberately list properties out of spec order
			// to verify the transpiler reorders them correctly.
			plugins: ['jetpack'],
			siteLanguage: 'fr_FR',
			constants: { WP_DEBUG: true },
			themes: ['astra'],
			siteOptions: { blogname: 'Test' },
			activeTheme: 'twentytwentyfour',
			content: [
				{ type: 'wxr', source: 'https://example.com/content.wxr' },
			],
			media: ['https://example.com/image.jpg'],
			additionalStepsAfterExecution: [
				{ step: 'runPHP', code: '<?php echo 1;' },
			],
		} as BlueprintV2Declaration;
		const steps = transpileDeclarativeToSteps(blueprint);

		const stepNames = steps.map((s) => s.step);

		// Verify spec-defined ordering:
		// 1. defineConstants
		// 2. setSiteOptions
		// 3. (muPlugins — none here)
		// 4. installTheme (from themes)
		// 5. installTheme + activateTheme (from activeTheme)
		// 6. installPlugin (from plugins)
		// 7. (fonts — none here)
		// 8. importMedia
		// 9. setSiteLanguage
		// 10-12. (roles, users, postTypes — none here)
		// 13. importContent
		// 14. additionalStepsAfterExecution
		const expectedOrder = [
			'defineConstants',
			'setSiteOptions',
			'installTheme', // from themes
			'installTheme', // from activeTheme
			'activateTheme', // from activeTheme
			'installPlugin', // from plugins
			'importMedia',
			'setSiteLanguage',
			'importContent',
			'runPHP', // from additionalStepsAfterExecution
		];
		expect(stepNames).toEqual(expectedOrder);
	});

	it('should append additionalStepsAfterExecution at the end', () => {
		const blueprint = {
			version: 2,
			constants: { WP_DEBUG: true },
			additionalStepsAfterExecution: [
				{ step: 'runPHP', code: '<?php echo 1;' },
				{ step: 'wp-cli', command: 'cache flush' },
			],
		} as BlueprintV2Declaration;
		const steps = transpileDeclarativeToSteps(blueprint);

		// defineConstants first, then the two additional steps
		expect(steps).toHaveLength(3);
		expect(steps[0].step).toBe('defineConstants');
		expect(steps[1].step).toBe('runPHP');
		expect(steps[1].args).toEqual({ code: '<?php echo 1;' });
		expect(steps[2].step).toBe('wp-cli');
		expect(steps[2].args).toEqual({ command: 'cache flush' });
	});

	it('should transpile siteOptions to a setSiteOptions step', () => {
		const blueprint = {
			version: 2,
			siteOptions: {
				blogname: 'My Blog',
				timezone_string: 'Europe/London',
			},
		} as BlueprintV2Declaration;
		const steps = transpileDeclarativeToSteps(blueprint);
		expect(steps).toHaveLength(1);
		expect(steps[0].step).toBe('setSiteOptions');
		expect(steps[0].args).toEqual({
			options: {
				blogname: 'My Blog',
				timezone_string: 'Europe/London',
			},
		});
	});

	it('should transpile siteLanguage to a setSiteLanguage step', () => {
		const blueprint = {
			version: 2,
			siteLanguage: 'de_DE',
		} as BlueprintV2Declaration;
		const steps = transpileDeclarativeToSteps(blueprint);
		expect(steps).toHaveLength(1);
		expect(steps[0].step).toBe('setSiteLanguage');
		expect(steps[0].args).toEqual({ language: 'de_DE' });
	});

	it('should transpile themes to installTheme steps without activation', () => {
		const blueprint = {
			version: 2,
			themes: ['astra', 'flavflavor'],
		} as BlueprintV2Declaration;
		const steps = transpileDeclarativeToSteps(blueprint);
		expect(steps).toHaveLength(2);
		expect(steps[0].step).toBe('installTheme');
		expect(steps[0].args).toEqual({ source: 'astra' });
		expect(steps[1].step).toBe('installTheme');
		expect(steps[1].args).toEqual({ source: 'flavflavor' });
		// No activateTheme step should be present
		expect(steps.every((s) => s.step !== 'activateTheme')).toBe(true);
	});

	it('should add progressHints with appropriate weights', () => {
		const blueprint = {
			version: 2,
			plugins: ['jetpack'],
			themes: ['astra'],
			constants: { WP_DEBUG: true },
			siteLanguage: 'en_US',
		} as BlueprintV2Declaration;
		const steps = transpileDeclarativeToSteps(blueprint);

		const constantsStep = steps.find((s) => s.step === 'defineConstants');
		expect(constantsStep?.progressHints?.weight).toBe(1);

		const pluginStep = steps.find((s) => s.step === 'installPlugin');
		expect(pluginStep?.progressHints?.weight).toBe(5);
		expect(pluginStep?.progressHints?.caption).toContain('jetpack');

		const themeStep = steps.find((s) => s.step === 'installTheme');
		expect(themeStep?.progressHints?.weight).toBe(5);

		const langStep = steps.find((s) => s.step === 'setSiteLanguage');
		expect(langStep?.progressHints?.weight).toBe(1);
	});

	it('should transpile media entries to importMedia steps', () => {
		const blueprint = {
			version: 2,
			media: [
				'https://example.com/image.jpg',
				{
					source: 'https://example.com/video.mp4',
					title: 'My Video',
				},
			],
		} as BlueprintV2Declaration;
		const steps = transpileDeclarativeToSteps(blueprint);
		expect(steps).toHaveLength(2);
		expect(steps[0].step).toBe('importMedia');
		expect(steps[0].args).toEqual({
			source: 'https://example.com/image.jpg',
		});
		expect(steps[1].step).toBe('importMedia');
		expect(steps[1].args).toEqual({
			source: 'https://example.com/video.mp4',
			title: 'My Video',
		});
	});

	it('should transpile content entries to importContent steps', () => {
		const blueprint = {
			version: 2,
			content: [
				{
					type: 'wxr',
					source: 'https://example.com/content.wxr',
				},
			],
		} as BlueprintV2Declaration;
		const steps = transpileDeclarativeToSteps(blueprint);
		expect(steps).toHaveLength(1);
		expect(steps[0].step).toBe('importContent');
		expect(steps[0].args).toEqual({
			type: 'wxr',
			source: 'https://example.com/content.wxr',
		});
	});

	it('should transpile plugin objects with all properties', () => {
		const blueprint = {
			version: 2,
			plugins: [
				{
					source: 'woocommerce',
					active: true,
					activationOptions: { storeCity: 'London' },
					humanReadableName: 'WooCommerce',
				},
			],
		} as BlueprintV2Declaration;
		const steps = transpileDeclarativeToSteps(blueprint);
		expect(steps).toHaveLength(1);
		expect(steps[0].args.source).toBe('woocommerce');
		expect(steps[0].args.active).toBe(true);
		expect(steps[0].args.activationOptions).toEqual({
			storeCity: 'London',
		});
		expect(steps[0].progressHints?.caption).toContain('WooCommerce');
	});

	it('should transpile activeTheme objects', () => {
		const blueprint = {
			version: 2,
			activeTheme: {
				source: 'https://example.com/theme.zip',
				humanReadableName: 'My Theme',
			},
		} as BlueprintV2Declaration;
		const steps = transpileDeclarativeToSteps(blueprint);
		expect(steps).toHaveLength(2);
		expect(steps[0].step).toBe('installTheme');
		expect(steps[0].args.source).toBe('https://example.com/theme.zip');
		expect(steps[0].progressHints?.caption).toContain('My Theme');
		expect(steps[1].step).toBe('activateTheme');
	});
});
