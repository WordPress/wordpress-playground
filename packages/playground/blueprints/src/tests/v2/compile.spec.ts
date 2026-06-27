import { describe, expect, it, vi } from 'vitest';
import { RecommendedPHPVersion } from '@wp-playground/common';
import { LatestSupportedPHPVersion } from '@php-wasm/universal';
import { loadNodeRuntime } from '@php-wasm/node';
import type { StreamedFile } from '@php-wasm/stream-compression';
import {
	getSqliteDriverModule,
	getWordPressModule,
	LatestMinifiedWordPressVersion,
} from '@wp-playground/wordpress-builds';
import { bootWordPressAndRequestHandler } from '@wp-playground/wordpress';
import {
	blueprintV2ToBlueprintV1,
	compileBlueprintV2,
	createBlueprintV2ExecutionPlan,
	hasBlueprintV2WordPressZipReference,
	InvalidBlueprintV2Error,
	resolveBlueprintV2RuntimeConfiguration,
	resolveBlueprintV2WordPressSource,
	runBlueprintV2Steps,
	UnsupportedBlueprintV2FeatureError,
	upgradeBlueprintV1ToV2,
	validateBlueprintV2,
} from '../../lib/v2/compile';
import type { BlueprintV1Declaration } from '../../lib/v1/types';
import type { BlueprintV2Declaration } from '../../lib/v2/blueprint-v2-declaration';

