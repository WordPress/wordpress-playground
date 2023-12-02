import { Blueprint, StepDefinition, UrlReference } from '@wp-playground/client';

interface MakeBlueprintOptions {
	php?: string;
	wp?: string;
	landingPage?: string;
	theme?: string;
	importFile?: string;
	plugins?: string[];
	gutenbergPR?: number;
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
			...(typeof options.gutenbergPR === 'number'
				? applyGutenbergPRSteps(options.gutenbergPR)
				: []),
		],
	};
}

function applyGutenbergPRSteps(prNumber: number): StepDefinition[] {
	return [
		{
			step: 'mkdir',
			path: '/wordpress/pr',
		},
		{
			step: 'writeFile',
			path: '/wordpress/pr/pr.zip',
			data: {
				resource: 'url',
				url: `/plugin-proxy?org=WordPress&repo=gutenberg&workflow=Build%20Gutenberg%20Plugin%20Zip&artifact=gutenberg-plugin&pr=${prNumber}`,
				caption: `Downloading Gutenberg PR ${prNumber}`,
			},
			progress: {
				weight: 2,
				caption: `Applying Gutenberg PR ${prNumber}`,
			},
		},
		{
			step: 'unzip',
			zipPath: '/wordpress/pr/pr.zip',
			extractToPath: '/wordpress/pr',
		},
		{
			step: 'installPlugin',
			pluginZipFile: {
				resource: 'vfs',
				path: '/wordpress/pr/gutenberg.zip',
			},
		},
	];
}
