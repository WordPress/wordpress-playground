import { Blueprint, StepDefinition } from '@wp-playground/client';

interface MakeBlueprintOptions {
	php?: string;
	wp?: string;
	login: boolean;
	multisite: boolean;
	phpExtensionBundles?: string[];
	landingPage?: string;
	features?: Blueprint['features'];
	theme?: string;
	plugins?: string[];
	importSite?: string;
	importWxr?: string;
	language?: string;
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
			options.importSite &&
				/^(http(s?)):\/\//i.test(options.importSite) && {
					step: 'importWordPressFiles',
					wordPressFilesZip: {
						resource: 'url',
						url: options.importSite,
					},
				},
			options.multisite && {
				step: 'enableMultisite',
			},
			options.login && {
				step: 'login',
				username: 'admin',
				password: 'password',
			},
			options.importWxr &&
				/^(http(s?)):\/\//i.test(options.importWxr) && {
					step: 'importWxr',
					file: {
						resource: 'url',
						url: options.importWxr,
					},
				},
			options.theme && {
				step: 'installTheme',
				themeZipFile: {
					resource: 'wordpress.org/themes',
					slug: options.theme,
				},
				progress: { weight: 2 },
			},
			options.language && {
				step: 'setSiteLanguage',
				language: options.language,
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
