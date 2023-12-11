import { Blueprint, StepDefinition, UrlReference } from '@wp-playground/client';

interface MakeBlueprintOptions {
	php?: string;
	wp?: string;
	login: boolean;
	phpExtensionBundles?: string[];
	landingPage?: string;
	features?: Blueprint['features'];
	theme?: string;
	importFile?: string;
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
		phpExtensionBundles: options.phpExtensionBundles as any,
		features: options.features,
		steps: [
			...(options.importFile &&
			/^(http(s?)):\/\//i.test(options.importFile)
				? [
						{
							step: 'importFile',
							file: {
								resource: 'url',
								url: options.importFile,
							} as UrlReference,
						},
				  ]
				: []),
			options.login && {
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
