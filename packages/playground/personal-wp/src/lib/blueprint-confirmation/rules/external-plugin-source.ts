import type { BlueprintRule, BlueprintWarning } from '../types';

/**
 * Analyzes installPlugin steps for external plugin sources.
 *
 * - WordPress.org plugins: info severity (safe, official source)
 * - External URLs: warning severity (untrusted source)
 */
export const externalPluginSourceRule: BlueprintRule = {
	name: 'external-plugin-source',
	analyze: (context) => {
		const warnings: BlueprintWarning[] = [];
		const steps = context.blueprint.steps || [];

		steps.forEach((step, index) => {
			if (!step || typeof step !== 'object') {
				return;
			}

			const stepObj = step as Record<string, unknown>;
			if (stepObj.step !== 'installPlugin') {
				return;
			}

			const pluginData = stepObj.pluginData as
				| Record<string, unknown>
				| undefined;
			if (!pluginData) {
				return;
			}

			const resource = pluginData.resource as string | undefined;
			const slug = pluginData.slug as string | undefined;
			const url = pluginData.url as string | undefined;

			if (resource === 'wordpress.org/plugins' && slug) {
				warnings.push({
					severity: 'info',
					title: `Install plugin "${slug}"`,
					description: `Installs the "${slug}" plugin from WordPress.org`,
					stepIndex: index,
				});
			} else if (resource === 'url' && url) {
				warnings.push({
					severity: 'warning',
					title: 'Install plugin from external URL',
					description: `Installs a plugin from: ${url}`,
					stepIndex: index,
				});
			} else if (resource === 'vfs' || resource === 'literal') {
				warnings.push({
					severity: 'warning',
					title: 'Install embedded plugin',
					description:
						'Installs a plugin embedded in the blueprint',
					stepIndex: index,
				});
			}
		});

		return warnings;
	},
};
