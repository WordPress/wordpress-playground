import { PHP } from '@php-wasm/universal';
import { RecommendedPHPVersion } from '@wp-playground/common';
import { installPlugin } from '../../lib/steps/install-plugin';
import { phpVar } from '@php-wasm/util';
import { PHPRequestHandler } from '@php-wasm/universal';
import { loadNodeRuntime } from '@php-wasm/node';
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

	it('should reject single-file plugin names that are not path segments', async () => {
		await expect(
			installPlugin(php, {
				pluginData: new File(['<?php'], '../escape.php'),
				options: {
					activate: false,
				},
			})
		).rejects.toThrow('Plugin filename must be a single path segment.');

		expect(php.fileExists('/wordpress/wp-content/escape.php')).toBe(false);
	});

	it('should reject directory plugin names that are not path segments', async () => {
		await expect(
			installPlugin(php, {
				pluginData: {
					name: '../escape',
					files: {
						'index.php': `/**\n * Plugin Name: Test Plugin`,
					},
				},
				options: {
					activate: false,
				},
			})
		).rejects.toThrow(
			'Plugin directory name must be a single path segment.'
		);

		expect(php.fileExists('/wordpress/wp-content/escape')).toBe(false);
	});

	it('should reject directory plugin file paths that escape the plugin directory', async () => {
		await expect(
			installPlugin(php, {
				pluginData: {
					name: 'test-plugin',
					files: {
						'../escape.php': `/**\n * Plugin Name: Test Plugin`,
					},
				},
				options: {
					activate: false,
				},
			})
		).rejects.toThrow('Plugin file paths must not escape');

		expect(php.fileExists('/wordpress/wp-content/escape.php')).toBe(false);
	});

	it('should reject plugin targetFolderName values that are not path segments', async () => {
		await expect(
			installPlugin(php, {
				pluginData: await zipFiles(php, zipFileName, {
					[`${pluginName}/index.php`]: `/**\n * Plugin Name: Test Plugin`,
				}),
				options: {
					activate: false,
					targetFolderName: 'nested/plugin',
				},
			})
		).rejects.toThrow(
			'Asset target folder name must be a single path segment.'
		);

		expect(php.fileExists(`${pluginsPath}/nested/plugin`)).toBe(false);
	});

	it('should skip installation errors when onError is skip-plugin', async () => {
		await expect(
			installPlugin(php, {
				pluginData: new File(['not a plugin'], 'not-a-plugin.txt'),
				options: {
					onError: 'skip-plugin',
				},
			})
		).resolves.toBeUndefined();
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

		it('should apply ifAlreadyInstalled to directory plugin resources', async () => {
			await installPlugin(php, {
				pluginData: {
					name: pluginName,
					files: {
						'index.php': `/**\n * Plugin Name: Skipped Plugin`,
					},
				},
				ifAlreadyInstalled: 'skip',
				options: {
					activate: false,
				},
			});
			expect(
				php.readFileAsText(`${installedPluginPath}/index.php`)
			).toContain('Plugin Name: Test Plugin');

			await installPlugin(php, {
				pluginData: {
					name: pluginName,
					files: {
						'index.php': `/**\n * Plugin Name: Overwritten Plugin`,
					},
				},
				ifAlreadyInstalled: 'overwrite',
				options: {
					activate: false,
				},
			});
			expect(
				php.readFileAsText(`${installedPluginPath}/index.php`)
			).toContain('Plugin Name: Overwritten Plugin');

			await expect(
				installPlugin(php, {
					pluginData: {
						name: pluginName,
						files: {
							'index.php': `/**\n * Plugin Name: Error Plugin`,
						},
					},
					ifAlreadyInstalled: 'error',
					options: {
						activate: false,
					},
				})
			).rejects.toThrow(/already exists/);
		});

		it('should apply ifAlreadyInstalled to single-file plugin resources', async () => {
			const pluginFilePath = `${pluginsPath}/standalone.php`;

			await installPlugin(php, {
				pluginData: new File(
					['<?php\n/**\n * Plugin Name: Standalone Plugin */'],
					'standalone.php'
				),
				ifAlreadyInstalled: 'overwrite',
				options: {
					activate: false,
				},
			});

			await installPlugin(php, {
				pluginData: new File(
					['<?php\n/**\n * Plugin Name: Skipped Standalone */'],
					'standalone.php'
				),
				ifAlreadyInstalled: 'skip',
				options: {
					activate: false,
				},
			});
			expect(php.readFileAsText(pluginFilePath)).toContain(
				'Plugin Name: Standalone Plugin'
			);

			await installPlugin(php, {
				pluginData: new File(
					['<?php\n/**\n * Plugin Name: Overwritten Standalone */'],
					'standalone.php'
				),
				ifAlreadyInstalled: 'overwrite',
				options: {
					activate: false,
				},
			});
			expect(php.readFileAsText(pluginFilePath)).toContain(
				'Plugin Name: Overwritten Standalone'
			);

			await expect(
				installPlugin(php, {
					pluginData: new File(
						['<?php\n/**\n * Plugin Name: Error Standalone */'],
						'standalone.php'
					),
					ifAlreadyInstalled: 'error',
					options: {
						activate: false,
					},
				})
			).rejects.toThrow(/already exists/);
		});

		it('should reject overwriting a symlinked plugin directory', async () => {
			const outsidePath = '/outside-plugin-target';
			php.rmdir(installedPluginPath, { recursive: true });
			php.mkdir(outsidePath);
			php.writeFile(`${outsidePath}/index.php`, 'keep me');
			php.symlink(outsidePath, installedPluginPath);

			await expect(
				installPlugin(php, {
					pluginData: await zipFiles(php, zipFileName, {
						[`${pluginName}/index.php`]: `/**\n * Plugin Name: Symlink Plugin`,
					}),
					ifAlreadyInstalled: 'overwrite',
					options: {
						activate: false,
					},
				})
			).rejects.toThrow(/symbolic link/);

			expect(php.readFileAsText(`${outsidePath}/index.php`)).toBe(
				'keep me'
			);
		});

		it('should reject skipping a symlinked plugin directory', async () => {
			const outsidePath = '/outside-plugin-target';
			php.rmdir(installedPluginPath, { recursive: true });
			php.mkdir(outsidePath);
			php.writeFile(`${outsidePath}/index.php`, 'keep me');
			php.symlink(outsidePath, installedPluginPath);

			await expect(
				installPlugin(php, {
					pluginData: await zipFiles(php, zipFileName, {
						[`${pluginName}/index.php`]: `/**\n * Plugin Name: Symlink Plugin`,
					}),
					ifAlreadyInstalled: 'skip',
					options: {
						activate: false,
					},
				})
			).rejects.toThrow(/symbolic link/);
		});

		it('should reject overwriting a broken symlinked plugin directory', async () => {
			php.rmdir(installedPluginPath, { recursive: true });
			php.symlink('/missing-plugin-target', installedPluginPath);

			await expect(
				installPlugin(php, {
					pluginData: await zipFiles(php, zipFileName, {
						[`${pluginName}/index.php`]: `/**\n * Plugin Name: Symlink Plugin`,
					}),
					ifAlreadyInstalled: 'overwrite',
					options: {
						activate: false,
					},
				})
			).rejects.toThrow(/symbolic link/);
		});

		it('should reject a symlinked single-file plugin target', async () => {
			const pluginFilePath = `${pluginsPath}/standalone.php`;
			php.writeFile('/outside-standalone.php', 'keep me');
			php.symlink('/outside-standalone.php', pluginFilePath);

			await expect(
				installPlugin(php, {
					pluginData: new File(
						['<?php\n/**\n * Plugin Name: Standalone */'],
						'standalone.php'
					),
					ifAlreadyInstalled: 'skip',
					options: {
						activate: false,
					},
				})
			).rejects.toThrow(/symbolic link/);

			expect(php.readFileAsText('/outside-standalone.php')).toBe(
				'keep me'
			);
		});
	});

	describe('targetFolderName option', () => {
		it('should install a plugin to expected path', async () => {
			// @ts-expect-error pluginZipFile is deprecated but still supported at runtime.
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
