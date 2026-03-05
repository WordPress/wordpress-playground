import { PHP } from '@php-wasm/universal';
import {
	compileBlueprintV1,
	runBlueprintV1Steps,
	validateBlueprint,
} from './compile';
import { defineWpConfigConsts } from '../steps/define-wp-config-consts';
import { RecommendedPHPVersion } from '@wp-playground/common';
import { PHPRequestHandler } from '@php-wasm/universal';
import { loadNodeRuntime } from '@php-wasm/node';
import { expect, describe, it, beforeEach, test } from 'vitest';
import fs from 'fs';
import path from 'path';
import { ZipFilesystem, InMemoryFilesystem } from '@wp-playground/storage';

describe('Blueprints', () => {
	let php: PHP;
	let requestHandler: PHPRequestHandler;
	beforeEach(async () => {
		requestHandler = new PHPRequestHandler({
			phpFactory: async () =>
				new PHP(await loadNodeRuntime(RecommendedPHPVersion)),
			documentRoot: '/',
		});
		php = await requestHandler.getPrimaryPhp();
	});

	it('should run a basic blueprint', async () => {
		await runBlueprintV1Steps(
			await compileBlueprintV1({
				steps: [
					{
						step: 'writeFile',
						path: '/index.php',
						data: `<?php echo 'Hello World';`,
					},
				],
			}),
			php
		);
		expect(php.fileExists('/index.php')).toBe(true);
		expect(php.readFileAsText('/index.php')).toBe(
			`<?php echo 'Hello World';`
		);
	});

	it('should define the consts in a json and auto load the defined constants', async () => {
		// Define the constants to be tested
		const consts = {
			TEST_CONST: 'test_value',
			SITE_URL: 'http://test.url',
			WP_AUTO_UPDATE_CORE: false,
		};

		php.writeFile('/wp-config.php', '<?php ');

		// Call the function with the constants and the playground client
		// Step1: define the constants
		await defineWpConfigConsts(php, {
			consts,
		});

		// Assert execution of echo statements
		php.writeFile(
			'/index.php',
			'<?php require "/wp-config.php"; echo TEST_CONST;'
		);
		let result = await requestHandler.request({ url: '/index.php' });
		expect(result.text).toBe('test_value');

		php.writeFile(
			'/index.php',
			'<?php require "/wp-config.php"; echo SITE_URL;'
		);
		result = await requestHandler.request({ url: '/index.php' });
		expect(result.text).toBe('http://test.url');

		php.writeFile(
			'/index.php',
			'<?php require "/wp-config.php"; var_dump(WP_AUTO_UPDATE_CORE);'
		);
		result = await requestHandler.request({ url: '/index.php' });
		expect(result.text.trim()).toBe('bool(false)');
	});

	it('Should boot with WP-CLI support if the wpCli feature is enabled', async () => {
		await runBlueprintV1Steps(
			await compileBlueprintV1({
				extraLibraries: ['wp-cli'],
			}),
			php
		);
		expect(php.fileExists('/tmp/wp-cli.phar')).toBe(true);
	});

	it('should compile and run a zip-based blueprint', async () => {
		// Load the real zip file from the test directory
		const zipPath = path.resolve(
			__dirname,
			'../../../tests/fixtures/blueprint.zip'
		);
		const zipData = fs.readFileSync(zipPath).buffer;
		const zipBundle = ZipFilesystem.fromArrayBuffer(zipData);
		const compiledBlueprint = await compileBlueprintV1(zipBundle);

		await runBlueprintV1Steps(compiledBlueprint, php);

		expect(php.fileExists('/index.php')).toBe(true);
		expect(php.readFileAsText('/index.php')).toContain('<?php echo');

		expect(php.fileExists('/pygmalion.txt')).toBe(true);
		expect(php.readFileAsText('/pygmalion.txt')).toContain(
			'PREFACE TO PYGMALION.'
		);
	});

	it('should compile and run a file-tree-based blueprint', async () => {
		const fileTreeBundle = new InMemoryFilesystem({
			'pygmalion.txt': 'PREFACE TO PYGMALION.',
			'blueprint.json': JSON.stringify({
				steps: [
					{
						step: 'writeFile',
						path: '/text_file.txt',
						data: {
							resource: 'bundled',
							path: 'pygmalion.txt',
						},
					},
				],
			}),
		});
		const compiledBlueprint = await compileBlueprintV1(fileTreeBundle);

		await runBlueprintV1Steps(compiledBlueprint, php);

		expect(php.fileExists('/text_file.txt')).toBe(true);
		expect(php.readFileAsText('/text_file.txt')).toContain(
			'PREFACE TO PYGMALION.'
		);
	});

	describe('Validation', () => {
		const validBlueprints = [
			{},
			{
				steps: [],
			},
		];
		it.each(validBlueprints)(
			'valid Blueprint should pass validation',
			(blueprint) => {
				expect(validateBlueprint(blueprint)).toEqual({
					valid: true,
				});
			}
		);

		describe('Invalid Blueprints should not pass validation', () => {
			test('extra properties', () => {
				const invalidBlueprint = {
					invalidProperty: 'foo',
				};
				expect(validateBlueprint(invalidBlueprint)).toEqual({
					valid: false,
					errors: [
						{
							instancePath: '',
							keyword: 'additionalProperties',
							params: {
								additionalProperty: 'invalidProperty',
							},
							message: 'must NOT have additional properties',
							schemaPath: expect.any(String),
						},
					],
				});
			});
			test('invalid properties', () => {
				const invalidBlueprint = {
					steps: 1,
				};
				expect(validateBlueprint(invalidBlueprint)).toEqual({
					valid: false,
					errors: [
						{
							instancePath: '/steps',
							keyword: 'type',
							params: {
								type: 'array',
							},
							message: 'must be array',
							schemaPath: expect.any(String),
						},
					],
				});
			});
			test('invalid steps definition', () => {
				const invalidBlueprint = {
					steps: [
						{
							step: 'installTheme',
							// A common type:
							pluginsZipFile: {
								resource: 'wordpress.org/themes',
								slug: 'twentytwenty',
							},
						},
					],
				};
				expect(validateBlueprint(invalidBlueprint)).toEqual({
					valid: false,
					errors: [
						{
							instancePath: '/steps/0',
							keyword: 'required',
							params: {
								missingProperty: 'themeData',
							},
							message: "must have required property 'themeData'",
							schemaPath: expect.any(String),
						},
					],
				});
			});
			test('invalid step type', () => {
				const invalidBlueprint = {
					steps: [14],
				};
				expect(validateBlueprint(invalidBlueprint)).toEqual({
					valid: false,
					errors: [
						{
							instancePath: '/steps/0',
							keyword: 'type',
							params: {
								type: 'object',
							},
							message: 'must be object',
							schemaPath: expect.any(String),
						},
					],
				});
			});
		});
	});

	describe('plugins shorthand', () => {
		it('should convert a slug string to a wordpress.org/plugins resource', async () => {
			let validatedBlueprint: any;
			await compileBlueprintV1(
				{ plugins: ['gutenberg'] },
				{
					onBlueprintValidated: (bp) => {
						validatedBlueprint = bp;
					},
				}
			);
			const step = validatedBlueprint.steps[0];
			expect(step.step).toBe('installPlugin');
			expect(step.pluginData).toEqual({
				resource: 'wordpress.org/plugins',
				slug: 'gutenberg',
			});
		});

		it('should convert a ZIP URL to a url resource', async () => {
			let validatedBlueprint: any;
			await compileBlueprintV1(
				{
					plugins: ['https://example.com/my-plugin.zip'],
				},
				{
					onBlueprintValidated: (bp) => {
						validatedBlueprint = bp;
					},
				}
			);
			const step = validatedBlueprint.steps[0];
			expect(step.pluginData).toEqual({
				resource: 'url',
				url: 'https://example.com/my-plugin.zip',
			});
		});

		it('should convert a GitHub repo URL to a zip(git:directory) resource', async () => {
			let validatedBlueprint: any;
			await compileBlueprintV1(
				{
					plugins: ['https://github.com/user/project'],
				},
				{
					onBlueprintValidated: (bp) => {
						validatedBlueprint = bp;
					},
				}
			);
			const step = validatedBlueprint.steps[0];
			expect(step.pluginData).toEqual({
				resource: 'zip',
				inner: {
					resource: 'git:directory',
					url: 'https://github.com/user/project',
					ref: 'HEAD',
				},
			});
		});

		it('should handle a GitHub repo URL with trailing slash', async () => {
			let validatedBlueprint: any;
			await compileBlueprintV1(
				{
					plugins: ['https://github.com/user/project/'],
				},
				{
					onBlueprintValidated: (bp) => {
						validatedBlueprint = bp;
					},
				}
			);
			const step = validatedBlueprint.steps[0];
			expect(step.pluginData).toEqual({
				resource: 'zip',
				inner: {
					resource: 'git:directory',
					url: 'https://github.com/user/project',
					ref: 'HEAD',
				},
			});
		});

		it('should convert a GitLab .git URL to a zip(git:directory) resource', async () => {
			let validatedBlueprint: any;
			await compileBlueprintV1(
				{
					plugins: ['https://gitlab.com/group/project.git'],
				},
				{
					onBlueprintValidated: (bp) => {
						validatedBlueprint = bp;
					},
				}
			);
			const step = validatedBlueprint.steps[0];
			expect(step.pluginData).toEqual({
				resource: 'zip',
				inner: {
					resource: 'git:directory',
					url: 'https://gitlab.com/group/project',
					ref: 'HEAD',
				},
			});
		});

		it('should convert a nested GitLab subgroup URL to a zip(git:directory) resource', async () => {
			let validatedBlueprint: any;
			await compileBlueprintV1(
				{
					plugins: ['https://gitlab.com/group/subgroup/project'],
				},
				{
					onBlueprintValidated: (bp) => {
						validatedBlueprint = bp;
					},
				}
			);
			const step = validatedBlueprint.steps[0];
			expect(step.pluginData).toEqual({
				resource: 'zip',
				inner: {
					resource: 'git:directory',
					url: 'https://gitlab.com/group/subgroup/project',
					ref: 'HEAD',
				},
			});
		});

		it('should convert a self-hosted .git URL to a zip(git:directory) resource', async () => {
			let validatedBlueprint: any;
			await compileBlueprintV1(
				{
					plugins: ['https://git.example.com/org/repo.git'],
				},
				{
					onBlueprintValidated: (bp) => {
						validatedBlueprint = bp;
					},
				}
			);
			const step = validatedBlueprint.steps[0];
			expect(step.pluginData).toEqual({
				resource: 'zip',
				inner: {
					resource: 'git:directory',
					url: 'https://git.example.com/org/repo',
					ref: 'HEAD',
				},
			});
		});

		it('should treat a GitHub archive URL as a url resource, not a repo', async () => {
			let validatedBlueprint: any;
			await compileBlueprintV1(
				{
					plugins: [
						'https://github.com/user/project/archive/refs/heads/main.zip',
					],
				},
				{
					onBlueprintValidated: (bp) => {
						validatedBlueprint = bp;
					},
				}
			);
			const step = validatedBlueprint.steps[0];
			expect(step.pluginData).toEqual({
				resource: 'url',
				url: 'https://github.com/user/project/archive/refs/heads/main.zip',
			});
		});
	});

	describe('Deprecated PHP version upgrade', () => {
		it('should accept PHP 7.2 in blueprint and upgrade to 7.4', async () => {
			const blueprint = {
				preferredVersions: {
					php: '7.2' as any,
					wp: 'latest',
				},
			};

			// Should pass validation
			const validationResult = validateBlueprint(blueprint);
			expect(validationResult).toEqual({ valid: true });

			// Should compile and upgrade to 7.4
			const compiled = await compileBlueprintV1(blueprint);
			expect(compiled.versions.php).toBe('7.4');
		});

		it('should accept PHP 7.3 in blueprint and upgrade to 7.4', async () => {
			const blueprint = {
				preferredVersions: {
					php: '7.3' as any,
					wp: 'latest',
				},
			};

			// Should pass validation
			const validationResult = validateBlueprint(blueprint);
			expect(validationResult).toEqual({ valid: true });

			// Should compile and upgrade to 7.4
			const compiled = await compileBlueprintV1(blueprint);
			expect(compiled.versions.php).toBe('7.4');
		});

		it('should accept PHP 7.4 and later versions without changes', async () => {
			const versions = ['7.4', '8.0', '8.1', '8.2', '8.3', '8.4', '8.5'];

			for (const version of versions) {
				const blueprint = {
					preferredVersions: {
						php: version as any,
						wp: 'latest',
					},
				};

				// Should pass validation
				const validationResult = validateBlueprint(blueprint);
				expect(validationResult).toEqual({ valid: true });

				// Should compile without changing the version
				const compiled = await compileBlueprintV1(blueprint);
				expect(compiled.versions.php).toBe(version);
			}
		});
	});
});
