import { describe, it, expect } from 'vitest';
import { externalThemeSourceRule } from './external-theme-source';
import type { RuleContext } from '../types';

// Type assertion allows testing edge cases with malformed/incomplete step data
const createContext = (steps: unknown[]): RuleContext =>
	({
		blueprint: { steps },
		source: { type: 'remote-url', url: 'https://example.com/bp.json' },
	}) as RuleContext;

describe('externalThemeSourceRule', () => {
	describe('wordpress.org themes', () => {
		it('returns info severity for wordpress.org themes', () => {
			const context = createContext([
				{
					step: 'installTheme',
					themeData: {
						resource: 'wordpress.org/themes',
						slug: 'twentytwentyfour',
					},
				},
			]);

			const warnings = externalThemeSourceRule.analyze(context);

			expect(warnings).toHaveLength(1);
			expect(warnings[0].severity).toBe('info');
			expect(warnings[0].title).toBe('Install theme "twentytwentyfour"');
			expect(warnings[0].description).toContain('WordPress.org');
		});

		it('includes step index in warning', () => {
			const context = createContext([
				{ step: 'login' },
				{
					step: 'installTheme',
					themeData: {
						resource: 'wordpress.org/themes',
						slug: 'astra',
					},
				},
			]);

			const warnings = externalThemeSourceRule.analyze(context);

			expect(warnings[0].stepIndex).toBe(1);
		});
	});

	describe('external URL themes', () => {
		it('returns warning severity for URL resource', () => {
			const context = createContext([
				{
					step: 'installTheme',
					themeData: {
						resource: 'url',
						url: 'https://example.com/theme.zip',
					},
				},
			]);

			const warnings = externalThemeSourceRule.analyze(context);

			expect(warnings).toHaveLength(1);
			expect(warnings[0].severity).toBe('warning');
			expect(warnings[0].title).toBe('Install theme from external URL');
			expect(warnings[0].description).toContain(
				'https://example.com/theme.zip'
			);
		});
	});

	describe('embedded themes', () => {
		it('returns warning severity for vfs resource', () => {
			const context = createContext([
				{
					step: 'installTheme',
					themeData: {
						resource: 'vfs',
						path: '/tmp/theme.zip',
					},
				},
			]);

			const warnings = externalThemeSourceRule.analyze(context);

			expect(warnings).toHaveLength(1);
			expect(warnings[0].severity).toBe('warning');
			expect(warnings[0].title).toBe('Install embedded theme');
		});

		it('returns warning severity for literal resource', () => {
			const context = createContext([
				{
					step: 'installTheme',
					themeData: {
						resource: 'literal',
						contents: 'base64-encoded-theme-data',
					},
				},
			]);

			const warnings = externalThemeSourceRule.analyze(context);

			expect(warnings).toHaveLength(1);
			expect(warnings[0].severity).toBe('warning');
			expect(warnings[0].title).toBe('Install embedded theme');
		});
	});

	describe('multiple themes', () => {
		it('returns warnings for all installTheme steps', () => {
			const context = createContext([
				{
					step: 'installTheme',
					themeData: {
						resource: 'wordpress.org/themes',
						slug: 'twentytwentyfour',
					},
				},
				{
					step: 'installTheme',
					themeData: {
						resource: 'url',
						url: 'https://example.com/custom-theme.zip',
					},
				},
			]);

			const warnings = externalThemeSourceRule.analyze(context);

			expect(warnings).toHaveLength(2);
			expect(warnings[0].severity).toBe('info');
			expect(warnings[1].severity).toBe('warning');
		});
	});

	describe('edge cases', () => {
		it('ignores non-installTheme steps', () => {
			const context = createContext([
				{ step: 'login' },
				{ step: 'runPHP', code: '<?php echo 1;' },
				{
					step: 'installPlugin',
					pluginData: { resource: 'url', url: 'x' },
				},
			]);

			const warnings = externalThemeSourceRule.analyze(context);

			expect(warnings).toHaveLength(0);
		});

		it('handles missing themeData', () => {
			const context = createContext([{ step: 'installTheme' }]);

			const warnings = externalThemeSourceRule.analyze(context);

			expect(warnings).toHaveLength(0);
		});

		it('handles null steps in array', () => {
			const context = createContext([
				null,
				{
					step: 'installTheme',
					themeData: {
						resource: 'wordpress.org/themes',
						slug: 'test',
					},
				},
			]);

			const warnings = externalThemeSourceRule.analyze(context);

			expect(warnings).toHaveLength(1);
		});

		it('handles empty steps array', () => {
			const context = createContext([]);

			const warnings = externalThemeSourceRule.analyze(context);

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

			const warnings = externalThemeSourceRule.analyze(context);

			expect(warnings).toHaveLength(0);
		});
	});
});