describe('Blueprint v2 TypeScript compiler', () => {
	it('rejects unknown top-level fields with path-specific errors', () => {
		expect(
			validateBlueprintV2({
				version: 2,
				steps: [],
			})
		).toEqual({
			valid: false,
			errors: [
				{
					path: '/',
					message: 'has unexpected property "steps"',
				},
			],
		});
	});

	it('validates step discriminators and required fields', () => {
		expect(
			validateBlueprintV2({
				version: 2,
				additionalStepsAfterExecution: [
					{ step: 'mkdir' },
					{ step: 'unknownStep' },
				],
			})
		).toEqual({
			valid: false,
			errors: [
				{
					path: '/additionalStepsAfterExecution/0',
					message: 'must have required property "path"',
				},
				{
					path: '/additionalStepsAfterExecution/1/step',
					message: 'unknown step "unknownStep"',
				},
			],
		});
	});

	it('rejects invalid field types instead of silently dropping them', () => {
		expect(
			validateBlueprintV2({
				version: 2,
				$schema: 123,
				siteOptions: {
					siteUrl: 'https://example.com',
				},
				plugins: 'akismet',
				additionalStepsAfterExecution: [
					{
						step: 'mkdir',
						path: 123,
					},
				],
			})
		).toEqual({
			valid: false,
			errors: [
				{
					path: '/$schema',
					message: 'must be a URL or execution-context path',
				},
				{
					path: '/siteOptions/siteUrl',
					message: 'must not be declared in siteOptions',
				},
				{
					path: '/plugins',
					message: 'must be an array',
				},
				{
					path: '/additionalStepsAfterExecution/0/path',
					message: 'must be a string',
				},
			],
		});
	});

	it('rejects incomplete data references and escaping execution-context paths', () => {
		const result = validateBlueprintV2({
			version: 2,
			media: [
				{
					filename: 'logo.png',
				},
				'./../secret.png',
			],
			muPlugins: [
				{
					directoryName: 'mu',
				},
			],
		});

		expect(result.valid).toBe(false);
		if (!result.valid) {
			expect(result.errors).toEqual(
				expect.arrayContaining([
					{
						path: '/media/0',
						message: 'must have required property "content"',
					},
					{
						path: '/media/1',
						message: 'must be a URL or execution-context path',
					},
					{
						path: '/muPlugins/0',
						message: 'must have required property "files"',
					},
				])
			);
		}
	});

	it('rejects unknown v2 properties that would otherwise be ignored', () => {
		const result = validateBlueprintV2({
			version: 2,
			plugins: [
				{
					source: 'akismet',
					targetFolderName: 'wrong-key',
					activationOptions: {},
				},
			],
			media: [
				{
					source: './assets/logo.png',
					unknown: true,
				},
			],
			content: [
				{
					type: 'wxr',
					source: './content.xml',
					importSiteSettings: true,
				},
			],
			additionalStepsAfterExecution: [
				{
					step: 'runPHP',
					code: {
						filename: 'script.php',
						content: '<?php',
						contents: '<?php',
					},
					progress: {
						caption: 'Ignored',
					},
				},
				{
					step: 'writeFiles',
					files: {
						'/wp-content/plugins/demo': {
							gitRepository:
								'https://github.com/example/demo.git',
							path: 'legacy-path-key',
						},
					},
				},
			],
		});

		expect(result.valid).toBe(false);
		if (!result.valid) {
			expect(result.errors).toEqual(
				expect.arrayContaining([
					{
						path: '/plugins/0',
						message: 'has unexpected property "targetFolderName"',
					},
					{
						path: '/media/0',
						message: 'has unexpected property "unknown"',
					},
					{
						path: '/content/0',
						message: 'has unexpected property "importSiteSettings"',
					},
					{
						path: '/additionalStepsAfterExecution/0',
						message: 'has unexpected property "progress"',
					},
					{
						path: '/additionalStepsAfterExecution/0/code',
						message: 'has unexpected property "contents"',
					},
					{
						path: '/additionalStepsAfterExecution/1/files/~1wp-content~1plugins~1demo',
						message: 'has unexpected property "path"',
					},
				])
			);
		}
	});

	it('rejects parent-directory traversal in v2 path fields', () => {
		const result = validateBlueprintV2({
			version: 2,
			additionalStepsAfterExecution: [
				{
					step: 'mkdir',
					path: '../tmp',
				},
				{
					step: 'rm',
					path: '/wordpress/../tmp/file',
				},
				{
					step: 'rmdir',
					path: 'site:../cache',
				},
				{
					step: 'cp',
					fromPath: 'wp-content/../secrets.php',
					toPath: 'wp-content/uploads/file.php',
				},
				{
					step: 'mv',
					fromPath: 'wp-content/uploads/file.php',
					toPath: '../file.php',
				},
				{
					step: 'unzip',
					zipFile: {
						filename: 'archive.zip',
						content: 'zip',
					},
					extractToPath: '/wordpress/../plugins',
				},
				{
					step: 'writeFiles',
					files: {
						'/wordpress/../tmp/file.txt': {
							filename: 'file.txt',
							content: 'file',
						},
					},
				},
			],
		});

		expect(result.valid).toBe(false);
		if (!result.valid) {
			expect(result.errors).toEqual(
				expect.arrayContaining([
					{
						path: '/additionalStepsAfterExecution/0/path',
						message: 'must not contain parent directory segments',
					},
					{
						path: '/additionalStepsAfterExecution/1/path',
						message: 'must not contain parent directory segments',
					},
					{
						path: '/additionalStepsAfterExecution/2/path',
						message: 'must not contain parent directory segments',
					},
					{
						path: '/additionalStepsAfterExecution/3/fromPath',
						message: 'must not contain parent directory segments',
					},
					{
						path: '/additionalStepsAfterExecution/4/toPath',
						message: 'must not contain parent directory segments',
					},
					{
						path: '/additionalStepsAfterExecution/5/extractToPath',
						message: 'must not contain parent directory segments',
					},
					{
						path: '/additionalStepsAfterExecution/6/files/~1wordpress~1..~1tmp~1file.txt',
						message: 'must not contain parent directory segments',
					},
				])
			);
		}

		expect(() =>
			createBlueprintV2ExecutionPlan({
				version: 2,
				additionalStepsAfterExecution: [
					{
						step: 'mkdir',
						path: '../tmp',
					},
				],
			} as unknown as BlueprintV2Declaration)
		).toThrow('must not contain parent directory segments');
	});

	it('rejects path traversal in data reference names and install target names', () => {
		const result = validateBlueprintV2({
			version: 2,
			muPlugins: [
				{
					filename: '',
					content: '<?php',
				},
				{
					filename: '../escape.php',
					content: '<?php',
				},
				{
					directoryName: '.',
					files: {
						'index.php': '<?php',
					},
				},
				{
					directoryName: 'nested/escape',
					files: {
						'index.php': '<?php',
						'': '<?php',
						'.': '<?php',
						'nested/escape.php': '<?php',
						'nested\\escape.php': '<?php',
						nested: {
							directoryName: '..',
							files: {
								'index.php': '<?php',
							},
						},
					},
				},
			],
			plugins: [
				{
					source: 'akismet',
					targetDirectoryName: '../plugins',
					ifAlreadyInstalled: 'replace',
				},
				{
					source: 'akismet',
					targetDirectoryName: '',
				},
			],
			themes: [
				{
					source: 'twentytwentyfour',
					targetDirectoryName: 'theme/escape',
				},
			],
			activeTheme: {
				source: 'twentytwentyfour',
				targetDirectoryName: '..',
			},
		});

		expect(result.valid).toBe(false);
		if (!result.valid) {
			expect(result.errors).toEqual(
				expect.arrayContaining([
					{
						path: '/muPlugins/0/filename',
						message: 'must be a directory name, not a path',
					},
					{
						path: '/muPlugins/1/filename',
						message: 'must be a directory name, not a path',
					},
					{
						path: '/muPlugins/2/directoryName',
						message: 'must be a directory name, not a path',
					},
					{
						path: '/muPlugins/3/directoryName',
						message: 'must be a directory name, not a path',
					},
					{
						path: '/muPlugins/3/files/',
						message: 'must be a file or directory name, not a path',
					},
					{
						path: '/muPlugins/3/files/.',
						message: 'must be a file or directory name, not a path',
					},
					{
						path: '/muPlugins/3/files/nested~1escape.php',
						message: 'must be a file or directory name, not a path',
					},
					{
						path: '/muPlugins/3/files/nested\\escape.php',
						message: 'must be a file or directory name, not a path',
					},
					{
						path: '/muPlugins/3/files/nested',
						message: 'has unexpected property "directoryName"',
					},
					{
						path: '/plugins/0/targetDirectoryName',
						message: 'must be a directory name, not a path',
					},
					{
						path: '/plugins/0/ifAlreadyInstalled',
						message: 'must be "overwrite", "skip", or "error"',
					},
					{
						path: '/plugins/1/targetDirectoryName',
						message: 'must be a directory name, not a path',
					},
					{
						path: '/themes/0/targetDirectoryName',
						message: 'must be a directory name, not a path',
					},
					{
						path: '/activeTheme/targetDirectoryName',
						message: 'must be a directory name, not a path',
					},
				])
			);
		}
	});

	it('rejects non-scalar defineConstants values', () => {
		const result = validateBlueprintV2({
			version: 2,
			additionalStepsAfterExecution: [
				{
					step: 'defineConstants',
					constants: {
						GOOD: 'yes',
						BAD: {
							nested: true,
						},
					},
				},
			],
		});

		expect(result.valid).toBe(false);
		if (!result.valid) {
			expect(result.errors).toEqual(
				expect.arrayContaining([
					{
						path: '/additionalStepsAfterExecution/0/constants/BAD',
						message: 'must be a string, number, or boolean',
					},
				])
			);
		}
	});

	it('rejects directory data references in file-only v2 fields during validation', () => {
		const gitDirectory = {
			gitRepository: 'https://github.com/WordPress/wordpress-playground',
			pathInRepository: 'packages/playground',
		};
		const result = validateBlueprintV2({
			version: 2,
			media: [
				{
					source: gitDirectory,
				},
			],
			content: [
				{
					type: 'wxr',
					source: gitDirectory,
				},
			],
			additionalStepsAfterExecution: [
				{
					step: 'runPHP',
					code: gitDirectory,
				},
				{
					step: 'runSQL',
					source: gitDirectory,
				},
				{
					step: 'unzip',
					zipFile: gitDirectory,
					extractToPath: '/wordpress/wp-content',
				},
			],
		});

		expect(result.valid).toBe(false);
		if (!result.valid) {
			expect(result.errors).toEqual(
				expect.arrayContaining([
					{
						path: '/media/0/source',
						message: 'must reference a file, not a directory',
					},
					{
						path: '/content/0/source',
						message: 'must reference a file, not a directory',
					},
					{
						path: '/additionalStepsAfterExecution/0/code',
						message: 'must reference a file, not a directory',
					},
					{
						path: '/additionalStepsAfterExecution/1/source',
						message: 'must reference a file, not a directory',
					},
					{
						path: '/additionalStepsAfterExecution/2/zipFile',
						message: 'must reference a file, not a directory',
					},
				])
			);
		}
	});

	it('validates schema-defined metadata, application options, constants, users, and roles', () => {
		expect(
			validateBlueprintV2({
				version: 2,
				blueprintMeta: {
					name: 'Demo',
					authors: ['wordpress'],
					homepage: 'https://example.com',
					tags: ['demo'],
				},
				applicationOptions: {
					'wordpress-playground': {
						landingPage: '/wp-admin/',
						login: {
							username: 'admin',
							password: 'password',
						},
						networkAccess: true,
					},
				},
				constants: {
					WP_DEBUG: true,
					WP_MEMORY_LIMIT: '256M',
				},
				users: [
					{
						username: 'editor',
						email: 'editor@example.com',
						role: 'editor',
						meta: {
							first_name: 'Ed',
						},
					},
				],
				roles: [
					{
						name: 'reviewer',
						capabilities: {
							read: 'true',
						},
					},
				],
			})
		).toEqual({ valid: true });

		const result = validateBlueprintV2({
			version: 2,
			blueprintMeta: {
				homepage: '/relative',
			},
			applicationOptions: {
				'wordpress-playground': {
					login: {
						username: 'admin',
					},
					networkAccess: 'yes',
				},
				unknown: {},
			},
			constants: {
				WP_DEBUG: { enabled: true },
			},
			users: [
				{
					username: 'editor',
					email: 42,
					role: 'editor',
				},
			],
			roles: [
				{
					name: 'reviewer',
					capabilities: {
						read: true,
					},
				},
			],
		});

		expect(result.valid).toBe(false);
		if (!result.valid) {
			expect(result.errors).toEqual(
				expect.arrayContaining([
					{
						path: '/blueprintMeta/homepage',
						message: 'must be an HTTP or HTTPS URL',
					},
					{
						path: '/applicationOptions',
						message: 'has unexpected property "unknown"',
					},
					{
						path: '/applicationOptions/wordpress-playground/login',
						message: 'must have required property "password"',
					},
					{
						path: '/applicationOptions/wordpress-playground/networkAccess',
						message: 'must be a boolean',
					},
					{
						path: '/constants/WP_DEBUG',
						message: 'must be a string, number, or boolean',
					},
					{
						path: '/users/0',
						message: 'must have required property "meta"',
					},
					{
						path: '/users/0/email',
						message: 'must be a string',
					},
					{
						path: '/roles/0/capabilities/read',
						message: 'must be a string',
					},
				])
			);
		}
	});

	it('accepts public Blueprint v2 schema examples for theme, mu-plugin, and WXR shapes', () => {
		expect(
			validateBlueprintV2({
				version: 2,
				activeTheme: {
					source: 'https://github.com/richtabor/kanso/archive/refs/heads/main.zip',
					targetDirectoryName: 'kanso',
					importStarterContent: true,
				},
				themes: [
					'stylish-press-theme',
					'adventurer@4.6.0',
					{
						source: 'https://github.com/richtabor/kanso/archive/refs/heads/main.zip',
						targetDirectoryName: 'kanso',
					},
				],
				muPlugins: [
					{
						filename: 'addFilter-0.php',
						content:
							"<?php add_action( 'requests-requests.before_request', function( &$url ) { $url = 'https://playground.wordpress.net/cors-proxy.php?' . $url; } );",
					},
				],
				content: [
					{
						type: 'wxr',
						source: 'https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/stylish-press/woo-products.wxr',
					},
					{
						type: 'wxr',
						source: 'https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/stylish-press/site-content.wxr',
						urlsMode: 'rewrite',
						staticAssets: 'hotlink',
						importUsers: false,
						importComments: false,
					},
				],
			})
		).toEqual({ valid: true });
	});

	it('creates a PHP-toolkit-compatible execution plan order', () => {
		const plan = createBlueprintV2ExecutionPlan({
			version: 2,
			constants: { WP_DEBUG: true },
			siteOptions: {
				blogname: 'Blueprint site',
				siteUrl: 'https://ignored.example',
			},
			muPlugins: [
				{
					filename: 'demo-mu.php',
					content: '<?php add_filter("the_title", "trim");',
				},
			],
			themes: ['twentytwentyfour'],
			activeTheme: 'twentytwentyfive',
			plugins: ['akismet@5.3'],
			siteLanguage: 'pl_PL',
			additionalStepsAfterExecution: [
				{
					step: 'writeFiles',
					files: {
						'wp-content/uploads/demo.txt': {
							filename: 'demo.txt',
							content: 'Hello',
						},
					},
				},
				{
					step: 'runSQL',
					source: {
						filename: 'query.sql',
						content: 'SELECT 1;',
					},
				},
				{
					step: 'wp-cli',
					command: 'wp option get blogname',
				},
			],
		} as BlueprintV2Declaration);

		expect(plan.map((step) => step.step)).toEqual([
			'defineWpConfigConsts',
			'setSiteOptions',
			'writeFile',
			'installTheme',
			'installTheme',
			'installPlugin',
			'setSiteLanguage',
			'writeFile',
			'runSql',
			'wp-cli',
		]);
		expect(plan[1].options).toEqual({ blogname: 'Blueprint site' });
		expect(plan[2]).toMatchObject({
			path: '/wordpress/wp-content/mu-plugins/demo-mu.php',
		});
		expect(plan[5]).toMatchObject({
			pluginData: {
				resource: 'url',
				url: 'https://downloads.wordpress.org/plugin/akismet.5.3.zip',
			},
			options: {
				activate: true,
			},
		});
		expect(plan[7]).toMatchObject({
			path: '/wordpress/wp-content/uploads/demo.txt',
		});
	});

	it('lowers writeFiles data references for inline, URL, execution-context, and directory sources', () => {
		const plan = createBlueprintV2ExecutionPlan({
			version: 2,
			additionalStepsAfterExecution: [
				{
					step: 'writeFiles',
					files: {
						'site:/wp-content/uploads/readme.txt': {
							filename: 'readme.txt',
							content: 'Inline file',
						},
						'/wp-content/uploads/remote.txt':
							'https://example.com/remote.txt',
						'wp-content/uploads/context.txt':
							'./assets/context.txt',
						'/wp-content/plugins/demo': {
							directoryName: 'demo',
							files: {
								'index.php': '<?php',
								inc: {
									files: {
										'bootstrap.php': '<?php',
									},
								},
							},
						},
						'/wp-content/plugins/from-git': {
							gitRepository:
								'https://github.com/example/plugin.git',
							ref: 'main',
							pathInRepository: 'plugin',
						},
					},
				},
			],
		} as BlueprintV2Declaration);

		expect(plan).toEqual([
			{
				step: 'writeFile',
				path: '/wordpress/wp-content/uploads/readme.txt',
				data: {
					resource: 'literal',
					name: 'readme.txt',
					contents: 'Inline file',
				},
			},
			{
				step: 'writeFile',
				path: '/wordpress/wp-content/uploads/remote.txt',
				data: {
					resource: 'url',
					url: 'https://example.com/remote.txt',
				},
			},
			{
				step: 'writeFile',
				path: '/wordpress/wp-content/uploads/context.txt',
				data: {
					resource: 'bundled',
					path: 'assets/context.txt',
				},
			},
			{
				step: 'writeFiles',
				writeToPath: '/wordpress/wp-content/plugins/demo',
				filesTree: {
					resource: 'literal:directory',
					name: 'demo',
					files: {
						'index.php': '<?php',
						inc: {
							'bootstrap.php': '<?php',
						},
					},
				},
			},
			{
				step: 'writeFiles',
				writeToPath: '/wordpress/wp-content/plugins/from-git',
				filesTree: {
					resource: 'git:directory',
					url: 'https://github.com/example/plugin.git',
					ref: 'main',
					path: 'plugin',
				},
			},
		]);
	});

	it('passes plugin activation options and skip errors to installPlugin', () => {
		const plan = createBlueprintV2ExecutionPlan({
			version: 2,
			plugins: [
				{
					source: 'woocommerce',
					activationOptions: {
						storeCity: 'Wroclaw',
					},
					onError: 'skip-plugin',
					ifAlreadyInstalled: 'skip',
					targetDirectoryName: 'woocommerce-dev',
					humanReadableName: 'WooCommerce Dev',
				},
			],
		} as BlueprintV2Declaration);

		expect(plan).toMatchObject([
			{
				step: 'installPlugin',
				pluginData: {
					resource: 'wordpress.org/plugins',
					slug: 'woocommerce',
				},
				ifAlreadyInstalled: 'skip',
				options: {
					activate: true,
					activationOptions: {
						storeCity: 'Wroclaw',
					},
					onError: 'skip-plugin',
					targetFolderName: 'woocommerce-dev',
					humanReadableName: 'WooCommerce Dev',
				},
			},
		]);
	});

	it('lowers single-file plugin execution-context paths as bundled plugin files', () => {
		const plan = createBlueprintV2ExecutionPlan({
			version: 2,
			plugins: ['./query-monitor.php'],
		} as BlueprintV2Declaration);

		expect(plan).toMatchObject([
			{
				step: 'installPlugin',
				pluginData: {
					resource: 'bundled',
					path: 'query-monitor.php',
				},
				options: {
					activate: true,
				},
			},
		]);
	});

	it('rejects plugin sources that cannot resolve to installable plugin files', () => {
		const result = validateBlueprintV2({
			version: 2,
			plugins: [
				'./readme.txt',
				{ filename: 'readme.txt', content: 'Readme' },
				{ source: 'https://example.com/readme.txt' },
				{
					source: {
						filename: 'script.js',
						content: 'console.log("not a plugin");',
					},
				},
			],
		});

		expect(result.valid).toBe(false);
		if (!result.valid) {
			expect(result.errors).toEqual(
				expect.arrayContaining([
					{
						path: '/plugins/0',
						message:
							'must reference a .zip or .php plugin file, directory, Git repository, or plugin slug',
					},
					{
						path: '/plugins/1',
						message:
							'must reference a .zip or .php plugin file, directory, Git repository, or plugin slug',
					},
					{
						path: '/plugins/2/source',
						message:
							'must reference a .zip or .php plugin file, directory, Git repository, or plugin slug',
					},
					{
						path: '/plugins/3/source',
						message:
							'must reference a .zip or .php plugin file, directory, Git repository, or plugin slug',
					},
				])
			);
		}
	});

	it('lowers native v2 Git repository plugin URLs as Git directory zips', () => {
		const plan = createBlueprintV2ExecutionPlan({
			version: 2,
			plugins: ['https://github.com/example/demo-plugin'],
		} as BlueprintV2Declaration);

		expect(plan).toMatchObject([
			{
				step: 'installPlugin',
				pluginData: {
					resource: 'zip',
					inner: {
						resource: 'git:directory',
						url: 'https://github.com/example/demo-plugin',
						ref: 'HEAD',
					},
				},
			},
		]);
	});

	it('preserves v1 Git repository plugin strings during v2 migration', () => {
		const migrated = upgradeBlueprintV1ToV2({
			plugins: ['https://gitlab.com/example/group/demo-plugin/'],
		} as BlueprintV1Declaration);
		const plan = createBlueprintV2ExecutionPlan(migrated);

		expect(plan).toMatchObject([
			{
				step: 'installPlugin',
				pluginData: {
					resource: 'zip',
					inner: {
						resource: 'git:directory',
						url: 'https://gitlab.com/example/group/demo-plugin',
						ref: 'HEAD',
					},
				},
			},
		]);
	});

	it('preserves v1 absolute paths outside WordPress during v2 lowering', () => {
		const migrated = upgradeBlueprintV1ToV2({
			steps: [
				{
					step: 'writeFile',
					path: '/tmp/staged.txt',
					data: 'staged',
				},
				{
					step: 'mkdir',
					path: '/tmp/folder',
				},
				{
					step: 'cp',
					fromPath: '/tmp/staged.txt',
					toPath: '/tmp/copied.txt',
				},
				{
					step: 'mv',
					fromPath: '/tmp/copied.txt',
					toPath: '/tmp/moved.txt',
				},
				{
					step: 'unzip',
					zipFile: {
						resource: 'literal',
						name: 'archive.zip',
						contents: '',
					},
					extractToPath: '/tmp/unzipped',
				},
				{
					step: 'rm',
					path: '/tmp/moved.txt',
				},
			],
		} as BlueprintV1Declaration);

		expect(validateBlueprintV2(migrated)).toEqual({ valid: true });
		expect(createBlueprintV2ExecutionPlan(migrated)).toMatchObject([
			{
				step: 'writeFile',
				path: '/tmp/staged.txt',
			},
			{
				step: 'mkdir',
				path: '/tmp/folder',
			},
			{
				step: 'cp',
				fromPath: '/tmp/staged.txt',
				toPath: '/tmp/copied.txt',
			},
			{
				step: 'mv',
				fromPath: '/tmp/copied.txt',
				toPath: '/tmp/moved.txt',
			},
			{
				step: 'unzip',
				extractToPath: '/tmp/unzipped',
			},
			{
				step: 'rm',
				path: '/tmp/moved.txt',
			},
		]);
	});

	it('rejects internal v1 absolute path markers in public v2 declarations', () => {
		const blueprint = {
			version: 2,
			additionalStepsAfterExecution: [
				{
					step: 'mkdir',
					path: 'v1-absolute:/tmp/public-marker',
				},
			],
		} as BlueprintV2Declaration;

		expect(validateBlueprintV2(blueprint)).toEqual({
			valid: false,
			errors: [
				{
					path: '/additionalStepsAfterExecution/0/path',
					message: 'must not use internal v1 absolute path markers',
				},
			],
		});
		expect(() => createBlueprintV2ExecutionPlan(blueprint)).toThrow(
			/must not use internal v1 absolute path markers/
		);
	});

	it('passes theme target directory and progress name options to installTheme', () => {
		const plan = createBlueprintV2ExecutionPlan({
			version: 2,
			themes: [
				{
					source: 'twentytwentyfive',
					importStarterContent: true,
					targetDirectoryName: 'tt5-dev',
					onError: 'skip-theme',
					humanReadableName: 'Twenty Twenty-Five Dev',
				},
			],
		} as BlueprintV2Declaration);

		expect(plan).toMatchObject([
			{
				step: 'installTheme',
				themeData: {
					resource: 'wordpress.org/themes',
					slug: 'twentytwentyfive',
				},
				options: {
					activate: false,
					importStarterContent: true,
					targetFolderName: 'tt5-dev',
					onError: 'skip-theme',
					humanReadableName: 'Twenty Twenty-Five Dev',
				},
			},
		]);
	});

	it('passes additional installTheme onError through to the v1 step', () => {
		const blueprint = {
			version: 2,
			additionalStepsAfterExecution: [
				{
					step: 'installTheme',
					source: 'twentytwentyfive',
					active: true,
					onError: 'skip-theme',
				},
			],
		} as BlueprintV2Declaration;

		expect(validateBlueprintV2(blueprint).valid).toBe(true);
		expect(createBlueprintV2ExecutionPlan(blueprint)).toMatchObject([
			{
				step: 'installTheme',
				themeData: {
					resource: 'wordpress.org/themes',
					slug: 'twentytwentyfive',
				},
				options: {
					activate: true,
					onError: 'skip-theme',
				},
			},
		]);
	});

	it('installs font declarations before later declarative steps', () => {
		const plan = createBlueprintV2ExecutionPlan({
			version: 2,
			fonts: {
				'open-sans': {
					filename: 'open-sans.woff2',
					content: 'fontdata',
				},
				brand: {
					font_families: [
						{
							font_family_settings: {
								name: 'Brand Sans',
								slug: 'brand-sans',
								fontFamily: 'Brand Sans',
								fontFace: [
									{
										fontFamily: 'Brand Sans',
										fontWeight: '400',
										fontDisplay: 'swap',
										src: './wp-content/uploads/fonts/brand-sans.woff',
									},
								],
							},
							categories: ['sans-serif'],
						},
					],
				},
			},
			siteLanguage: 'pl_PL',
		} as BlueprintV2Declaration);

		expect(plan.map((step) => step.step)).toEqual([
			'writeFile',
			'writeFile',
			'runPHPWithOptions',
			'setSiteLanguage',
		]);
		expect(plan[0]).toMatchObject({
			path: '/tmp/blueprint-font-fonts-open-sans-source-open-sans.woff2',
			data: {
				resource: 'literal',
				name: 'open-sans.woff2',
				contents: 'fontdata',
			},
		});
		expect(plan[1]).toMatchObject({
			data: {
				resource: 'bundled',
				path: 'wp-content/uploads/fonts/brand-sans.woff',
			},
		});
		const collections = JSON.parse(
			plan[2].options.env.BLUEPRINT_FONT_COLLECTIONS
		);
		const files = JSON.parse(plan[2].options.env.BLUEPRINT_FONT_FILES);
		expect(collections[0]).toMatchObject({
			slug: 'open-sans',
			name: 'Open Sans',
			font_families: [
				{
					font_family_settings: {
						name: 'Open Sans',
						slug: 'open-sans',
						fontFamily: 'Open Sans',
						fontFace: [
							{
								fontFamily: 'Open Sans',
								src: 'blueprint-font-file:font-0',
							},
						],
					},
				},
			],
		});
		expect(
			collections[1].font_families[0].font_family_settings.fontFace[0]
		).toMatchObject({
			fontFamily: 'Brand Sans',
			src: 'blueprint-font-file:font-1',
		});
		expect(files['blueprint-font-file:font-0']).toMatchObject({
			filename: 'open-sans.woff2',
		});
		expect(plan[2].options.code).toContain('wp_font_family');
		expect(plan[2].options.code).toContain(
			'blueprint-font-collections.php'
		);
	});

	it('validates font declarations', () => {
		expect(
			validateBlueprintV2({
				version: 2,
				fonts: {
					brand: {
						font_families: [
							{
								font_family_settings: {
									name: 'Brand Sans',
									slug: 'brand-sans',
									fontFamily: 'Brand Sans',
									fontFace: [
										{
											fontFamily: 'Brand Sans',
											fontWeight: 400,
											fontDisplay: 'swap',
											src: [
												'./wp-content/uploads/fonts/brand.woff2',
												{
													filename: 'brand-bold.otf',
													content: 'fontdata',
												},
											],
										},
									],
								},
								categories: ['sans-serif'],
							},
						],
					},
				},
			})
		).toEqual({ valid: true });

		const result = validateBlueprintV2({
			version: 2,
			fonts: {
				bad: {
					font_families: [
						{
							font_family_settings: {
								name: 'Bad Font',
								slug: 'bad-font',
								fontFamily: 'Bad Font',
								fontFace: [
									{
										fontFamily: 'Bad Font',
										fontDisplay: 'never',
										src: './wp-content/uploads/fonts/bad.txt',
									},
								],
								extra: true,
							},
						},
					],
				},
				directory: {
					directoryName: 'fonts',
					files: {
						'font.woff2': 'fontdata',
					},
				},
			},
		});

		expect(result.valid).toBe(false);
		if (!result.valid) {
			expect(result.errors).toEqual(
				expect.arrayContaining([
					{
						path: '/fonts/bad/font_families/0/font_family_settings',
						message: 'has unexpected property "extra"',
					},
					{
						path: '/fonts/bad/font_families/0/font_family_settings/fontFace/0/fontDisplay',
						message:
							'must be "auto", "block", "fallback", "swap", or "optional"',
					},
					{
						path: '/fonts/bad/font_families/0/font_family_settings/fontFace/0/src',
						message:
							'must reference a .woff2, .woff, .ttf, or .otf file',
					},
					{
						path: '/fonts/directory',
						message: 'must reference a font file, not a directory',
					},
				])
			);
		}
	});

	it('accepts WordPress ZIP URLs as wordpressVersion data references', () => {
		expect(
			resolveBlueprintV2RuntimeConfiguration({
				version: 2,
				wordpressVersion: 'https://example.com/wordpress.zip',
			} as BlueprintV2Declaration).wpVersion
		).toBe('https://example.com/wordpress.zip');
		expect(
			resolveBlueprintV2RuntimeConfiguration({
				version: 2,
				wordpressVersion:
					'https://example.com/plugin-proxy.php?artifact=wordpress-build-123',
			} as BlueprintV2Declaration).wpVersion
		).toBe(
			'https://example.com/plugin-proxy.php?artifact=wordpress-build-123'
		);
	});

	it('rejects invalid wordpressVersion data references before resolving sources', async () => {
		const invalidGitRepository = {
			version: 2,
			wordpressVersion: {
				gitRepository: 'https://',
				pathInRepository: 'wordpress',
			},
		};
		const escapingGitPath = {
			version: 2,
			wordpressVersion: {
				gitRepository: 'https://github.com/wordpress/wordpress.git',
				pathInRepository: '../wordpress',
			},
		};

		expect(validateBlueprintV2(invalidGitRepository).valid).toBe(false);
		expect(validateBlueprintV2(escapingGitPath).valid).toBe(false);
		await expect(
			resolveBlueprintV2WordPressSource(
				invalidGitRepository as unknown as BlueprintV2Declaration
			)
		).rejects.toThrow(/wordpressVersion/);
		await expect(
			hasBlueprintV2WordPressZipReference(
				escapingGitPath as unknown as BlueprintV2Declaration
			)
		).rejects.toThrow(/pathInRepository/);
	});

	it('accepts WordPress release channel aliases in runtime configuration', () => {
		for (const wordpressVersion of ['beta', 'trunk', 'nightly'] as const) {
			expect(
				resolveBlueprintV2RuntimeConfiguration({
					version: 2,
					wordpressVersion,
				} as BlueprintV2Declaration).wpVersion
			).toBe(wordpressVersion);
		}
	});

	it('resolves WordPress ZIP URLs through the data-reference resolver', async () => {
		const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
			new Response('zip', {
				status: 200,
				headers: {
					'content-type': 'application/zip',
				},
			})
		);

		try {
			const source = await resolveBlueprintV2WordPressSource({
				version: 2,
				wordpressVersion: 'https://example.com/wordpress.zip',
			} as BlueprintV2Declaration);

			expect(source.wpVersion).toBe('https://example.com/wordpress.zip');
			expect(await source.wordPressZip?.text()).toBe('zip');
			expect(fetchSpy).toHaveBeenCalled();
		} finally {
			fetchSpy.mockRestore();
		}
	});

	it('detects WordPress ZIP references without resolving them', async () => {
		const fetchSpy = vi.spyOn(globalThis, 'fetch');

		try {
			await expect(
				hasBlueprintV2WordPressZipReference({
					version: 2,
					wordpressVersion: 'https://example.com/wordpress.zip',
				} as unknown as BlueprintV2Declaration)
			).resolves.toBe(true);
			await expect(
				hasBlueprintV2WordPressZipReference({
					version: 2,
					wordpressVersion: '6.4',
				} as unknown as BlueprintV2Declaration)
			).resolves.toBe(false);
			expect(fetchSpy).not.toHaveBeenCalled();
		} finally {
			fetchSpy.mockRestore();
		}
	});

	it('resolves inline and bundled wordpressVersion ZIP data references', async () => {
		await expect(
			resolveBlueprintV2WordPressSource({
				version: 2,
				wordpressVersion: {
					filename: 'wordpress.zip',
					content: 'zip',
				},
			} as unknown as BlueprintV2Declaration)
		).resolves.toMatchObject({
			wpVersion: 'custom-wordpress',
			wordPressZip: expect.any(File),
		});

		const bundled = await resolveBlueprintV2WordPressSource(
			{
				version: 2,
				wordpressVersion: './wordpress.zip',
			} as BlueprintV2Declaration,
			{
				streamBundledFile: async (path) =>
					new File([`bundle:${path}`], 'wordpress.zip') as any,
			}
		);

		expect(bundled.wpVersion).toBe('custom-wordpress');
		expect(await bundled.wordPressZip?.text()).toBe('bundle:wordpress.zip');

		const directorySource = await resolveBlueprintV2WordPressSource({
			version: 2,
			wordpressVersion: {
				directoryName: 'wordpress',
				files: {
					'index.php': '<?php',
				},
			},
		} as BlueprintV2Declaration);

		expect(directorySource.wpVersion).toBe('custom-wordpress');
		expect(directorySource.wordPressZip?.name).toBe('custom-wordpress.zip');
		expect(
			validateBlueprintV2({
				version: 2,
				wordpressVersion: {
					directoryName: 'wordpress',
					files: {},
				},
			})
		).toEqual({ valid: true });

		expect(
			validateBlueprintV2({
				version: 2,
				wordpressVersion: './wordpress.tar.gz',
			})
		).toEqual({
			valid: false,
			errors: [
				{
					path: '/wordpressVersion',
					message: 'must reference a WordPress ZIP file',
				},
			],
		});

		expect(
			validateBlueprintV2({
				version: 2,
				wordpressVersion: {
					preferred: '6.5',
				},
			})
		).toEqual({
			valid: false,
			errors: [
				{
					path: '/wordpressVersion',
					message: 'must have required property "min"',
				},
			],
		});

		expect(
			validateBlueprintV2({
				version: 2,
				phpVersion: {
					minimum: '8.2',
				},
			})
		).toEqual({
			valid: false,
			errors: [
				{
					path: '/phpVersion',
					message: 'has unexpected property "minimum"',
				},
			],
		});
	});

	it('resolves runtime configuration from v2 declarations', () => {
		expect(
			resolveBlueprintV2RuntimeConfiguration({
				version: 2,
				phpVersion: { recommended: '8.2' },
				wordpressVersion: {
					min: '6.4',
					preferred: '6.5',
				},
				applicationOptions: {
					'wordpress-playground': {
						networkAccess: false,
					},
				},
				constants: {
					SCRIPT_DEBUG: true,
				},
				additionalStepsAfterExecution: [
					{
						step: 'wp-cli',
						command: 'wp option get blogname',
					},
				],
			} as unknown as BlueprintV2Declaration)
		).toEqual({
			phpVersion: '8.2',
			wpVersion: '6.5',
			intl: false,
			networking: false,
			constants: { SCRIPT_DEBUG: true },
			extraLibraries: ['wp-cli'],
		});
	});

	it('preserves v1 runtime-only features during v2 migration', () => {
		const migrated = upgradeBlueprintV1ToV2({
			features: {
				intl: true,
				networking: false,
			},
			extraLibraries: ['wp-cli'],
		} as BlueprintV1Declaration);

		expect(validateBlueprintV2(migrated)).toEqual({ valid: true });
		expect(JSON.parse(JSON.stringify(migrated))).toEqual({
			version: 2,
			applicationOptions: {
				'wordpress-playground': {
					networkAccess: false,
				},
			},
		});
		expect(resolveBlueprintV2RuntimeConfiguration(migrated)).toMatchObject({
			intl: true,
			networking: false,
			extraLibraries: ['wp-cli'],
		});
		expect(blueprintV2ToBlueprintV1(migrated)).toMatchObject({
			features: {
				intl: true,
				networking: false,
			},
			extraLibraries: ['wp-cli'],
		});
	});

	it('resolves WordPress version constraints to the latest bundled compatible version', () => {
		expect(
			resolveBlueprintV2RuntimeConfiguration({
				version: 2,
				wordpressVersion: {
					min: '6.3',
				},
			} as BlueprintV2Declaration).wpVersion
		).toBe(LatestMinifiedWordPressVersion);

		expect(
			resolveBlueprintV2RuntimeConfiguration({
				version: 2,
				wordpressVersion: {
					min: '6.3',
					max: '6.8',
				},
			} as BlueprintV2Declaration).wpVersion
		).toBe('6.8');

		expect(
			resolveBlueprintV2RuntimeConfiguration({
				version: 2,
				wordpressVersion: {
					min: '6.3',
					max: '6.8',
					recommended: 'latest',
				},
			} as BlueprintV2Declaration).wpVersion
		).toBe('6.8');

		expect(
			resolveBlueprintV2RuntimeConfiguration({
				version: 2,
				wordpressVersion: {
					min: '6.3',
					max: '6.8',
					preferred: 'latest',
				},
			} as BlueprintV2Declaration).wpVersion
		).toBe('6.8');
	});

	it('defaults v2 network access to false', () => {
		expect(
			resolveBlueprintV2RuntimeConfiguration({
				version: 2,
			} as unknown as BlueprintV2Declaration)
		).toMatchObject({
			phpVersion: '8.0',
			networking: false,
		});
	});

	it('resolves phpVersion latest constraints to the latest supported PHP version', () => {
		expect(
			resolveBlueprintV2RuntimeConfiguration({
				version: 2,
				phpVersion: 'latest',
			} as BlueprintV2Declaration).phpVersion
		).toBe(LatestSupportedPHPVersion);

		expect(
			resolveBlueprintV2RuntimeConfiguration({
				version: 2,
				phpVersion: {
					min: '8.0',
					recommended: 'latest',
				},
			} as BlueprintV2Declaration).phpVersion
		).toBe(LatestSupportedPHPVersion);

		expect(
			resolveBlueprintV2RuntimeConfiguration({
				version: 2,
				phpVersion: 'next',
			} as BlueprintV2Declaration).phpVersion
		).toBe('next');
	});

	it('throws on runtime version constraints Playground cannot satisfy', () => {
		expect(() =>
			resolveBlueprintV2RuntimeConfiguration({
				version: 2,
				phpVersion: '9.0',
			} as unknown as BlueprintV2Declaration)
		).toThrow(InvalidBlueprintV2Error);

		expect(() =>
			resolveBlueprintV2RuntimeConfiguration({
				version: 2,
				phpVersion: {
					min: 'next',
				},
			} as unknown as BlueprintV2Declaration)
		).toThrow(InvalidBlueprintV2Error);

		expect(() =>
			resolveBlueprintV2RuntimeConfiguration({
				version: 2,
				phpVersion: {
					recommended: 'next',
				},
			} as unknown as BlueprintV2Declaration)
		).toThrow(InvalidBlueprintV2Error);

		expect(() =>
			resolveBlueprintV2RuntimeConfiguration({
				version: 2,
				phpVersion: {
					min: '8.4',
					max: '8.2',
				},
			} as unknown as BlueprintV2Declaration)
		).toThrow(InvalidBlueprintV2Error);

		for (const wordpressVersion of ['beta', 'trunk', 'nightly'] as const) {
			expect(() =>
				resolveBlueprintV2RuntimeConfiguration({
					version: 2,
					wordpressVersion: {
						min: wordpressVersion,
					},
				} as unknown as BlueprintV2Declaration)
			).toThrow(InvalidBlueprintV2Error);
		}

		expect(() =>
			resolveBlueprintV2RuntimeConfiguration({
				version: 2,
				wordpressVersion: {
					min: '6.3',
					recommended: 'trunk',
				},
			} as unknown as BlueprintV2Declaration)
		).toThrow(InvalidBlueprintV2Error);
	});

	it('migrates v1 fields and steps to v2', () => {
		const migrated = upgradeBlueprintV1ToV2({
			landingPage: '/wp-admin/',
			login: true,
			meta: {
				title: 'Migrated',
				description: 'Migrated blueprint',
				author: 'wordpress',
				categories: ['demo'],
			},
			preferredVersions: {
				php: '8.1',
				wp: '6.4',
			},
			plugins: [
				{
					resource: 'wordpress.org/plugins',
					slug: 'akismet',
				},
			],
			steps: [
				{
					step: 'login',
					username: 'editor',
				},
				{
					step: 'writeFile',
					path: '/wordpress/demo.php',
					data: '<?php echo "Hello";',
				},
			],
		});

		expect(migrated).toMatchObject({
			version: 2,
			blueprintMeta: {
				name: 'Migrated',
				description: 'Migrated blueprint',
				authors: ['wordpress'],
				tags: ['demo'],
			},
			applicationOptions: {
				'wordpress-playground': {
					landingPage: '/wp-admin/',
					login: true,
					networkAccess: true,
				},
			},
			phpVersion: '8.1',
			wordpressVersion: '6.4',
			plugins: ['akismet'],
			additionalStepsAfterExecution: [
				{
					step: 'defineConstants',
					constants: {
						PLAYGROUND_AUTO_LOGIN_AS_USER: 'editor',
					},
				},
				{
					step: 'writeFiles',
					files: {
						'/demo.php': {
							filename: 'demo.php',
							content: '<?php echo "Hello";',
						},
					},
				},
			],
		});

		expect(
			upgradeBlueprintV1ToV2({
				login: false,
			}).applicationOptions?.['wordpress-playground']?.login
		).toBe(false);
	});

	it('preserves v1 login step username semantics during v2 migration', () => {
		expect(
			upgradeBlueprintV1ToV2({
				steps: [
					{
						step: 'login',
					},
				],
			}).additionalStepsAfterExecution
		).toEqual([
			{
				step: 'defineConstants',
				constants: {
					PLAYGROUND_AUTO_LOGIN_AS_USER: 'admin',
				},
			},
		]);

		expect(
			upgradeBlueprintV1ToV2({
				steps: [
					{
						step: 'login',
						username: '',
					},
				],
			}).additionalStepsAfterExecution
		).toEqual([
			{
				step: 'defineConstants',
				constants: {
					PLAYGROUND_AUTO_LOGIN_AS_USER: '',
				},
			},
		]);

		expect(() =>
			upgradeBlueprintV1ToV2({
				steps: [
					{
						step: 'login',
						username: 123,
					} as any,
				],
			})
		).toThrow('/steps/login/username: must be a string');
	});

	it('preserves v1 install asset options during v2 migration', () => {
		const migrated = upgradeBlueprintV1ToV2({
			steps: [
				{
					step: 'installPlugin',
					pluginData: {
						resource: 'wordpress.org/plugins',
						slug: 'akismet',
					},
					ifAlreadyInstalled: 'skip',
					options: {
						activate: true,
						activationOptions: {
							storeCity: 'Wroclaw',
						},
						onError: 'skip-plugin',
						targetFolderName: 'akismet-dev',
						humanReadableName: 'Akismet Dev',
					},
				},
				{
					step: 'installTheme',
					themeData: {
						resource: 'wordpress.org/themes',
						slug: 'twentytwentyfive',
					},
					ifAlreadyInstalled: 'error',
					options: {
						activate: false,
						importStarterContent: true,
						onError: 'skip-theme',
						targetFolderName: 'tt5-dev',
						humanReadableName: 'Twenty Twenty-Five Dev',
					},
				},
			],
		});

		expect(migrated.additionalStepsAfterExecution).toMatchObject([
			{
				step: 'installPlugin',
				source: 'akismet',
				active: true,
				activationOptions: {
					storeCity: 'Wroclaw',
				},
				onError: 'skip-plugin',
				ifAlreadyInstalled: 'skip',
				targetDirectoryName: 'akismet-dev',
				humanReadableName: 'Akismet Dev',
			},
			{
				step: 'installTheme',
				source: 'twentytwentyfive',
				active: false,
				importStarterContent: true,
				onError: 'skip-theme',
				ifAlreadyInstalled: 'error',
				targetDirectoryName: 'tt5-dev',
				humanReadableName: 'Twenty Twenty-Five Dev',
			},
		]);
	});

	it('migrates v1 zip-wrapped directory resources for plugin and theme installs', () => {
		const migrated = upgradeBlueprintV1ToV2({
			steps: [
				{
					step: 'installPlugin',
					pluginData: {
						resource: 'zip',
						inner: {
							resource: 'git:directory',
							url: 'https://github.com/example/plugin.git',
							ref: 'main',
							path: 'plugin',
						},
					},
					options: {
						activate: false,
					},
				},
				{
					step: 'installTheme',
					themeData: {
						resource: 'zip',
						inner: {
							resource: 'literal:directory',
							name: 'theme',
							files: {
								'style.css': '/* Theme Name: Test */',
							},
						},
					},
					options: {
						activate: false,
					},
				},
			],
		} as BlueprintV1Declaration);

		expect(validateBlueprintV2(migrated)).toEqual({ valid: true });
		expect(migrated.additionalStepsAfterExecution).toMatchObject([
			{
				step: 'installPlugin',
				source: {
					gitRepository: 'https://github.com/example/plugin.git',
					ref: 'main',
					pathInRepository: 'plugin',
				},
			},
			{
				step: 'installTheme',
				source: {
					directoryName: 'theme',
					files: {
						'style.css': '/* Theme Name: Test */',
					},
				},
			},
		]);

		expect(createBlueprintV2ExecutionPlan(migrated)).toMatchObject([
			{
				step: 'installPlugin',
				pluginData: {
					resource: 'git:directory',
					url: 'https://github.com/example/plugin.git',
					ref: 'main',
					path: 'plugin',
				},
			},
			{
				step: 'installTheme',
				themeData: {
					resource: 'literal:directory',
					name: 'theme',
				},
			},
		]);
	});

	it('rejects v1 zip-wrapped file resources during v2 migration', () => {
		expect(() =>
			upgradeBlueprintV1ToV2({
				steps: [
					{
						step: 'installPlugin',
						pluginData: {
							resource: 'zip',
							inner: {
								resource: 'literal',
								name: 'plugin.php',
								contents: '<?php',
							},
						},
					},
				],
			} as BlueprintV1Declaration)
		).toThrow(/ZIP resources wrapping files/);
	});

	it('preserves v1 WXR import options during v2 migration', () => {
		const migrated = upgradeBlueprintV1ToV2({
			steps: [
				{
					step: 'importWxr',
					file: {
						resource: 'url',
						url: 'https://example.com/content.wxr',
					},
					fetchAttachments: false,
					rewriteUrls: false,
					urlMap: {
						'https://old.example': 'https://new.example',
					},
					authorsMode: 'map',
					defaultAuthorUsername: 'editor',
					authorsMap: {
						remote: 'admin',
					},
					importUsers: true,
					importComments: true,
					importSiteOptions: true,
				},
			],
		});

		expect(migrated.additionalStepsAfterExecution).toEqual([
			{
				step: 'importContent',
				content: [
					{
						type: 'wxr',
						source: 'https://example.com/content.wxr',
						staticAssets: 'hotlink',
						urlsMode: 'preserve',
						urlsMap: {
							'https://old.example': 'https://new.example',
						},
						authorsMode: 'map',
						defaultAuthorUsername: 'editor',
						authorsMap: {
							remote: 'admin',
						},
						importUsers: true,
						importComments: true,
						importSiteOptions: true,
					},
				],
			},
		]);
		expect(validateBlueprintV2(migrated)).toEqual({ valid: true });

		const migratedDefaults = upgradeBlueprintV1ToV2({
			steps: [
				{
					step: 'importWxr',
					file: {
						resource: 'url',
						url: 'https://example.com/defaults.wxr',
					},
				},
			],
		});

		expect(
			(migratedDefaults.additionalStepsAfterExecution?.[0] as any)
				.content[0]
		).toMatchObject({
			authorsMode: 'default-author',
			defaultAuthorUsername: 'admin',
			importComments: true,
			importUsers: false,
			importSiteOptions: false,
		});
		expect(validateBlueprintV2(migratedDefaults)).toEqual({ valid: true });
	});

	it('rejects unsupported v1 steps instead of dropping them during migration', () => {
		expect(() =>
			upgradeBlueprintV1ToV2({
				steps: [
					{
						step: 'request',
						request: {
							url: '/',
						},
					},
				],
			} as BlueprintV1Declaration)
		).toThrow(UnsupportedBlueprintV2FeatureError);
	});

	it('preserves v1 preferredVersions.wp false safety during migration', () => {
		expect(() =>
			upgradeBlueprintV1ToV2({
				preferredVersions: {
					php: 'latest',
					wp: false,
				},
				siteOptions: {
					blogname: 'Requires WordPress',
				},
			} as BlueprintV1Declaration)
		).toThrow(/preferredVersions\.wp: false.*siteOptions/);

		expect(() =>
			upgradeBlueprintV1ToV2({
				preferredVersions: {
					php: 'latest',
					wp: false,
				},
				steps: [
					{
						step: 'installPlugin',
						pluginData: 'akismet',
					},
				],
			} as unknown as BlueprintV1Declaration)
		).toThrow(/preferredVersions\.wp: false.*installPlugin/);
	});

	it('maps Playground application options to v1 boot/run behavior', () => {
		const v1 = blueprintV2ToBlueprintV1({
			version: 2,
			applicationOptions: {
				'wordpress-playground': {
					landingPage: '/wp-admin/plugins.php',
					login: true,
					networkAccess: true,
				},
			},
		} as BlueprintV2Declaration);

		expect(v1).toMatchObject({
			landingPage: '/wp-admin/plugins.php',
			login: true,
			features: {
				networking: true,
				intl: false,
			},
		});
	});

	it('runs PHP code from execution-context data references', () => {
		const plan = createBlueprintV2ExecutionPlan({
			version: 2,
			additionalStepsAfterExecution: [
				{
					step: 'runPHP',
					code: './scripts/bootstrap.php',
					env: {
						MODE: 'test',
					},
				},
			],
		} as BlueprintV2Declaration);

		expect(plan).toEqual([
			{
				step: 'writeFile',
				path: '/tmp/blueprint-run-php-additionalStepsAfterExecution-0-code.php',
				data: {
					resource: 'bundled',
					path: 'scripts/bootstrap.php',
				},
			},
			{
				step: 'runPHPWithOptions',
				options: {
					code: '<?php require "/tmp/blueprint-run-php-additionalStepsAfterExecution-0-code.php";',
					env: {
						MODE: 'test',
					},
				},
			},
		]);
	});

	it('rejects directory data references for file-only imperative steps', () => {
		const inlineDirectory = {
			directoryName: 'files',
			files: {
				'file.txt': '',
			},
		};

		expect(() =>
			createBlueprintV2ExecutionPlan({
				version: 2,
				additionalStepsAfterExecution: [
					{
						step: 'runSQL',
						source: inlineDirectory,
					},
				],
			} as unknown as BlueprintV2Declaration)
		).toThrow('/additionalStepsAfterExecution/0/source');

		expect(() =>
			createBlueprintV2ExecutionPlan({
				version: 2,
				additionalStepsAfterExecution: [
					{
						step: 'unzip',
						zipFile: inlineDirectory,
						extractToPath: 'wp-content/uploads',
					},
				],
			} as unknown as BlueprintV2Declaration)
		).toThrow('/additionalStepsAfterExecution/0/zipFile');
	});

	it('imports media definitions by materializing files and registering attachments', () => {
		const plan = createBlueprintV2ExecutionPlan({
			version: 2,
			media: [
				{
					source: './assets/logo.png',
					title: 'Logo',
					alt: 'Site logo',
					caption: 'Brand asset',
					description: 'Primary logo',
				},
			],
			additionalStepsAfterExecution: [
				{
					step: 'importMedia',
					media: ['https://example.com/brochure.pdf'],
				},
			],
		} as BlueprintV2Declaration);

		expect(plan.map((step) => step.step)).toEqual([
			'writeFile',
			'runPHPWithOptions',
			'writeFile',
			'runPHPWithOptions',
		]);
		expect(plan[0]).toMatchObject({
			path: '/tmp/blueprint-media-media-0-logo.png',
			data: {
				resource: 'bundled',
				path: 'assets/logo.png',
			},
		});
		expect(JSON.parse(plan[1].options.env.BLUEPRINT_MEDIA)).toEqual([
			{
				path: '/tmp/blueprint-media-media-0-logo.png',
				filename: 'logo.png',
				title: 'Logo',
				description: 'Primary logo',
				alt: 'Site logo',
				caption: 'Brand asset',
			},
		]);
		expect(plan[1].options.code).toContain('wp_insert_attachment');
		expect(plan[1].options.code).toContain(
			"$blueprint_temp_files[] = $item['path'];"
		);
		expect(
			plan[1].options.code.indexOf(
				"$blueprint_temp_files[] = $item['path'];"
			)
		).toBeLessThan(
			plan[1].options.code.indexOf('Media source is not readable')
		);
		expect(plan[2]).toMatchObject({
			path: '/tmp/blueprint-media-additionalStepsAfterExecution-0-media-0-brochure.pdf',
			data: {
				resource: 'url',
				url: 'https://example.com/brochure.pdf',
			},
		});
	});

	it('validates and rejects invalid media definitions', () => {
		expect(
			validateBlueprintV2({
				version: 2,
				media: [
					{
						source: 'not-a-data-reference',
						alt: 42,
					},
				],
			})
		).toEqual({
			valid: false,
			errors: [
				{
					path: '/media/0/source',
					message: 'must be a URL or execution-context path',
				},
				{
					path: '/media/0/alt',
					message: 'must be a string',
				},
			],
		});

		expect(() =>
			createBlueprintV2ExecutionPlan({
				version: 2,
				media: [
					{
						directoryName: 'assets',
						files: {
							'logo.png': '',
						},
					},
				],
			} as unknown as BlueprintV2Declaration)
		).toThrow('/media/0');
	});

	it('imports mysql-dump content through runSql steps', () => {
		const plan = createBlueprintV2ExecutionPlan({
			version: 2,
			content: [
				{
					type: 'mysql-dump',
					source: [
						'./db/schema.sql',
						{
							filename: 'data.sql',
							content: 'INSERT INTO wp_options VALUES ();',
						},
					],
				},
			],
			additionalStepsAfterExecution: [
				{
					step: 'importContent',
					content: [
						{
							type: 'mysql-dump',
							source: './db/after.sql',
						},
					],
				},
			],
		} as BlueprintV2Declaration);

		expect(plan).toMatchObject([
			{
				step: 'runSql',
				sql: {
					resource: 'bundled',
					path: 'db/schema.sql',
				},
			},
			{
				step: 'runSql',
				sql: {
					resource: 'literal',
					name: 'data.sql',
					contents: 'INSERT INTO wp_options VALUES ();',
				},
			},
			{
				step: 'runSql',
				sql: {
					resource: 'bundled',
					path: 'db/after.sql',
				},
			},
		]);
	});

	it('passes WXR static asset and URL rewrite options to importWxr', async () => {
		const blueprint = {
			version: 2,
			content: [
				{
					type: 'wxr',
					source: {
						filename: 'content.xml',
						content: '<rss></rss>',
					},
					staticAssets: 'hotlink',
					urlsMode: 'preserve',
					urlsMap: {
						'https://old.example': 'https://new.example',
					},
					authorsMode: 'map',
					authorsMap: {
						remote: 'admin',
					},
					importComments: true,
				},
			],
		} as BlueprintV2Declaration;
		const plan = createBlueprintV2ExecutionPlan(blueprint);

		expect(plan).toMatchObject([
			{
				step: 'importWxr',
				file: {
					resource: 'literal',
					name: 'content.xml',
					contents: '<rss></rss>',
				},
				fetchAttachments: false,
				rewriteUrls: false,
				urlMap: {
					'https://old.example': 'https://new.example',
				},
				authorsMode: 'map',
				authorsMap: {
					remote: 'admin',
				},
				importComments: true,
				importUsers: false,
				importSiteOptions: false,
			},
		]);
		await expect(compileBlueprintV2(blueprint)).resolves.toMatchObject({
			declaration: blueprint,
		});

		const arraySourcesPlan = createBlueprintV2ExecutionPlan({
			version: 2,
			content: [
				{
					type: 'wxr',
					source: [
						{
							filename: 'first.xml',
							content: '<rss></rss>',
						},
						{
							filename: 'second.xml',
							content: '<rss></rss>',
						},
					],
				},
			],
		} as BlueprintV2Declaration);
		expect(arraySourcesPlan).toMatchObject([
			{
				step: 'importWxr',
				file: {
					resource: 'literal',
					name: 'first.xml',
				},
			},
			{
				step: 'importWxr',
				file: {
					resource: 'literal',
					name: 'second.xml',
				},
			},
		]);

		const result = validateBlueprintV2({
			version: 2,
			content: [
				{
					type: 'wxr',
					source: './content.xml',
					staticAssets: 'copy',
					authorsMode: 'map',
					importComments: 'yes',
				},
			],
		});
		expect(result.valid).toBe(false);
		if (!result.valid) {
			expect(result.errors).toEqual(
				expect.arrayContaining([
					{
						path: '/content/0/staticAssets',
						message: 'must be "fetch" or "hotlink"',
					},
					{
						path: '/content/0/importComments',
						message: 'must be a boolean',
					},
					{
						path: '/content/0',
						message: 'must have required property "authorsMap"',
					},
				])
			);
		}
	});

	it('imports posts content from inline post objects and file references', () => {
		const plan = createBlueprintV2ExecutionPlan({
			version: 2,
			content: [
				{
					type: 'posts',
					source: [
						{
							post_title: 'Parent Page',
							post_type: 'page',
							post_status: 'publish',
						},
						{
							post_title: 'About Us',
							post_content:
								'<p>Visit https://old-site.com/contact</p>',
							post_type: 'page',
							post_parent_name: 'Parent Page',
							post_category: ['news'],
							post_tags: ['demo'],
							tax_input: {
								genre: ['fiction'],
							},
							meta_input: {
								seo_title: 'About',
							},
							page_template: 'templates/full-width.php',
						},
						'./wp-content/content/posts/pages/about-us.html',
					],
					urlsMode: 'rewrite',
					urlsMap: {
						'https://old-site.com': 'https://new-site.com',
					},
				},
			],
			additionalStepsAfterExecution: [
				{
					step: 'importContent',
					content: [
						{
							type: 'posts',
							source: {
								post_title: 'After import',
								post_content: 'Imported after execution',
							},
						},
					],
				},
			],
		} as BlueprintV2Declaration);

		expect(plan.map((step) => step.step)).toEqual([
			'writeFile',
			'runPHPWithOptions',
			'runPHPWithOptions',
		]);
		expect(plan[0]).toMatchObject({
			path: '/tmp/blueprint-post-content-content-0-source-2-about-us.html',
			data: {
				resource: 'bundled',
				path: 'wp-content/content/posts/pages/about-us.html',
			},
		});
		expect(JSON.parse(plan[1].options.env.BLUEPRINT_POSTS)).toEqual([
			{
				post_title: 'Parent Page',
				post_type: 'page',
				post_status: 'publish',
			},
			{
				post_title: 'About Us',
				post_content: '<p>Visit https://old-site.com/contact</p>',
				post_type: 'page',
				post_parent_name: 'Parent Page',
				post_category: ['news'],
				post_tags: ['demo'],
				tax_input: {
					genre: ['fiction'],
				},
				meta_input: {
					seo_title: 'About',
				},
				page_template: 'templates/full-width.php',
			},
		]);
		expect(JSON.parse(plan[1].options.env.BLUEPRINT_POST_FILES)).toEqual([
			{
				path: '/tmp/blueprint-post-content-content-0-source-2-about-us.html',
				filename: 'about-us.html',
				post_title: 'Test Post',
				post_type: 'post',
			},
		]);
		expect(plan[1].options.env.BLUEPRINT_URLS_MODE).toBe('rewrite');
		expect(JSON.parse(plan[1].options.env.BLUEPRINT_URLS_MAP)).toEqual({
			'https://old-site.com': 'https://new-site.com',
		});
		expect(plan[1].options.code).toContain('blueprint_default_post_author');
		expect(plan[1].options.code).toContain('wp_set_object_terms');
		expect(plan[1].options.code).toContain('post_parent_name');
		expect(plan[1].options.code).toContain(
			"$blueprint_temp_files[] = $file['path'];"
		);
		expect(
			plan[1].options.code.indexOf(
				"$blueprint_temp_files[] = $file['path'];"
			)
		).toBeLessThan(
			plan[1].options.code.indexOf('Post content source is not readable')
		);
		expect(JSON.parse(plan[2].options.env.BLUEPRINT_POSTS)).toEqual([
			{
				post_title: 'After import',
				post_content: 'Imported after execution',
			},
		]);
	});

	it('validates posts content definitions', () => {
		expect(
			validateBlueprintV2({
				version: 2,
				content: [
					{
						type: 'posts',
						source: [
							{
								post_title: 'Valid fixture shape',
								post_content: 'Hello',
								post_status: 'publish',
								post_type: 'post',
								post_author: 1,
								post_category: ['news'],
								post_tags: ['test'],
								tax_input: {
									genre: ['fiction'],
								},
								meta_input: {
									rating: 5,
								},
							},
						],
						urlsMode: 'rewrite',
						urlsMap: {
							'https://old.example': 'https://new.example',
						},
					},
				],
			})
		).toEqual({ valid: true });

		const result = validateBlueprintV2({
			version: 2,
			content: [
				{
					type: 'posts',
					source: [
						{
							post_title: 42,
							post_author: 'admin',
							post_status: 'archived',
							comment_status: 'maybe',
							post_category: ['news', 123],
							tax_input: {
								genre: ['fiction', false],
							},
							meta_input: 'bad',
						},
						{
							title: 'Alias title',
							content: 'Alias content',
							meta: {
								seo_title: 'Alias',
							},
							extra: true,
						},
					],
					urlsMode: 'invalid',
					urlsMap: {
						'https://old.example': 42,
					},
				},
			],
		});

		expect(result.valid).toBe(false);
		if (!result.valid) {
			expect(result.errors).toEqual(
				expect.arrayContaining([
					{
						path: '/content/0/source/0/post_title',
						message: 'must be a string',
					},
					{
						path: '/content/0/source/0/post_author',
						message: 'must be a number',
					},
					{
						path: '/content/0/source/0/post_status',
						message:
							'must be "publish", "pending", "draft", "auto-draft", "future", "private", "inherit", or "trash"',
					},
					{
						path: '/content/0/source/0/comment_status',
						message: 'must be "open" or "closed"',
					},
					{
						path: '/content/0/source/0/post_category/1',
						message: 'must be a string',
					},
					{
						path: '/content/0/source/0/tax_input/genre/1',
						message: 'must be a string',
					},
					{
						path: '/content/0/source/0/meta_input',
						message: 'must be an object',
					},
					{
						path: '/content/0/source/1',
						message: 'has unexpected property "title"',
					},
					{
						path: '/content/0/source/1',
						message: 'has unexpected property "content"',
					},
					{
						path: '/content/0/source/1',
						message: 'has unexpected property "meta"',
					},
					{
						path: '/content/0/source/1',
						message: 'has unexpected property "extra"',
					},
					{
						path: '/content/0/source/1',
						message: 'must have required property "post_title"',
					},
					{
						path: '/content/0/urlsMode',
						message: 'must be "rewrite" or "preserve"',
					},
					{
						path: '/content/0/urlsMap/https:~1~1old.example',
						message: 'must be a string',
					},
				])
			);
		}
	});

	it('runs single-file plugin execution-context declarations against WordPress', async () => {
		const handler = await bootWordPressAndRequestHandler({
			createPhpRuntime: async () =>
				await loadNodeRuntime(RecommendedPHPVersion),
			siteUrl: 'http://playground-domain/',
			wordPressZip: await getWordPressModule(),
			sqliteIntegrationPluginZip: await getSqliteDriverModule(),
		});
		const php = await handler.getPrimaryPhp();
		const requestedPaths: string[] = [];

		try {
			await runBlueprintV2Steps(
				await compileBlueprintV2(
					{
						version: 2,
						plugins: ['./query-monitor.php'],
					} as BlueprintV2Declaration,
					{
						streamBundledFile: async (path) => {
							requestedPaths.push(path);
							return new File(
								[
									`<?php
/**
 * Plugin Name: Query Monitor Test
 */
register_activation_hook(__FILE__, function () {
	update_option(
		'blueprint_single_file_plugin_activated',
		plugin_basename(__FILE__)
	);
});
`,
								],
								path
							) as unknown as StreamedFile;
						},
					}
				),
				php
			);

			const response = await php.run({
				code: `<?php
require '/wordpress/wp-load.php';
echo json_encode(array(
	'active' => in_array('query-monitor.php', get_option('active_plugins', array()), true),
	'activation' => get_option('blueprint_single_file_plugin_activated'),
	'installed' => file_exists(WP_PLUGIN_DIR . '/query-monitor.php'),
));
`,
			});

			expect(requestedPaths).toEqual(['query-monitor.php']);
			expect(JSON.parse(response.text)).toEqual({
				active: true,
				activation: 'query-monitor.php',
				installed: true,
			});
		} finally {
			php.exit();
			await handler[Symbol.asyncDispose]();
		}
	}, 30_000);

	it('runs posts content imports against WordPress', async () => {
		const handler = await bootWordPressAndRequestHandler({
			createPhpRuntime: async () =>
				await loadNodeRuntime(RecommendedPHPVersion),
			siteUrl: 'http://playground-domain/',
			wordPressZip: await getWordPressModule(),
			sqliteIntegrationPluginZip: await getSqliteDriverModule(),
		});
		const php = await handler.getPrimaryPhp();

		try {
			await runBlueprintV2Steps(
				await compileBlueprintV2({
					version: 2,
					content: [
						{
							type: 'posts',
							source: [
								{
									post_title: 'Parent Page',
									post_content: 'Parent content',
									post_type: 'page',
									post_status: 'publish',
								},
								{
									post_title: 'Child Page',
									post_content: 'Child content',
									post_type: 'page',
									post_status: 'publish',
									post_parent_name: 'Parent Page',
									page_template: 'default',
								},
								{
									post_title: 'Regular Post',
									post_content: 'https://old.example/content',
									post_status: 'publish',
									post_author: 999999,
									post_category: ['news'],
									post_tags: ['featured'],
									meta_input: {
										source_url: 'https://old.example/meta',
										rating: 5,
										settings: {
											endpoint: 'https://old.example/api',
											count: 7,
											enabled: true,
										},
									},
								},
								{
									filename: 'file-post.html',
									content: 'File post content',
								},
							],
							urlsMap: {
								'https://old.example': 'https://new.example',
							},
						},
					],
				} as BlueprintV2Declaration),
				php
			);

			const response = await php.run({
				code: `<?php
	require '/wordpress/wp-load.php';
	$child = get_posts(array('post_type' => 'page', 'title' => 'Child Page', 'numberposts' => 1))[0];
	$parent = get_post($child->post_parent);
	$post = get_posts(array('post_type' => 'post', 'title' => 'Regular Post', 'numberposts' => 1))[0];
	$file_post = get_posts(array('post_type' => 'post', 'title' => 'Test Post', 'numberposts' => 1))[0];
	$settings = get_post_meta($post->ID, 'settings', true);
	echo json_encode(array(
		'child_parent' => $parent->post_title,
		'child_template' => get_post_meta($child->ID, '_wp_page_template', true),
		'post_content' => $post->post_content,
		'post_author' => get_user_by('ID', $post->post_author)->user_login,
		'post_meta' => get_post_meta($post->ID, 'source_url', true),
		'post_rating' => (int) get_post_meta($post->ID, 'rating', true),
		'settings_endpoint' => $settings['endpoint'] ?? null,
		'settings_count' => $settings['count'] ?? null,
		'settings_enabled' => $settings['enabled'] ?? null,
			'categories' => wp_get_post_terms($post->ID, 'category', array('fields' => 'names')),
			'tags' => wp_get_post_terms($post->ID, 'post_tag', array('fields' => 'names')),
			'file_post_content' => $file_post->post_content,
		'staged_file_exists' => file_exists('/tmp/blueprint-post-content-content-0-source-3-file-post.html'),
	));
	`,
			});

			expect(JSON.parse(response.text)).toEqual({
				child_parent: 'Parent Page',
				child_template: 'default',
				post_content: 'https://new.example/content',
				post_author: 'admin',
				post_meta: 'https://new.example/meta',
				post_rating: 5,
				settings_endpoint: 'https://new.example/api',
				settings_count: 7,
				settings_enabled: true,
				categories: ['news'],
				tags: ['featured'],
				file_post_content: 'File post content',
				staged_file_exists: false,
			});
		} finally {
			php.exit();
			await handler[Symbol.asyncDispose]();
		}
	}, 30_000);

	it('runs media imports against WordPress', async () => {
		const handler = await bootWordPressAndRequestHandler({
			createPhpRuntime: async () =>
				await loadNodeRuntime(RecommendedPHPVersion),
			siteUrl: 'http://playground-domain/',
			wordPressZip: await getWordPressModule(),
			sqliteIntegrationPluginZip: await getSqliteDriverModule(),
		});
		const php = await handler.getPrimaryPhp();

		try {
			await runBlueprintV2Steps(
				await compileBlueprintV2({
					version: 2,
					media: [
						{
							source: {
								filename: 'sample.txt',
								content: 'Sample media content',
							},
							title: 'Sample Attachment',
							caption: 'Sample caption',
							description: 'Sample description',
							alt: 'Sample alt',
						},
					],
				} as BlueprintV2Declaration),
				php
			);

			const response = await php.run({
				code: `<?php
require '/wordpress/wp-load.php';
$attachment = get_posts(array(
	'post_type' => 'attachment',
	'title' => 'Sample Attachment',
	'post_status' => 'inherit',
	'numberposts' => 1,
))[0];
$attached_file = get_attached_file($attachment->ID);
echo json_encode(array(
	'title' => $attachment->post_title,
	'caption' => $attachment->post_excerpt,
	'description' => $attachment->post_content,
	'alt' => get_post_meta($attachment->ID, '_wp_attachment_image_alt', true),
		'file_exists' => file_exists($attached_file),
		'file_contents' => file_get_contents($attached_file),
		'staged_file_exists' => file_exists('/tmp/blueprint-media-media-0-sample.txt'),
	));
	`,
			});

			expect(JSON.parse(response.text)).toEqual({
				title: 'Sample Attachment',
				caption: 'Sample caption',
				description: 'Sample description',
				alt: 'Sample alt',
				file_exists: true,
				file_contents: 'Sample media content',
				staged_file_exists: false,
			});
		} finally {
			php.exit();
			await handler[Symbol.asyncDispose]();
		}
	}, 30_000);

	it('runs font imports against WordPress', async () => {
		const handler = await bootWordPressAndRequestHandler({
			createPhpRuntime: async () =>
				await loadNodeRuntime(RecommendedPHPVersion),
			siteUrl: 'http://playground-domain/',
			wordPressZip: await getWordPressModule(),
			sqliteIntegrationPluginZip: await getSqliteDriverModule(),
		});
		const php = await handler.getPrimaryPhp();

		try {
			await runBlueprintV2Steps(
				await compileBlueprintV2({
					version: 2,
					fonts: {
						'open-sans': {
							filename: 'open-sans.woff2',
							content: 'fontdata',
						},
					},
				} as BlueprintV2Declaration),
				php
			);

			const response = await php.run({
				code: `<?php
require '/wordpress/wp-load.php';
$family = get_posts(array(
	'post_type' => 'wp_font_family',
	'name' => 'open-sans',
	'post_status' => 'any',
	'numberposts' => 1,
))[0];
$face = get_posts(array(
	'post_type' => 'wp_font_face',
	'post_parent' => $family->ID,
	'post_status' => 'any',
	'numberposts' => 1,
))[0];
$settings = json_decode($face->post_content, true);
$font_file = get_post_meta($face->ID, '_wp_font_face_file', true);
$font_dir = wp_get_font_dir();
echo json_encode(array(
	'family_title' => $family->post_title,
	'family_settings' => json_decode($family->post_content, true),
	'face_src' => $settings['src'],
		'font_file' => $font_file,
		'font_file_exists' => file_exists(trailingslashit($font_dir['basedir']) . $font_file),
		'collection_plugin_exists' => file_exists(WP_CONTENT_DIR . '/mu-plugins/blueprint-font-collections.php'),
		'staged_file_exists' => file_exists('/tmp/blueprint-font-fonts-open-sans-source-open-sans.woff2'),
	));
	`,
			});

			const result = JSON.parse(response.text);
			expect(result).toMatchObject({
				family_title: 'Open Sans',
				family_settings: {
					fontFamily: 'Open Sans',
					fontFace: [
						{
							fontFamily: 'Open Sans',
						},
					],
				},
				font_file: 'open-sans.woff2',
				font_file_exists: true,
				collection_plugin_exists: true,
				staged_file_exists: false,
			});
			expect(result.face_src).toContain(
				'/wp-content/uploads/fonts/open-sans.woff2'
			);
		} finally {
			php.exit();
			await handler[Symbol.asyncDispose]();
		}
	}, 30_000);

	it('runs role and user declarations against WordPress', async () => {
		const handler = await bootWordPressAndRequestHandler({
			createPhpRuntime: async () =>
				await loadNodeRuntime(RecommendedPHPVersion),
			siteUrl: 'http://playground-domain/',
			wordPressZip: await getWordPressModule(),
			sqliteIntegrationPluginZip: await getSqliteDriverModule(),
		});
		const php = await handler.getPrimaryPhp();

		try {
			await runBlueprintV2Steps(
				await compileBlueprintV2({
					version: 2,
					roles: [
						{
							name: 'reviewer',
							capabilities: {
								read: 'true',
								edit_posts: 'true',
								delete_posts: 'false',
							},
						},
					],
					users: [
						{
							username: 'reviewer-user',
							email: 'reviewer@example.com',
							role: 'reviewer',
							meta: {
								first_name: 'Riley',
								department: 'Editorial',
							},
						},
					],
				} as BlueprintV2Declaration),
				php
			);

			const response = await php.run({
				code: `<?php
require '/wordpress/wp-load.php';
$role = get_role('reviewer');
$user = get_user_by('login', 'reviewer-user');
echo json_encode(array(
	'role_name' => $role ? $role->name : null,
	'can_read' => $role ? $role->has_cap('read') : false,
	'can_edit_posts' => $role ? $role->has_cap('edit_posts') : false,
	'can_delete_posts' => $role ? $role->has_cap('delete_posts') : false,
	'user_email' => $user ? $user->user_email : null,
	'user_roles' => $user ? $user->roles : array(),
	'first_name' => $user ? get_user_meta($user->ID, 'first_name', true) : null,
	'department' => $user ? get_user_meta($user->ID, 'department', true) : null,
));
`,
			});

			expect(JSON.parse(response.text)).toEqual({
				role_name: 'reviewer',
				can_read: true,
				can_edit_posts: true,
				can_delete_posts: false,
				user_email: 'reviewer@example.com',
				user_roles: ['reviewer'],
				first_name: 'Riley',
				department: 'Editorial',
			});
		} finally {
			php.exit();
			await handler[Symbol.asyncDispose]();
		}
	}, 30_000);

	it('runs execution-context post type declarations against WordPress', async () => {
		const handler = await bootWordPressAndRequestHandler({
			createPhpRuntime: async () =>
				await loadNodeRuntime(RecommendedPHPVersion),
			siteUrl: 'http://playground-domain/',
			wordPressZip: await getWordPressModule(),
			sqliteIntegrationPluginZip: await getSqliteDriverModule(),
		});
		const php = await handler.getPrimaryPhp();
		const requestedPaths: string[] = [];

		try {
			await runBlueprintV2Steps(
				await compileBlueprintV2(
					{
						version: 2,
						postTypes: {
							book: './post-types/book.json',
						},
					} as BlueprintV2Declaration,
					{
						streamBundledFile: async (path) => {
							requestedPaths.push(path);
							return new File(
								[
									JSON.stringify({
										label: 'Books',
										public: true,
										show_ui: true,
										supports: ['title', 'editor'],
									}),
								],
								'book.json',
								{ type: 'application/json' }
							) as any;
						},
					}
				),
				php
			);

			const response = await php.run({
				code: `<?php
require '/wordpress/wp-load.php';
$post_id = wp_insert_post(array(
	'post_type' => 'book',
	'post_title' => 'Blueprint Book',
	'post_content' => 'Registered by Blueprint v2',
	'post_status' => 'publish',
), true);
$posts = get_posts(array(
	'post_type' => 'book',
	'title' => 'Blueprint Book',
	'post_status' => 'publish',
	'numberposts' => 1,
));
$post_type = get_post_type_object('book');
echo json_encode(array(
	'exists' => post_type_exists('book'),
	'inserted' => !is_wp_error($post_id),
	'queried_title' => $posts ? $posts[0]->post_title : null,
	'label' => $post_type ? $post_type->label : null,
));
`,
			});

			expect(requestedPaths).toEqual(['post-types/book.json']);
			expect(JSON.parse(response.text)).toEqual({
				exists: true,
				inserted: true,
				queried_title: 'Blueprint Book',
				label: 'Books',
			});
		} finally {
			php.exit();
			await handler[Symbol.asyncDispose]();
		}
	}, 30_000);

	it('validates and rejects invalid content definitions', () => {
		expect(
			validateBlueprintV2({
				version: 2,
				content: [
					{
						type: 'wxr',
						source: 'not-a-data-reference',
						staticAssets: 'invalid',
					},
				],
			})
		).toEqual({
			valid: false,
			errors: [
				{
					path: '/content/0/source',
					message: 'must be a URL or execution-context path',
				},
				{
					path: '/content/0/staticAssets',
					message: 'must be "fetch" or "hotlink"',
				},
			],
		});

		expect(() =>
			createBlueprintV2ExecutionPlan({
				version: 2,
				content: [
					{
						type: 'wxr',
						source: {
							directoryName: 'content',
							files: {
								'export.xml': '',
							},
						},
					},
				],
			} as unknown as BlueprintV2Declaration)
		).toThrow('/content/0/source');

		expect(() =>
			createBlueprintV2ExecutionPlan({
				version: 2,
				content: [
					{
						type: 'posts',
						source: {
							directoryName: 'content',
							files: {
								'post.html': '',
							},
						},
					},
				],
			} as unknown as BlueprintV2Declaration)
		).toThrow('/content/0/source');
	});

	it('rejects runPHP code references that resolve to directories', () => {
		expect(() =>
			createBlueprintV2ExecutionPlan({
				version: 2,
				additionalStepsAfterExecution: [
					{
						step: 'runPHP',
						code: {
							directoryName: 'scripts',
							files: {
								'bootstrap.php': '<?php',
							},
						},
					},
				],
			} as unknown as BlueprintV2Declaration)
		).toThrow('/additionalStepsAfterExecution/0/code');

		expect(() =>
			createBlueprintV2ExecutionPlan({
				version: 2,
				additionalStepsAfterExecution: [
					{
						step: 'runPHP',
						code: {
							gitRepository:
								'https://github.com/example/repo.git',
							pathInRepository: 'scripts/bootstrap.php',
						},
					},
				],
			} as unknown as BlueprintV2Declaration)
		).toThrow(UnsupportedBlueprintV2FeatureError);
	});

	it('reports the validated v2 declaration instead of the compiled v1 shape', async () => {
		let validatedBlueprint: BlueprintV2Declaration | undefined;
		const compiled = await compileBlueprintV2(
			{
				version: 2,
				plugins: ['akismet'],
			},
			{
				onBlueprintValidated: (blueprint) => {
					validatedBlueprint = blueprint;
				},
			}
		);

		expect(compiled.declaration).toEqual({
			version: 2,
			plugins: ['akismet'],
		});
		expect(validatedBlueprint).toEqual({
			version: 2,
			plugins: ['akismet'],
		});
	});

	it('migrates v1-only runSql and updateUserMeta steps through valid v2 steps', () => {
		const migrated = upgradeBlueprintV1ToV2({
			steps: [
				{
					step: 'runSql',
					sql: {
						resource: 'literal',
						name: 'query.sql',
						contents: 'SELECT 1;',
					},
				},
				{
					step: 'updateUserMeta',
					userId: 1,
					meta: {
						first_name: 'Ada',
					},
				},
			],
		} as BlueprintV1Declaration);

		expect(migrated.additionalStepsAfterExecution).toEqual([
			{
				step: 'runSQL',
				source: {
					filename: 'query.sql',
					content: 'SELECT 1;',
				},
			},
			{
				step: 'runPHP',
				code: {
					filename: 'script.php',
					content: expect.stringContaining(
						"require '/wordpress/wp-load.php';"
					),
				},
				env: {
					USER_ID: '1',
					META: JSON.stringify({
						first_name: 'Ada',
					}),
				},
			},
		]);
		expect(validateBlueprintV2(migrated)).toEqual({ valid: true });
	});

	it('migrates v1 rmdir and literal directory writeFiles steps', () => {
		const migrated = upgradeBlueprintV1ToV2({
			steps: [
				{
					step: 'rmdir',
					path: '/wordpress/wp-content/cache',
				},
				{
					step: 'writeFiles',
					writeToPath: '/wordpress/wp-content/plugins/demo',
					filesTree: {
						resource: 'literal:directory',
						name: 'demo',
						files: {
							'index.php': '<?php',
						},
					},
				},
			],
		} as BlueprintV1Declaration);

		expect(migrated.additionalStepsAfterExecution).toEqual([
			{
				step: 'rmdir',
				path: '/wp-content/cache',
			},
			{
				step: 'writeFiles',
				files: {
					'/wp-content/plugins/demo': {
						directoryName: 'demo',
						files: {
							'index.php': '<?php',
						},
					},
				},
			},
		]);
		expect(validateBlueprintV2(migrated)).toEqual({ valid: true });
	});

	it('rejects v1 VFS resources during migration with an explicit error', () => {
		expect(() =>
			upgradeBlueprintV1ToV2({
				steps: [
					{
						step: 'writeFile',
						path: '/wordpress/copied.txt',
						data: {
							resource: 'vfs',
							path: '/wordpress/source.txt',
						},
					},
				],
			} as BlueprintV1Declaration)
		).toThrow(UnsupportedBlueprintV2FeatureError);
	});

	it('loads post type definitions from execution-context JSON files', () => {
		const blueprint = {
			version: 2,
			postTypes: {
				book: './post-types/book.json',
			},
		} as BlueprintV2Declaration;

		expect(validateBlueprintV2(blueprint)).toEqual({ valid: true });
		expect(createBlueprintV2ExecutionPlan(blueprint)).toMatchObject([
			{
				step: 'writeFile',
				path: '/wordpress/wp-content/mu-plugins/blueprint-post-type-book.json',
				data: {
					resource: 'bundled',
					path: 'post-types/book.json',
				},
			},
			{
				step: 'writeFile',
				path: '/wordpress/wp-content/mu-plugins/blueprint-post-type-book.php',
				data: {
					resource: 'literal',
					contents: expect.stringContaining(
						'register_post_type("book", $args);'
					),
				},
			},
		]);

		expect(
			validateBlueprintV2({
				version: 2,
				postTypes: {
					book: 'not-a-path',
				},
			})
		).toEqual({
			valid: false,
			errors: [
				{
					path: '/postTypes/book',
					message: 'must be an execution-context path or object',
				},
			],
		});
	});
});
