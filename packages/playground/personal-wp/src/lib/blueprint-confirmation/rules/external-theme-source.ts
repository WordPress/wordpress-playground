import type { BlueprintRule, BlueprintWarning } from '../types';

/**
 * Analyzes installTheme steps for external theme sources.
 *
 * - WordPress.org themes: info severity (safe, official source)
 * - External URLs: warning severity (untrusted source)
 */
export const externalThemeSourceRule: BlueprintRule = {
	name: 'external-theme-source',
	analyze: (context) => {
		const warnings: BlueprintWarning[] = [];
		const steps = context.blueprint.steps || [];

		steps.forEach((step, index) => {
			if (!step || typeof step !== 'object') {
				return;
			}

			const stepObj = step as Record<string, unknown>;
			if (stepObj.step !== 'installTheme') {
				return;
			}

			const themeData = stepObj.themeData as
				| Record<string, unknown>
				| undefined;
			if (!themeData) {
				return;
			}

			const resource = themeData.resource as string | undefined;
			const slug = themeData.slug as string | undefined;
			const url = themeData.url as string | undefined;

			if (resource === 'wordpress.org/themes' && slug) {
				warnings.push({
					severity: 'info',
					title: `Install theme "${slug}"`,
					description: `Installs the "${slug}" theme from WordPress.org`,
					stepIndex: index,
				});
			} else if (resource === 'url' && url) {
				warnings.push({
					severity: 'warning',
					title: 'Install theme from external URL',
					description: `Installs a theme from: ${url}`,
					stepIndex: index,
				});
			} else if (resource === 'vfs' || resource === 'literal') {
				warnings.push({
					severity: 'warning',
					title: 'Install embedded theme',
					description: 'Installs a theme embedded in the blueprint',
					stepIndex: index,
				});
			}
		});

		return warnings;
	},
};
