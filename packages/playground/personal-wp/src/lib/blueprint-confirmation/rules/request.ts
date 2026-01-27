import type { BlueprintRule, BlueprintWarning } from '../types';

/**
 * Analyzes request steps that make HTTP requests.
 *
 * HTTP requests can send data to external servers or fetch potentially
 * malicious content. Always returns warning severity.
 */
export const requestRule: BlueprintRule = {
	name: 'request',
	analyze: (context) => {
		const warnings: BlueprintWarning[] = [];
		const steps = context.blueprint.steps || [];

		steps.forEach((step, index) => {
			if (!step || typeof step !== 'object') {
				return;
			}

			const stepObj = step as Record<string, unknown>;
			if (stepObj.step !== 'request') {
				return;
			}

			const request = stepObj.request as Record<string, unknown> | undefined;
			const url = (request?.url as string) || (stepObj.url as string) || '';
			const method =
				(request?.method as string) ||
				(stepObj.method as string) ||
				'GET';

			let description: string;
			if (url) {
				const urlPreview =
					url.length > 60 ? url.substring(0, 60) + '...' : url;
				description = `Makes ${method} request to: ${urlPreview}`;
			} else {
				description = `Makes an HTTP ${method} request`;
			}

			warnings.push({
				severity: 'warning',
				title: 'Make HTTP request',
				description,
				stepIndex: index,
			});
		});

		return warnings;
	},
};
