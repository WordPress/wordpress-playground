import type { BlueprintRule, BlueprintWarning } from '../types';

/**
 * Analyzes runPHP and runPHPWithOptions steps.
 *
 * These steps can execute arbitrary PHP code, which is a high-risk operation.
 * Always returns danger severity.
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
			const codePreview = code
				? code.length > 100
					? code.substring(0, 100) + '...'
					: code
				: 'PHP code';

			warnings.push({
				severity: 'danger',
				title: 'Execute custom PHP code',
				description: `Runs arbitrary PHP code: ${codePreview}`,
				stepIndex: index,
			});
		});

		return warnings;
	},
};
