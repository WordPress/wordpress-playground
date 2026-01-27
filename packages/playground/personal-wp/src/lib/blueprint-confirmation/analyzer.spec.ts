import { describe, it, expect } from 'vitest';
import { analyzeBlueprint } from './analyzer';
import type { RuleContext, BlueprintRule } from './types';

describe('analyzeBlueprint', () => {
	describe('trusted sources', () => {
		it('does not require confirmation for trusted sources', () => {
			const context: RuleContext = {
				blueprint: {
					steps: [{ step: 'runPHP', code: '<?php echo "hello";' }],
				},
				source: {
					type: 'remote-url',
					url: 'https://raw.githubusercontent.com/WordPress/blueprints/my-wordpress/app.json',
				},
			};

			const result = analyzeBlueprint(context);

			expect(result.requiresConfirmation).toBe(false);
			expect(result.isTrustedSource).toBe(true);
		});

		it('still collects warnings for trusted sources', () => {
			const context: RuleContext = {
				blueprint: {
					steps: [{ step: 'runPHP', code: '<?php echo "hello";' }],
				},
				source: {
					type: 'remote-url',
					url: 'https://raw.githubusercontent.com/WordPress/blueprints/main/app.json',
				},
			};

			const result = analyzeBlueprint(context);

			expect(result.isTrustedSource).toBe(true);
			expect(result.warnings.length).toBeGreaterThan(0);
		});

		it('does not require confirmation for type: none', () => {
			const context: RuleContext = {
				blueprint: {
					steps: [
						{
							step: 'installPlugin',
							pluginData: {
								resource: 'wordpress.org/plugins',
								slug: 'hello-dolly',
							},
						},
					],
				},
				source: { type: 'none' },
			};

			const result = analyzeBlueprint(context);

			expect(result.requiresConfirmation).toBe(false);
			expect(result.isTrustedSource).toBe(true);
		});
	});

	describe('untrusted sources', () => {
		it('requires confirmation for external URLs', () => {
			const context: RuleContext = {
				blueprint: {
					steps: [{ step: 'runPHP', code: '<?php echo "hello";' }],
				},
				source: {
					type: 'remote-url',
					url: 'https://untrusted.com/blueprint.json',
				},
			};

			const result = analyzeBlueprint(context);

			expect(result.requiresConfirmation).toBe(true);
			expect(result.isTrustedSource).toBe(false);
		});

		it('requires confirmation for inline-string (hash fragments)', () => {
			const context: RuleContext = {
				blueprint: {
					steps: [{ step: 'login' }],
				},
				source: { type: 'inline-string' },
			};

			const result = analyzeBlueprint(context);

			expect(result.requiresConfirmation).toBe(true);
			expect(result.isTrustedSource).toBe(false);
		});

		it('requires confirmation for data: URLs', () => {
			const context: RuleContext = {
				blueprint: {
					steps: [{ step: 'login' }],
				},
				source: {
					type: 'remote-url',
					url: 'data:application/json;base64,eyJzdGVwcyI6W119',
				},
			};

			const result = analyzeBlueprint(context);

			expect(result.requiresConfirmation).toBe(true);
			expect(result.isTrustedSource).toBe(false);
		});
	});

	describe('warning sorting', () => {
		it('sorts warnings by severity: danger > warning > info', () => {
			const context: RuleContext = {
				blueprint: {
					steps: [
						{
							step: 'installPlugin',
							pluginData: {
								resource: 'wordpress.org/plugins',
								slug: 'hello',
							},
						},
						{ step: 'runPHP', code: '<?php echo 1;' },
						{ step: 'request', url: 'https://example.com' },
					],
				},
				source: {
					type: 'remote-url',
					url: 'https://untrusted.com/bp.json',
				},
			};

			const result = analyzeBlueprint(context);

			const severities = result.warnings.map((w) => w.severity);
			const dangerIndex = severities.indexOf('danger');
			const warningIndex = severities.indexOf('warning');
			const infoIndex = severities.indexOf('info');

			if (dangerIndex !== -1 && warningIndex !== -1) {
				expect(dangerIndex).toBeLessThan(warningIndex);
			}
			if (warningIndex !== -1 && infoIndex !== -1) {
				expect(warningIndex).toBeLessThan(infoIndex);
			}
		});
	});

	describe('custom rules', () => {
		it('accepts custom rules instead of defaults', () => {
			const customRule: BlueprintRule = {
				name: 'custom-rule',
				analyze: () => [
					{
						severity: 'info',
						title: 'Custom warning',
						description: 'From custom rule',
					},
				],
			};

			const context: RuleContext = {
				blueprint: {
					steps: [{ step: 'runPHP', code: '<?php echo 1;' }],
				},
				source: {
					type: 'remote-url',
					url: 'https://untrusted.com/bp.json',
				},
			};

			const result = analyzeBlueprint(context, [customRule]);

			expect(result.warnings).toHaveLength(1);
			expect(result.warnings[0].title).toBe('Custom warning');
		});

		it('returns empty warnings when no rules match', () => {
			const context: RuleContext = {
				blueprint: {
					steps: [{ step: 'login' }],
				},
				source: {
					type: 'remote-url',
					url: 'https://untrusted.com/bp.json',
				},
			};

			const result = analyzeBlueprint(context, []);

			expect(result.warnings).toHaveLength(0);
			expect(result.requiresConfirmation).toBe(true);
		});
	});

	describe('empty blueprints', () => {
		it('handles blueprints with no steps', () => {
			const context: RuleContext = {
				blueprint: {},
				source: {
					type: 'remote-url',
					url: 'https://untrusted.com/bp.json',
				},
			};

			const result = analyzeBlueprint(context);

			expect(result.warnings).toHaveLength(0);
			expect(result.requiresConfirmation).toBe(true);
		});

		it('handles blueprints with empty steps array', () => {
			const context: RuleContext = {
				blueprint: { steps: [] },
				source: {
					type: 'remote-url',
					url: 'https://untrusted.com/bp.json',
				},
			};

			const result = analyzeBlueprint(context);

			expect(result.warnings).toHaveLength(0);
		});
	});
});
