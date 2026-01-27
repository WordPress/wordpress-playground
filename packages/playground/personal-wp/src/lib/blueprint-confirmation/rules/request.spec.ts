import { describe, it, expect } from 'vitest';
import { requestRule } from './request';
import type { RuleContext } from '../types';

const createContext = (steps: unknown[]): RuleContext => ({
	blueprint: { steps },
	source: { type: 'remote-url', url: 'https://example.com/bp.json' },
});

describe('requestRule', () => {
	describe('request step', () => {
		it('returns warning severity for request steps', () => {
			const context = createContext([
				{ step: 'request', url: 'https://api.example.com/data' },
			]);

			const warnings = requestRule.analyze(context);

			expect(warnings).toHaveLength(1);
			expect(warnings[0].severity).toBe('warning');
			expect(warnings[0].title).toBe('Make HTTP request');
		});

		it('includes URL in description', () => {
			const context = createContext([
				{ step: 'request', url: 'https://api.example.com/endpoint' },
			]);

			const warnings = requestRule.analyze(context);

			expect(warnings[0].description).toContain(
				'https://api.example.com/endpoint'
			);
		});

		it('includes method in description when specified', () => {
			const context = createContext([
				{
					step: 'request',
					url: 'https://api.example.com/data',
					method: 'POST',
				},
			]);

			const warnings = requestRule.analyze(context);

			expect(warnings[0].description).toContain('POST');
		});

		it('defaults to GET method when not specified', () => {
			const context = createContext([
				{ step: 'request', url: 'https://api.example.com/data' },
			]);

			const warnings = requestRule.analyze(context);

			expect(warnings[0].description).toContain('GET');
		});

		it('handles nested request object format', () => {
			const context = createContext([
				{
					step: 'request',
					request: {
						url: 'https://api.example.com/nested',
						method: 'PUT',
					},
				},
			]);

			const warnings = requestRule.analyze(context);

			expect(warnings[0].description).toContain(
				'https://api.example.com/nested'
			);
			expect(warnings[0].description).toContain('PUT');
		});

		it('truncates long URLs', () => {
			const longUrl = 'https://api.example.com/' + 'x'.repeat(100);
			const context = createContext([{ step: 'request', url: longUrl }]);

			const warnings = requestRule.analyze(context);

			expect(warnings[0].description.length).toBeLessThan(longUrl.length);
			expect(warnings[0].description).toContain('...');
		});

		it('includes step index', () => {
			const context = createContext([
				{ step: 'login' },
				{ step: 'request', url: 'https://api.example.com/data' },
			]);

			const warnings = requestRule.analyze(context);

			expect(warnings[0].stepIndex).toBe(1);
		});
	});

	describe('multiple request steps', () => {
		it('returns warnings for all request steps', () => {
			const context = createContext([
				{ step: 'request', url: 'https://api1.example.com' },
				{ step: 'login' },
				{
					step: 'request',
					url: 'https://api2.example.com',
					method: 'POST',
				},
			]);

			const warnings = requestRule.analyze(context);

			expect(warnings).toHaveLength(2);
			expect(warnings[0].stepIndex).toBe(0);
			expect(warnings[1].stepIndex).toBe(2);
		});
	});

	describe('edge cases', () => {
		it('ignores non-request steps', () => {
			const context = createContext([
				{ step: 'login' },
				{ step: 'runPHP', code: '<?php echo 1;' },
				{ step: 'installPlugin', pluginData: {} },
			]);

			const warnings = requestRule.analyze(context);

			expect(warnings).toHaveLength(0);
		});

		it('handles missing URL property', () => {
			const context = createContext([
				{ step: 'request', method: 'POST' },
			]);

			const warnings = requestRule.analyze(context);

			expect(warnings).toHaveLength(1);
			expect(warnings[0].description).toContain('HTTP');
		});

		it('handles null steps in array', () => {
			const context = createContext([
				null,
				{ step: 'request', url: 'https://api.example.com' },
			]);

			const warnings = requestRule.analyze(context);

			expect(warnings).toHaveLength(1);
		});

		it('handles empty steps array', () => {
			const context = createContext([]);

			const warnings = requestRule.analyze(context);

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

			const warnings = requestRule.analyze(context);

			expect(warnings).toHaveLength(0);
		});
	});
});
