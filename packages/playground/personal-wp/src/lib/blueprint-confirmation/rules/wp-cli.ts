import type { BlueprintRule, BlueprintWarning } from '../types';

/**
 * Analyzes wp-cli steps.
 *
 * WP-CLI commands can perform various administrative operations.
 * Always returns warning severity as these can modify site settings.
 */
export const wpCliRule: BlueprintRule = {
	name: 'wp-cli',
	analyze: (context) => {
		const warnings: BlueprintWarning[] = [];
		const steps = context.blueprint.steps || [];

		steps.forEach((step, index) => {
			if (!step || typeof step !== 'object') {
				return;
			}

			const stepObj = step as Record<string, unknown>;
			if (stepObj.step !== 'wp-cli') {
				return;
			}

			const command = stepObj.command as string | string[] | undefined;
			const commandStr = Array.isArray(command)
				? command.join(' ')
				: command || 'WP-CLI command';

			const commandPreview =
				commandStr.length > 80
					? commandStr.substring(0, 80) + '...'
					: commandStr;

			warnings.push({
				severity: 'warning',
				title: 'Run WP-CLI command',
				description: `Executes: wp ${commandPreview}`,
				stepIndex: index,
			});
		});

		return warnings;
	},
};
