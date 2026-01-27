import { describe, it, expect } from 'vitest';
import { wpCliRule } from './wp-cli';
import type { RuleContext } from '../types';

// Type assertion allows testing edge cases with malformed/incomplete step data
const createContext = (steps: unknown[]): RuleContext =>
	({
		blueprint: { steps },
		source: { type: 'remote-url', url: 'https://example.com/bp.json' },
	}) as RuleContext;

describe('wpCliRule', () => {
	describe('wp-cli step', () => {
		it('returns warning severity for wp-cli commands', () => {
			const context = createContext([
				{ step: 'wp-cli', command: 'plugin list' },
			]);

			const warnings = wpCliRule.analyze(context);

			expect(warnings).toHaveLength(1);
			expect(warnings[0].severity).toBe('warning');
			expect(warnings[0].title).toBe('Run WP-CLI command');
		});

		it('includes command in description (string format)', () => {
			const context = createContext([
				{
					step: 'wp-cli',
					command: 'option update siteurl "https://example.com"',
				},
			]);

			const warnings = wpCliRule.analyze(context);

			expect(warnings[0].description).toContain(
				'wp option update siteurl'
			);
		});

		it('includes command in description (array format)', () => {
			const context = createContext([
				{
					step: 'wp-cli',
					command: ['user', 'create', 'admin', 'admin@example.com'],
				},
			]);

			const warnings = wpCliRule.analyze(context);

			expect(warnings[0].description).toContain('wp user create admin');
		});

		it('truncates long commands', () => {
			const longCommand =
				'option update very_long_option_name ' + 'x'.repeat(100);
			const context = createContext([
				{ step: 'wp-cli', command: longCommand },
			]);

			const warnings = wpCliRule.analyze(context);

			expect(warnings[0].description.length).toBeLessThan(
				longCommand.length + 20
			);
			expect(warnings[0].description).toContain('...');
		});

		it('includes step index', () => {
			const context = createContext([
				{ step: 'login' },
				{ step: 'wp-cli', command: 'cache flush' },
			]);

			const warnings = wpCliRule.analyze(context);

			expect(warnings[0].stepIndex).toBe(1);
		});
	});

	describe('multiple wp-cli steps', () => {
		it('returns warnings for all wp-cli steps', () => {
			const context = createContext([
				{ step: 'wp-cli', command: 'plugin activate woocommerce' },
				{ step: 'login' },
				{ step: 'wp-cli', command: 'rewrite flush' },
			]);

			const warnings = wpCliRule.analyze(context);

			expect(warnings).toHaveLength(2);
			expect(warnings[0].stepIndex).toBe(0);
			expect(warnings[1].stepIndex).toBe(2);
		});
	});

	describe('edge cases', () => {
		it('ignores non-wp-cli steps', () => {
			const context = createContext([
				{ step: 'login' },
				{ step: 'runPHP', code: '<?php echo 1;' },
				{ step: 'installPlugin', pluginData: {} },
			]);

			const warnings = wpCliRule.analyze(context);

			expect(warnings).toHaveLength(0);
		});

		it('handles missing command property', () => {
			const context = createContext([{ step: 'wp-cli' }]);

			const warnings = wpCliRule.analyze(context);

			expect(warnings).toHaveLength(1);
			expect(warnings[0].description).toContain('WP-CLI command');
		});

		it('handles null steps in array', () => {
			const context = createContext([
				null,
				{ step: 'wp-cli', command: 'cache flush' },
			]);

			const warnings = wpCliRule.analyze(context);

			expect(warnings).toHaveLength(1);
		});

		it('handles empty steps array', () => {
			const context = createContext([]);

			const warnings = wpCliRule.analyze(context);

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

			const warnings = wpCliRule.analyze(context);

			expect(warnings).toHaveLength(0);
		});
	});
});
