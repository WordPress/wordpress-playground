import { PHP } from '@php-wasm/universal';
import { RecommendedPHPVersion } from '@wp-playground/common';
import { installPlugin } from '../../lib/steps/install-plugin';
import { phpVar } from '@php-wasm/util';
import { PHPRequestHandler } from '@php-wasm/universal';
import { loadNodeRuntime } from '@php-wasm/node';
import { logger } from '@php-wasm/logger';
import {
	getSqliteDriverModule,
	getWordPressModule,
} from '@wp-playground/wordpress-builds';
import { bootWordPressAndRequestHandler } from '@wp-playground/wordpress';

async function zipFiles(
	php: PHP,
	fileName: string,
	files: Record<string, string>
) {
	const zipFileName = 'test.zip';
	const zipFilePath = `/${zipFileName}`;

	await php.run({
		code: `<?php $zip = new ZipArchive();
					 $zip->open("${zipFilePath}", ZIPARCHIVE::CREATE);
					 $files = ${phpVar(files)};
					 foreach($files as $path => $content) {
						$zip->addFromString($path, $content);
					 }
					 $zip->close();
					 `,
	});
	const zip = await php.readFileAsBuffer(zipFilePath);
	php.unlink(zipFilePath);
	return new File([zip], fileName);
}

describe('Blueprint step installPlugin – without a root-level folder', () => {
	it('should install a plugin even when it is zipped directly without a root-level folder', async () => {
		const handler = new PHPRequestHandler({
			phpFactory: async () =>
				new PHP(await loadNodeRuntime(RecommendedPHPVersion)),
			documentRoot: '/wordpress',
		});
		const php = await handler.getPrimaryPhp();

		// Create plugins folder
		const rootPath = php.documentRoot;
		const pluginsPath = `${rootPath}/wp-content/plugins`;
		php.mkdir(pluginsPath);

		// Create test plugin
		const pluginName = 'test-plugin';

		await installPlugin(php, {
			pluginData: await zipFiles(
				php,
				// Note the ZIP filename is different from plugin folder name
				`${pluginName}-0.0.1.zip`,
				{
					'index.php': `/**\n * Plugin Name: Test Plugin`,
				}
			),
			ifAlreadyInstalled: 'overwrite',
			options: {
				activate: false,
			},
		});

		expect(php.fileExists(`${pluginsPath}/${pluginName}-0.0.1`)).toBe(true);
	});
});

