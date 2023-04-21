import { Blueprint, StepDefinition } from '@wp-playground/client';

interface MakeBlueprintOptions {
	php?: string;
	wp?: string;
	landingPage?: string;
	theme?: string;
	plugins?: string[];
}
export function makeBlueprint(options: MakeBlueprintOptions): Blueprint {
	const plugins = options.plugins || [];
	return {
		landingPage: options.landingPage,
		preferredVersions: {
			php: options.php as any,
			wp: options.wp as any,
		},
		steps: [
			{
				step: 'login',
				username: 'admin',
				password: 'password',
			},
			options.theme && {
				step: 'installTheme',
				themeZipFile: {
					resource: 'wordpress.org/themes',
					slug: options.theme,
				},
				progress: { weight: 2 },
			},
			...plugins.map<StepDefinition>((plugin) => ({
				step: 'installPlugin',
				pluginZipFile: {
					resource: 'wordpress.org/plugins',
					slug: plugin,
				},
				progress: { weight: 2 },
			})),
		],
	};
}
