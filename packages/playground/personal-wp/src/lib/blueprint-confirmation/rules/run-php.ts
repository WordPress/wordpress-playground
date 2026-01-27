import type { BlueprintRule, BlueprintWarning } from '../types';
import {
	analyzePhpCode,
	groupFindingsBySeverity,
} from '../php-analyzer/analyzer';

/**
 * Analyzes runPHP and runPHPWithOptions steps.
 *
 * Uses a tokenizer-based PHP analyzer to detect:
 * - Dangerous function calls (eval, exec, curl, etc.)
 * - Variable function calls (dynamic code execution)
 * - Superglobal access (user input handling)
 * - Backtick shell execution
 * - Suspicious string patterns
 */
export const runPhpRule: BlueprintRule = {
	name: 'run-php',
	analyze: (context) => {
		const warnings: BlueprintWarning[] = [];
		const steps = context.blueprint.steps || [];

		steps.forEach((step, index) => {
			if (!step || typeof step !== 'object') {
				return;
			}

			const stepObj = step as Record<string, unknown>;
			if (
				stepObj.step !== 'runPHP' &&
				stepObj.step !== 'runPHPWithOptions'
			) {
				return;
			}

			const code = stepObj.code as string | undefined;
			if (!code) {
				warnings.push({
					severity: 'warning',
					title: 'Execute PHP code',
					description:
						'Runs PHP code (code not available for analysis)',
					stepIndex: index,
				});
				return;
			}

			// Analyze the PHP code using tokenizer
			const findings = analyzePhpCode(code);
			const grouped = groupFindingsBySeverity(findings);

			// Create warnings for each severity level
			if (grouped.danger.length > 0) {
				const descriptions = grouped.danger
					.map(
						(f) => `• ${f.description} (${f.name}, line ${f.line})`
					)
					.join('\n');
				warnings.push({
					severity: 'danger',
					title: 'PHP code with dangerous operations',
					description: descriptions,
					stepIndex: index,
				});
			}

			if (grouped.warning.length > 0) {
				const descriptions = grouped.warning
					.map(
						(f) => `• ${f.description} (${f.name}, line ${f.line})`
					)
					.join('\n');
				warnings.push({
					severity: 'warning',
					title: 'PHP code with risky operations',
					description: descriptions,
					stepIndex: index,
				});
			}

			if (grouped.info.length > 0) {
				const descriptions = grouped.info
					.map(
						(f) => `• ${f.description} (${f.name}, line ${f.line})`
					)
					.join('\n');
				warnings.push({
					severity: 'info',
					title: 'PHP code operations',
					description: descriptions,
					stepIndex: index,
				});
			}

			// If no specific findings, still note that arbitrary code is being run
			if (findings.length === 0) {
				const codePreview =
					code.length > 100 ? code.substring(0, 100) + '...' : code;
				warnings.push({
					severity: 'warning',
					title: 'Execute PHP code',
					description: `Runs PHP code: ${codePreview}`,
					stepIndex: index,
				});
			}
		});

		return warnings;
	},
};