describe('Blueprint step installPlugin', () => {
	let php: PHP;
	// Create plugins folder
	let rootPath = '';
	let pluginsPath = '';
	let installedPluginPath = '';
	const pluginName = 'test-plugin';
	const zipFileName = `${pluginName}-0.0.1.zip`;
	beforeEach(async () => {
		const handler = new PHPRequestHandler({
			phpFactory: async () =>
				new PHP(await loadNodeRuntime(RecommendedPHPVersion)),
			documentRoot: '/wordpress',
		});
		php = await handler.getPrimaryPhp();

		rootPath = php.documentRoot;
		pluginsPath = `${rootPath}/wp-content/plugins`;
		php.mkdir(pluginsPath);
		installedPluginPath = `${pluginsPath}/${pluginName}`;
	});

	afterEach(() => {
		php.exit();
	});

	it('should install a plugin', async () => {
		await installPlugin(php, {
			pluginData: await zipFiles(php, zipFileName, {
				[`${pluginName}/index.php`]: `/**\n * Plugin Name: Test Plugin`,
			}),
			ifAlreadyInstalled: 'overwrite',
			options: {
				activate: false,
			},
		});
		expect(php.fileExists(installedPluginPath)).toBe(true);
	});

	it('should install a single PHP file as a plugin', async () => {
		const rawPluginContent = `<?php\n/**\n * Plugin Name: Test Plugin`;
		await installPlugin(php, {
			pluginData: new File(
				[new TextEncoder().encode(rawPluginContent)],
				'test-plugin.php'
			),
			ifAlreadyInstalled: 'overwrite',
			options: {
				activate: false,
			},
		});
		const pluginFilePath = `${pluginsPath}/test-plugin.php`;
		expect(php.fileExists(pluginFilePath)).toBe(true);
		expect(php.readFileAsText(pluginFilePath)).toBe(rawPluginContent);
	});

	it('should throw plugin installation errors by default', async () => {
		await expect(
			installPlugin(php, {
				pluginData: new File(['not a plugin'], 'not-a-plugin.txt'),
			})
		).rejects.toThrow(
			'pluginData looks like a file but does not look like a .zip or .php file.'
		);
	});

	it('should skip plugin installation errors when onError is skip-plugin', async () => {
		const loggerWarnSpy = vi
			.spyOn(logger, 'warn')
			.mockImplementation(() => {});
		try {
			await expect(
				installPlugin(php, {
					pluginData: new File(['not a plugin'], 'not-a-plugin.txt'),
					options: {
						onError: 'skip-plugin',
					},
				})
			).resolves.toBeUndefined();

			expect(loggerWarnSpy).toHaveBeenCalledWith(
				expect.stringContaining(
					'Skipping plugin installation for unknown plugin after failure'
				)
			);
		} finally {
			loggerWarnSpy.mockRestore();
		}
	});

	it('should use humanReadableName when skipping plugin installation errors', async () => {
		const loggerWarnSpy = vi
			.spyOn(logger, 'warn')
			.mockImplementation(() => {});
		try {
			await expect(
				installPlugin(php, {
					pluginData: new File(['not a plugin'], 'not-a-plugin.txt'),
					options: {
						onError: 'skip-plugin',
						humanReadableName: 'Query Monitor Beta',
					},
				})
			).resolves.toBeUndefined();

			expect(loggerWarnSpy).toHaveBeenCalledWith(
				expect.stringContaining(
					'Skipping plugin installation for Query Monitor Beta after failure'
				)
			);
		} finally {
			loggerWarnSpy.mockRestore();
		}
	});

	it('should expose activationOptions during plugin activation', async () => {
		const handler = await bootWordPressAndRequestHandler({
			createPhpRuntime: async () =>
				await loadNodeRuntime(RecommendedPHPVersion),
			siteUrl: 'http://playground-domain/',
			wordPressZip: await getWordPressModule(),
			sqliteIntegrationPluginZip: await getSqliteDriverModule(),
		});
		const wpPhp = await handler.getPrimaryPhp();

		try {
			await installPlugin(wpPhp, {
				pluginData: await zipFiles(wpPhp, zipFileName, {
					[`${pluginName}/index.php`]: `<?php
/**
 * Plugin Name: Test Plugin
 */
register_activation_hook(__FILE__, function() {
	update_option(
		'blueprint_activation_seen',
		get_option('blueprint_activation_' . plugin_basename(__FILE__))
	);
});
`,
				}),
				ifAlreadyInstalled: 'overwrite',
				options: {
					activate: true,
					activationOptions: {
						storeCity: 'Wroclaw',
						enabled: true,
					},
				},
			});

			const response = await wpPhp.run({
				code: `<?php
require '/wordpress/wp-load.php';
echo json_encode(array(
	'seen' => get_option('blueprint_activation_seen'),
	'cleanup' => get_option('blueprint_activation_test-plugin/index.php', 'missing'),
));
`,
			});

			expect(JSON.parse(response.text)).toEqual({
				seen: {
					storeCity: 'Wroclaw',
					enabled: true,
				},
				cleanup: 'missing',
			});
		} finally {
			wpPhp.exit();
			await handler[Symbol.asyncDispose]();
		}
	});

	it('should report missing plugin files when setting activationOptions', async () => {
		const handler = await bootWordPressAndRequestHandler({
			createPhpRuntime: async () =>
				await loadNodeRuntime(RecommendedPHPVersion),
			siteUrl: 'http://playground-domain/',
			wordPressZip: await getWordPressModule(),
			sqliteIntegrationPluginZip: await getSqliteDriverModule(),
		});
		const wpPhp = await handler.getPrimaryPhp();

		try {
			await expect(
				installPlugin(wpPhp, {
					pluginData: {
						name: 'plugin-without-php-file',
						files: {
							'readme.txt': 'Not a plugin file.',
						},
					},
					options: {
						activate: true,
						activationOptions: {
							enabled: true,
						},
					},
				})
			).rejects.toThrow(
				'Could not find plugin file for activation options.'
			);
		} finally {
			wpPhp.exit();
			await handler[Symbol.asyncDispose]();
		}
	});

	it('should install a plugin using the deprecated pluginZipFile option', async () => {
		// @ts-ignore
		await installPlugin(php, {
			pluginZipFile: await zipFiles(php, zipFileName, {
				[`${pluginName}/index.php`]: `/**\n * Plugin Name: Test Plugin`,
			}),
			ifAlreadyInstalled: 'overwrite',
			options: {
				activate: false,
			},
		});
		expect(php.fileExists(installedPluginPath)).toBe(true);
	});

	it('should install a plugin from a directory resource', async () => {
		await installPlugin(php, {
			pluginData: {
				name: pluginName,
				files: {
					'index.php': `/**\n * Plugin Name: Test Plugin`,
				},
			},
			ifAlreadyInstalled: 'overwrite',
			options: {
				activate: false,
			},
		});
		expect(php.fileExists(installedPluginPath)).toBe(true);
	});

	describe('ifAlreadyInstalled option', () => {
		beforeEach(async () => {
			await installPlugin(php, {
				pluginData: await zipFiles(php, zipFileName, {
					[`${pluginName}/index.php`]: `/**\n * Plugin Name: Test Plugin`,
				}),
				ifAlreadyInstalled: 'overwrite',
				options: {
					activate: false,
				},
			});
		});

		it('ifAlreadyInstalled=overwrite should overwrite the plugin if it already exists', async () => {
			// Install the plugin
			await installPlugin(php, {
				pluginData: await zipFiles(php, zipFileName, {
					[`${pluginName}/index.php`]: `/**\n * Plugin Name: A different Plugin`,
				}),
				ifAlreadyInstalled: 'overwrite',
				options: {
					activate: false,
				},
			});
			expect(
				php.readFileAsText(`${installedPluginPath}/index.php`)
			).toContain('Plugin Name: A different Plugin');
		});

		it('ifAlreadyInstalled=skip should skip the plugin if it already exists', async () => {
			// Install the plugin
			await installPlugin(php, {
				pluginData: await zipFiles(php, zipFileName, {
					[`${pluginName}/index.php`]: `/**\n * Plugin Name: A different Plugin`,
				}),
				ifAlreadyInstalled: 'skip',
				options: {
					activate: false,
				},
			});
			expect(
				php.readFileAsText(`${installedPluginPath}/index.php`)
			).toContain('Plugin Name: Test Plugin');
		});

		it('ifAlreadyInstalled=error should throw an error if the plugin already exists', async () => {
			// Install the plugin
			await expect(
				installPlugin(php, {
					pluginData: await zipFiles(php, zipFileName, {
						[`${pluginName}/index.php`]: `/**\n * Plugin Name: A different Plugin`,
					}),
					ifAlreadyInstalled: 'error',
					options: {
						activate: false,
					},
				})
			).rejects.toThrowError();
		});
	});

	describe('targetFolderName option', () => {
		it('should install a plugin to expected path', async () => {
			await installPlugin(php, {
				pluginZipFile: await zipFiles(php, zipFileName, {
					[`unexpected-path/index.php`]: `/**\n * Plugin Name: Test Plugin`,
				}),
				ifAlreadyInstalled: 'overwrite',
				options: {
					activate: false,
					targetFolderName: pluginName,
				},
			});
			expect(php.fileExists(installedPluginPath)).toBe(true);
		});
	});
});
