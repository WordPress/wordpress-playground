import { describe, expect, it } from 'vitest';
import { collectBlueprintBundleResourcePaths } from './blueprint-bundle-resource-paths';

describe('collectBlueprintBundleResourcePaths', () => {
	it('collects v1 bundled resource paths', () => {
		expect(
			Array.from(
				collectBlueprintBundleResourcePaths({
					steps: [
						{
							step: 'installPlugin',
							pluginData: {
								resource: 'bundled',
								path: 'plugins/plugin.zip',
							},
						},
						{
							step: 'installTheme',
							themeData: {
								resource: 'bundled',
								path: 'themes\\theme.zip',
							},
						},
					],
				})
			).sort()
		).toEqual(['/plugins/plugin.zip', '/themes\\theme.zip']);
	});

	it('collects v2 execution-context paths that carry bundle files', () => {
		const paths = Array.from(
			collectBlueprintBundleResourcePaths({
				version: 2,
				landingPage: '/wp-admin/',
				activeTheme: { source: './themes/active-theme.zip' },
				themes: [
					'/themes/secondary-theme.zip',
					'.\\themes\\windows-theme.zip',
				],
				plugins: [
					'jetpack',
					'./plugins/query-monitor.zip',
					{ source: '/plugins/woocommerce.zip' },
				],
				muPlugins: ['./mu-plugins/requests-proxy.php'],
				postTypes: {
					book: './post-types/book.json',
				},
				fonts: {
					openSans: './fonts/open-sans.woff2',
					collection: {
						font_families: [
							{
								font_family_settings: {
									fontFamily: 'Open Sans',
									fontFace: [
										{
											src: './fonts/open-sans-bold.woff2',
										},
									],
								},
							},
						],
					},
				},
				media: ['./media/logo.png', { source: '/media/brochure.pdf' }],
				content: [{ type: 'wxr', source: ['./content/site.wxr'] }],
				additionalStepsAfterExecution: [
					{ step: 'installPlugin', source: './plugins/late.zip' },
					{
						step: 'importContent',
						content: [
							{ type: 'wxr', source: './content/late.wxr' },
						],
					},
					{
						step: 'importMedia',
						media: ['./media/late-logo.png'],
					},
					{ step: 'runPHP', code: './scripts/setup.php' },
					{ step: 'runSQL', source: './sql/import.sql' },
					{ step: 'unzip', zipFile: './archives/data.zip' },
					{
						step: 'writeFiles',
						files: {
							'wp-content/mu-plugins/late.php':
								'./mu-plugins/late.php',
						},
					},
				],
			})
		).sort();

		expect(paths).toEqual([
			'/archives/data.zip',
			'/content/late.wxr',
			'/content/site.wxr',
			'/fonts/open-sans-bold.woff2',
			'/fonts/open-sans.woff2',
			'/media/brochure.pdf',
			'/media/late-logo.png',
			'/media/logo.png',
			'/mu-plugins/late.php',
			'/mu-plugins/requests-proxy.php',
			'/plugins/late.zip',
			'/plugins/query-monitor.zip',
			'/plugins/woocommerce.zip',
			'/post-types/book.json',
			'/scripts/setup.php',
			'/sql/import.sql',
			'/themes/active-theme.zip',
			'/themes/secondary-theme.zip',
		]);
	});

	it('does not rewrite backslashes into path separators', () => {
		expect(
			Array.from(
				collectBlueprintBundleResourcePaths({
					version: 2,
					plugins: [
						// Backslashes are valid filename bytes in the POSIX-style
						// bundle filesystem, not path separators.
						'.\\plugins\\query-monitor.zip',
					],
					additionalStepsAfterExecution: [
						{
							step: 'installPlugin',
							pluginData: {
								resource: 'bundled',
								path: 'plugins\\..\\secret.zip',
							},
						},
					],
				})
			)
		).toEqual(['/plugins\\..\\secret.zip']);
	});

	it('normalizes v2 dot segments into bundle paths', () => {
		expect(
			Array.from(
				collectBlueprintBundleResourcePaths({
					version: 2,
					plugins: [
						'./../secret.zip',
						'./plugins/../secret.zip',
						'/../secret.zip',
					],
				})
			)
		).toEqual(['/secret.zip']);
	});

	it('normalizes v1 dot segments into bundle paths', () => {
		expect(
			Array.from(
				collectBlueprintBundleResourcePaths({
					steps: [
						{
							step: 'installPlugin',
							pluginData: {
								resource: 'bundled',
								path: '../secret.zip',
							},
						},
						{
							step: 'installPlugin',
							pluginData: {
								resource: 'bundled',
								path: 'plugins/../secret.zip',
							},
						},
						{
							step: 'installPlugin',
							pluginData: {
								resource: 'bundled',
								path: '/plugins/../../secret.zip',
							},
						},
					],
				})
			)
		).toEqual(['/secret.zip']);
	});
});
