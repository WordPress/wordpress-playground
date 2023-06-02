// @ts-check
// Note: type annotations allow type checking and IDEs autocompletion

const path = require('path');
const lightCodeTheme = require('prism-react-renderer/themes/github');
const darkCodeTheme = require('prism-react-renderer/themes/dracula');
const typedoc = require('../../../typedoc.js');

/** @type {import('@docusaurus/types').Config} */
const config = {
	title: 'WordPress Playground',
	tagline: 'WordPress in your browser. In 5 seconds.',
	favicon: 'img/favicon.ico',

	// Set the production url of your site here
	url: 'https://wordpress.github.io/',
	// Set the /<baseUrl>/ pathname under which your site is served
	// For GitHub pages deployment, it is often '/<projectName>/'
	baseUrl: '/wordpress-playground/',

	// GitHub pages deployment config.
	// If you aren't using GitHub pages, you don't need these.
	organizationName: 'WordPress', // Usually your GitHub org/user name.
	projectName: 'wordpress-playground', // Usually your repo name.

	onBrokenLinks: 'throw',
	onBrokenMarkdownLinks: 'throw',

	// Even if you don't use internalization, you can use this field to set useful
	// metadata like html lang. For example, if your site is Chinese, you may want
	// to replace "en" with "zh-Hans".
	i18n: {
		defaultLocale: 'en',
		locales: ['en'],
	},
	themes: ['@docusaurus/theme-live-codeblock'],
	plugins: [
		getDocusaurusPluginTypedocApiConfig(),
		[
			'@docusaurus/plugin-ideal-image',
			{
				quality: 70,
				max: 1030, // max resized image's size.
				min: 640, // min resized image's size. if original is lower, use that size.
				steps: 2, // the max number of images generated between min and max (inclusive)
				disableInDev: false,
			},
		],
	],

	presets: [
		[
			'classic',
			/** @type {import('@docusaurus/preset-classic').Options} */
			({
				docs: {
					sidebarPath: require.resolve('./sidebars.js'),
					editUrl:
						'https://github.com/WordPress/wordpress-playground/tree/trunk/packages/docs/site/',

					async sidebarItemsGenerator({
						defaultSidebarItemsGenerator,
						...args
					}) {
						const sidebarItems = await defaultSidebarItemsGenerator(
							args
						);
						return flattenDirectoriesWithSingleFile(sidebarItems);
					},
				},
				theme: {
					customCss: require.resolve('./src/css/custom.css'),
				},
			}),
		],
	],

	themeConfig:
		/** @type {import('@docusaurus/preset-classic').ThemeConfig} */
		({
			navbar: {
				title: 'WordPress Playground',
				logo: {
					alt: 'WordPress Playground',
					src: 'img/wordpress.svg',
				},
				items: [
					{
						type: 'docSidebar',
						sidebarId: 'tutorialSidebar',
						position: 'left',
						label: 'Documentation',
					},
					{
						href: 'https://github.com/WordPress/wordpress-playground',
						label: 'GitHub',
						position: 'right',
					},
					{
						to: 'api',
						label: 'API Reference',
						position: 'left',
					},
					{
						href: 'https://playground.wordpress.net/gutenberg.html',
						label: 'Gutenberg PR Previewer',
						position: 'left',
					},
				],
			},
			footer: {
				style: 'dark',
				links: [
					{
						title: 'Docs',
						items: [
							{
								label: 'Documentation',
								to: '/docs/start-here',
							},
							{
								label: 'API Reference',
								to: '/api',
							},
						],
					},
					{
						title: 'Community',
						items: [
							{
								label: 'GitHub',
								href: 'https://github.com/WordPress/wordpress-playground',
							},
							{
								label: '#meta-playground on Slack',
								href: 'https://make.wordpress.org/chat',
							},
						],
					},
				],
				copyright: `Copyright © ${new Date().getFullYear()} WordPress Playground, Inc. Built with Docusaurus.`,
			},
			prism: {
				theme: lightCodeTheme,
				darkTheme: darkCodeTheme,
			},
		}),
};

module.exports = config;

/**
 * We use `docusaurus-plugin-typedoc-api` which provides a significantly
 * nicer output than `docusaurus-plugin-typedoc`. The API reference is generated
 * as HTML and doesn't go through Markdown which enables superior UX on the web.
 *
 * However, `docusaurus-plugin-typedoc-api` doesn't support the `entryPointStrategy`
 * option which we need to generate the API reference for multiple packages.
 *
 * This function is a workaround for that. It monkeypatches the `typedoc` Application
 * to force the correct `entryPointStrategy`.
 */
function getDocusaurusPluginTypedocApiConfig() {
	const projectRoot = path.join(__dirname, '..', '..', '..');
	const packages = typedoc.entryPoints;

	const TypeDoc = require('typedoc');
	const old = TypeDoc.Application.prototype.bootstrap;
	TypeDoc.Application.prototype.bootstrap = function (options) {
		options.entryPointStrategy = typedoc.entryPointStrategy;
		options.entryPoints = packages.map((entry) =>
			path.join(projectRoot, entry)
		);
		options.plugin = [
			'typedoc-plugin-resolve-crossmodule-references',
			// This plugin somehow doesn't work with docusaurus-plugin-typedoc-api.
			// @TODO: Fix it
			'typedoc-plugin-mdn-links',
		];

		return old.call(this, options);
	};

	return [
		'docusaurus-plugin-typedoc-api',
		{
			projectRoot,
			packages,
			tsconfigName: 'tsconfig.base.json',
			typeDocOptions: typedoc,
		},
	];
}

function flattenDirectoriesWithSingleFile(items) {
	return items.flatMap((item) => {
		if (item.type === 'category' && item.items.length === 1) {
			return item.items[0];
		}
		return item;
	});
}
