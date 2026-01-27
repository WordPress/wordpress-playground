import { describe, it, expect } from 'vitest';
import { externalPluginSourceRule } from './external-plugin-source';
import type { RuleContext } from '../types';

const createContext = (steps: unknown[]): RuleContext => ({
	blueprint: { steps },
	source: { type: 'remote-url', url: 'https://example.com/bp.json' },
});

describe('externalPluginSourceRule', () => {
	describe('wordpress.org plugins', () => {
		it('returns info severity for wordpress.org plugins', () => {
			const context = createContext([
				{
					step: 'installPlugin',
					pluginData: {
						resource: 'wordpress.org/plugins',
						slug: 'hello-dolly',
					},
				},
			]);

			const warnings = externalPluginSourceRule.analyze(context);

			expect(warnings).toHaveLength(1);
			expect(warnings[0].severity).toBe('info');
			expect(warnings[0].title).toBe('Install plugin "hello-dolly"');
			expect(warnings[0].description).toContain('WordPress.org');
		});

		it('includes step index in warning', () => {
			const context = createContext([
				{ step: 'login' },
				{
					step: 'installPlugin',
					pluginData: {
						resource: 'wordpress.org/plugins',
						slug: 'woocommerce',
					},
				},
			]);

			const warnings = externalPluginSourceRule.analyze(context);

			expect(warnings[0].stepIndex).toBe(1);
		});
	});

	describe('external URL plugins', () => {
		it('returns warning severity for URL resource', () => {
			const context = createContext([
				{
					step: 'installPlugin',
					pluginData: {
						resource: 'url',
						url: 'https://example.com/plugin.zip',
					},
				},
			]);

			const warnings = externalPluginSourceRule.analyze(context);

			expect(warnings).toHaveLength(1);
			expect(warnings[0].severity).toBe('warning');
			expect(warnings[0].title).toBe('Install plugin from external URL');
			expect(warnings[0].description).toContain(
				'https://example.com/plugin.zip'
			);
		});
	});

	describe('embedded plugins', () => {
		it('returns warning severity for vfs resource', () => {
			const context = createContext([
				{
					step: 'installPlugin',
					pluginData: {
						resource: 'vfs',
						path: '/tmp/plugin.zip',
					},
				},
			]);

			const warnings = externalPluginSourceRule.analyze(context);

			expect(warnings).toHaveLength(1);
			expect(warnings[0].severity).toBe('warning');
			expect(warnings[0].title).toBe('Install embedded plugin');
		});

		it('returns warning severity for literal resource', () => {
			const context = createContext([
				{
					step: 'installPlugin',
					pluginData: {
						resource: 'literal',
						contents: 'base64-encoded-plugin-data',
					},
				},
			]);

			const warnings = externalPluginSourceRule.analyze(context);

			expect(warnings).toHaveLength(1);
			expect(warnings[0].severity).toBe('warning');
			expect(warnings[0].title).toBe('Install embedded plugin');
		});
	});

	describe('multiple plugins', () => {
		it('returns warnings for all installPlugin steps', () => {
			const context = createContext([
				{
					step: 'installPlugin',
					pluginData: {
						resource: 'wordpress.org/plugins',
						slug: 'woocommerce',
					},
				},
				{
					step: 'installPlugin',
					pluginData: {
						resource: 'url',
						url: 'https://example.com/custom.zip',
					},
				},
			]);

			const warnings = externalPluginSourceRule.analyze(context);

			expect(warnings).toHaveLength(2);
			expect(warnings[0].severity).toBe('info');
			expect(warnings[1].severity).toBe('warning');
		});
	});

	describe('edge cases', () => {
		it('ignores non-installPlugin steps', () => {
			const context = createContext([
				{ step: 'login' },
				{ step: 'runPHP', code: '<?php echo 1;' },
				{
					step: 'installTheme',
					themeData: { resource: 'url', url: 'x' },
				},
			]);

			const warnings = externalPluginSourceRule.analyze(context);

			expect(warnings).toHaveLength(0);
		});

		it('handles missing pluginData', () => {
			const context = createContext([{ step: 'installPlugin' }]);

			const warnings = externalPluginSourceRule.analyze(context);

			expect(warnings).toHaveLength(0);
		});

		it('handles null steps in array', () => {
			const context = createContext([
				null,
				{
					step: 'installPlugin',
					pluginData: {
						resource: 'wordpress.org/plugins',
						slug: 'test',
					},
				},
			]);

			const warnings = externalPluginSourceRule.analyze(context);

			expect(warnings).toHaveLength(1);
		});

		it('handles empty steps array', () => {
			const context = createContext([]);

			const warnings = externalPluginSourceRule.analyze(context);

			expect(warnings).toHaveLength(0);
		});

		it('handles undefined steps', () => {
			const context: RuleContext = {
				blueprint: {},
				source: {
					type: 'remote-url',
					url: 'https://example.com/bp.json',
				},
			};

			const warnings = externalPluginSourceRule.analyze(context);

			expect(warnings).toHaveLength(0);
		});
	});
});
