import { describe, it, expect } from 'vitest';
import { runPhpRule } from './run-php';
import type { RuleContext } from '../types';

const createContext = (steps: unknown[]): RuleContext => ({
	blueprint: { steps },
	source: { type: 'remote-url', url: 'https://example.com/bp.json' },
});

describe('runPhpRule', () => {
	describe('safe PHP code', () => {
		it('returns warning severity for simple PHP code without dangerous patterns', () => {
			const context = createContext([
				{ step: 'runPHP', code: '<?php echo "hello";' },
			]);

			const warnings = runPhpRule.analyze(context);

			expect(warnings).toHaveLength(1);
			expect(warnings[0].severity).toBe('warning');
			expect(warnings[0].title).toBe('Execute PHP code');
		});

		it('includes code preview in description', () => {
			const context = createContext([
				{ step: 'runPHP', code: '<?php echo "test";' },
			]);

			const warnings = runPhpRule.analyze(context);

			expect(warnings[0].description).toContain('<?php echo "test";');
		});

		it('truncates long code in description', () => {
			const longCode = '<?php ' + 'x'.repeat(200);
			const context = createContext([{ step: 'runPHP', code: longCode }]);

			const warnings = runPhpRule.analyze(context);

			expect(warnings[0].description.length).toBeLessThan(
				longCode.length
			);
			expect(warnings[0].description).toContain('...');
		});
	});

	describe('dangerous PHP code', () => {
		it('returns danger severity for code with dangerous functions', () => {
			const context = createContext([
				{ step: 'runPHP', code: '<?php system("ls");' },
			]);

			const warnings = runPhpRule.analyze(context);

			const dangerWarning = warnings.find((w) => w.severity === 'danger');
			expect(dangerWarning).toBeDefined();
			expect(dangerWarning?.title).toBe(
				'PHP code with dangerous operations'
			);
		});

		it('returns warning severity for superglobal access', () => {
			const context = createContext([
				{
					step: 'runPHPWithOptions',
					code: '<?php echo $_GET["test"];',
				},
			]);

			const warnings = runPhpRule.analyze(context);

			const warningLevel = warnings.find((w) => w.severity === 'warning');
			expect(warningLevel).toBeDefined();
		});

		it('detects backtick shell execution', () => {
			const context = createContext([
				{ step: 'runPHP', code: '<?php $out = `whoami`;' },
			]);

			const warnings = runPhpRule.analyze(context);

			const dangerWarning = warnings.find((w) => w.severity === 'danger');
			expect(dangerWarning).toBeDefined();
		});
	});

	describe('multiple PHP steps', () => {
		it('returns warnings for all PHP steps', () => {
			const context = createContext([
				{ step: 'runPHP', code: '<?php echo 1;' },
				{ step: 'login' },
				{ step: 'runPHPWithOptions', code: '<?php echo 2;' },
				{ step: 'runPHP', code: '<?php echo 3;' },
			]);

			const warnings = runPhpRule.analyze(context);

			expect(warnings).toHaveLength(3);
			expect(warnings[0].stepIndex).toBe(0);
			expect(warnings[1].stepIndex).toBe(2);
			expect(warnings[2].stepIndex).toBe(3);
		});
	});

	describe('step index tracking', () => {
		it('includes step index', () => {
			const context = createContext([
				{ step: 'login' },
				{ step: 'runPHP', code: '<?php echo 1;' },
			]);

			const warnings = runPhpRule.analyze(context);

			expect(warnings[0].stepIndex).toBe(1);
		});
	});

	describe('edge cases', () => {
		it('ignores non-PHP steps', () => {
			const context = createContext([
				{ step: 'login' },
				{ step: 'installPlugin', pluginData: {} },
				{ step: 'writeFile', path: '/test.txt', data: 'content' },
			]);

			const warnings = runPhpRule.analyze(context);

			expect(warnings).toHaveLength(0);
		});

		it('handles missing code property', () => {
			const context = createContext([{ step: 'runPHP' }]);

			const warnings = runPhpRule.analyze(context);

			expect(warnings).toHaveLength(1);
			expect(warnings[0].description).toContain('PHP code');
		});

		it('handles null steps in array', () => {
			const context = createContext([
				null,
				{ step: 'runPHP', code: '<?php echo 1;' },
			]);

			const warnings = runPhpRule.analyze(context);

			expect(warnings).toHaveLength(1);
		});

		it('handles empty steps array', () => {
			const context = createContext([]);

			const warnings = runPhpRule.analyze(context);

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

			const warnings = runPhpRule.analyze(context);

			expect(warnings).toHaveLength(0);
		});
	});
});
