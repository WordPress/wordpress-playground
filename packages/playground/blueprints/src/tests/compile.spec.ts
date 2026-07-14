import { InMemoryFilesystem } from '@wp-playground/storage';
import { ProgressTracker } from '@php-wasm/progress';
import { vi } from 'vitest';
import { compileBlueprintForExecution } from '../lib/compile';
import type { BlueprintV1Declaration } from '../lib/v1/types';
import type { BlueprintV2Declaration } from '../lib/v2/blueprint-v2-declaration';
import type { InvalidBlueprintError } from '../lib/invalid-blueprint-error';
import { lowerBlueprintV2ExecutionPlan } from '../lib/v2/compile';

function withoutProgress(step: any) {
	const rest = { ...step };
	delete rest.progress;
	return rest;
}

function withoutProgressFromSteps(steps: any[]) {
	return steps.map(withoutProgress);
}

describe('compileBlueprintForExecution', () => {
	it('compiles Blueprint v1 declarations through the v1 compiler', async () => {
		const declaration: BlueprintV1Declaration = {
			steps: [
				{
					step: 'mkdir',
					path: '/wordpress/cache',
				},
			],
		};

		const compiled = await compileBlueprintForExecution(declaration);

		expect(compiled.version).toBe(1);
		expect(compiled.declaration).toBe(declaration);
		expect(compiled.compiled).toHaveProperty('versions');
		expect(compiled.run).toBe(compiled.compiled.run);
	});

	it('compiles Blueprint v1 bundles with bundled resources', async () => {
		const bundle = new InMemoryFilesystem({
			'message.txt': 'Hello from a bundled file.',
			'blueprint.json': JSON.stringify({
				steps: [
					{
						step: 'writeFile',
						path: '/message.txt',
						data: {
							resource: 'bundled',
							path: 'message.txt',
						},
					},
				],
			}),
		});
		const playground = {
			writeFile: vi.fn(),
		};

		const compiled = await compileBlueprintForExecution(bundle);
		await compiled.run(playground as any);

		expect(compiled.version).toBe(1);
		expect(compiled.declaration).toEqual({
			steps: [
				{
					step: 'writeFile',
					path: '/message.txt',
					data: {
						resource: 'bundled',
						path: 'message.txt',
					},
				},
			],
		});
		expect(playground.writeFile).toHaveBeenCalledTimes(1);
		const [path, data] = playground.writeFile.mock.calls[0];
		expect(path).toBe('/message.txt');
		expect(await new File([data], 'message.txt').text()).toBe(
			'Hello from a bundled file.'
		);
	});

	it('compiles minimal Blueprint v2 declarations through the TypeScript runner', async () => {
		const declaration = {
			version: 2,
			phpVersion: '8.3',
		} as const;
		const playground = {};

		const compiled = await compileBlueprintForExecution(declaration);
		await compiled.run(playground as any);

		expect(compiled.version).toBe(2);
		if (compiled.version !== 2) {
			throw new Error('Expected a compiled Blueprint v2 result.');
		}
		expect(compiled.declaration).toBe(declaration);
		expect(compiled.compiled.runtime).toMatchObject({
			phpVersion: '8.3',
			wpVersion: 'latest',
		});
		expect(compiled.compiled.plan).toEqual([]);
	});

	it('reports a validated Blueprint v2 declaration exactly once', async () => {
		const declaration = { version: 2 } as const;
		const onBlueprintValidated = vi.fn();

		const compiled = await compileBlueprintForExecution(declaration, {
			onBlueprintValidated,
		});
		await compiled.run({} as any);

		expect(onBlueprintValidated).toHaveBeenCalledOnce();
		expect(onBlueprintValidated).toHaveBeenCalledWith(declaration);
	});

	it('reports schema success before runtime configuration fails', async () => {
		const declaration = { version: 2, phpVersion: '5.6' } as const;
		const onBlueprintValidated = vi.fn();

		await expect(
			compileBlueprintForExecution(declaration, {
				onBlueprintValidated,
			})
		).rejects.toThrow('Unsupported Blueprint v2 PHP version "5.6"');
		expect(onBlueprintValidated).toHaveBeenCalledOnce();
		expect(onBlueprintValidated).toHaveBeenCalledWith(declaration);
	});

	it('compiles existing-site v2 constraints without selecting a download', async () => {
		const compiled = await compileBlueprintForExecution(
			{
				version: 2,
				wordpressVersion: {
					min: '6.8.2',
					max: '6.8.4',
				},
			},
			{ siteMode: 'apply-to-existing-site' }
		);

		expect(compiled.version).toBe(2);
		if (compiled.version !== 2) {
			throw new Error('Expected a compiled Blueprint v2 result.');
		}
		expect(compiled.compiled.runtime.wpVersion).toBe('latest');
	});

	it('compiles Blueprint v2 declarations from raw JSON', async () => {
		const compiled = await compileBlueprintForExecution(
			JSON.stringify({
				version: 2,
				constants: {
					WP_DEBUG: true,
				},
			})
		);

		expect(compiled.version).toBe(2);
		if (compiled.version !== 2) {
			throw new Error('Expected a compiled Blueprint v2 result.');
		}
		expect(compiled.declaration).toEqual({
			version: 2,
			constants: {
				WP_DEBUG: true,
			},
		});
		expect(compiled.compiled.plan).toEqual([
			{
				type: 'defineWpConfigConsts',
				consts: {
					WP_DEBUG: true,
				},
			},
		]);
	});

	it('rejects Blueprint v1 declarations from raw JSON', async () => {
		await expect(
			compileBlueprintForExecution(
				JSON.stringify({
					steps: [
						{
							step: 'mkdir',
							path: '/wordpress/cache',
						},
					],
				})
			)
		).rejects.toThrow(
			'Raw JSON input is only supported for Blueprint v2 declarations.'
		);
	});

	it('rejects invalid raw JSON input', async () => {
		await expect(
			compileBlueprintForExecution('{ "version": 2')
		).rejects.toThrow('Raw JSON input must be valid JSON.');
	});

	it('rejects malformed Blueprint v2 declarations from raw JSON', async () => {
		const onBlueprintValidated = vi.fn();

		await expect(
			compileBlueprintForExecution(
				JSON.stringify({ version: 2, plugins: 'akismet' }),
				{ onBlueprintValidated }
			)
		).rejects.toMatchObject({
			name: 'InvalidBlueprintError',
			validationErrors: expect.arrayContaining([
				expect.objectContaining({ path: '/plugins' }),
			]),
		} satisfies Partial<InvalidBlueprintError>);
		expect(onBlueprintValidated).not.toHaveBeenCalled();
	});

	it('rejects malformed Blueprint v2 declarations from bundles', async () => {
		const bundle = new InMemoryFilesystem({
			'blueprint.json': JSON.stringify({ version: 2, pluginz: [] }),
		});

		await expect(
			compileBlueprintForExecution(bundle)
		).rejects.toMatchObject({
			name: 'InvalidBlueprintError',
			validationErrors: [
				{
					path: '/pluginz',
					message: 'must NOT have additional properties',
				},
			],
		} satisfies Partial<InvalidBlueprintError>);
	});

	it.each(['null', '[]'])(
		'rejects raw JSON %s as a Blueprint declaration',
		async (rawJson) => {
			await expect(compileBlueprintForExecution(rawJson)).rejects.toThrow(
				'Raw JSON input must contain a Blueprint declaration object.'
			);
		}
	);

	it('runs Blueprint v2 bundles with bundled execution-context resources', async () => {
		const bundle = new InMemoryFilesystem({
			'plugin.php': '<?php /* Plugin Name: Bundled Plugin */',
			'blueprint.json': JSON.stringify({
				version: 2,
				plugins: [
					{
						source: './plugin.php',
						active: false,
					},
				],
			}),
		});
		const playground = {
			documentRoot: '/wordpress',
			writeFile: vi.fn(),
		};

		const compiled = await compileBlueprintForExecution(bundle);
		await compiled.run(playground as any);

		expect(compiled.version).toBe(2);
		expect(playground.writeFile).toHaveBeenCalledWith(
			'/wordpress/wp-content/plugins/plugin.php',
			expect.any(Uint8Array)
		);
	});

	it('compiles Blueprint v2 declarations into an ordered execution plan', async () => {
		const declaration: BlueprintV2Declaration = {
			version: 2,
			applicationOptions: {
				'wordpress-playground': {
					landingPage: '/wp-admin/post-new.php',
					login: true,
				},
			},
			constants: {
				WP_DEBUG: true,
			},
			siteOptions: {
				blogname: 'Compiled v2 plan',
			},
			muPlugins: [
				{
					filename: 'mu-plugin.php',
					content: '<?php',
				},
			],
			themes: ['twentytwentythree'],
			activeTheme: {
				source: 'twentytwentyfour',
			},
			plugins: [
				{
					source: 'akismet',
					active: false,
				},
			],
			fonts: {
				inter: './fonts/inter.woff2',
			},
			media: ['./media/image.jpg'],
			siteLanguage: 'pl_PL',
			roles: [
				{
					name: 'movie_curator',
					capabilities: {
						read: 'true',
					},
				},
			],
			users: [
				{
					username: 'editor',
					email: 'editor@example.com',
					role: 'editor',
					meta: {},
				},
			],
			postTypes: {
				movie: './post-types/movie.php',
			},
			content: [
				{
					type: 'mysql-dump',
					source: './dump.sql',
				},
			],
			additionalStepsAfterExecution: [
				{
					step: 'mkdir',
					path: '/tmp/from-v2',
				},
			],
		};

		const compiled = await compileBlueprintForExecution(declaration);

		expect(compiled.version).toBe(2);
		if (compiled.version !== 2) {
			throw new Error('Expected a compiled Blueprint v2 result.');
		}
		expect(compiled.compiled.applicationOptions).toEqual(
			declaration.applicationOptions
		);
		expect(compiled.compiled.plan.map((item) => item.type)).toEqual([
			'defineWpConfigConsts',
			'setSiteOptions',
			'installMuPlugin',
			'installTheme',
			'installTheme',
			'installPlugin',
			'installFonts',
			'importMedia',
			'setSiteLanguage',
			'defineRoles',
			'defineUsers',
			'definePostTypes',
			'importContent',
			'runStep',
		]);
		expect(compiled.compiled.plan[0]).toEqual({
			type: 'defineWpConfigConsts',
			consts: declaration.constants,
		});
		expect(compiled.compiled.plan[1]).toEqual({
			type: 'setSiteOptions',
			options: declaration.siteOptions,
		});
		expect(compiled.compiled.plan[2]).toEqual({
			type: 'installMuPlugin',
			muPlugin: declaration.muPlugins?.[0],
			sourcePath: '/muPlugins/0',
		});
		expect(compiled.compiled.plan[3]).toEqual({
			type: 'installTheme',
			theme: declaration.themes?.[0],
			active: false,
			sourcePath: '/themes/0',
		});
		expect(compiled.compiled.plan[4]).toEqual({
			type: 'installTheme',
			theme: declaration.activeTheme,
			active: true,
			sourcePath: '/activeTheme',
		});
		expect(compiled.compiled.plan[5]).toEqual({
			type: 'installPlugin',
			plugin: declaration.plugins?.[0],
			sourcePath: '/plugins/0',
		});
		expect(compiled.compiled.plan[13]).toEqual({
			type: 'runStep',
			step: declaration.additionalStepsAfterExecution?.[0],
			sourcePath: '/additionalStepsAfterExecution/0',
		});
	});

	it('treats empty Blueprint v2 object fields as no-op plan inputs', async () => {
		const compiled = await compileBlueprintForExecution({
			version: 2,
			constants: {},
			siteOptions: {},
		});

		expect(compiled.version).toBe(2);
		if (compiled.version !== 2) {
			throw new Error('Expected a compiled Blueprint v2 result.');
		}
		expect(compiled.compiled.plan).toEqual([]);
		await expect(compiled.run({} as any)).resolves.toBeUndefined();
	});

	it('lowers supported Blueprint v2 plan items to v1-compatible step records', async () => {
		const declaration: BlueprintV2Declaration = {
			version: 2,
			constants: {
				WP_DEBUG: true,
			},
			siteOptions: {
				blogname: 'Lowered v2 plan',
			},
			themes: ['twentytwentythree'],
			activeTheme: {
				source: 'twentytwentyfour@1.2.3',
				humanReadableName: 'Twenty Twenty-Four',
			},
			plugins: [
				{
					source: 'akismet',
					active: false,
					ifAlreadyInstalled: 'skip',
					activationOptions: {
						mode: 'test',
					},
				},
			],
			media: ['./media/image.jpg'],
			siteLanguage: 'pl_PL',
			additionalStepsAfterExecution: [
				{
					step: 'mkdir',
					path: 'site:wp-content/uploads/from-v2',
				},
				{
					step: 'defineConstants',
					constants: {
						SCRIPT_DEBUG: true,
					},
				},
				{
					step: 'setSiteOptions',
					options: {
						timezone_string: 'Europe/Warsaw',
					},
				},
				{
					step: 'installPlugin',
					source: 'https://github.com/WordPress/wordpress-importer',
					active: true,
				},
				{
					step: 'installTheme',
					source: {
						directoryName: 'inline-theme',
						files: {
							'style.css': 'Theme Name: Inline',
						},
					},
					active: false,
				},
				{
					step: 'wp-cli',
					command: 'plugin list',
				},
				{
					step: 'runSQL',
					source: './dump.sql',
				},
			],
		};

		const compiled = await compileBlueprintForExecution(declaration);

		expect(compiled.version).toBe(2);
		if (compiled.version !== 2) {
			throw new Error('Expected a compiled Blueprint v2 result.');
		}
		expect(compiled.compiled.steps.map((step) => step.step)).toEqual([
			'defineWpConfigConsts',
			'setSiteOptions',
			'installTheme',
			'installTheme',
			'installPlugin',
			'writeFile',
			'runPHPWithOptions',
			'setSiteLanguage',
			'mkdir',
			'defineWpConfigConsts',
			'setSiteOptions',
			'installPlugin',
			'installTheme',
			'wp-cli',
			'runSql',
		]);
		expect(compiled.compiled.steps).toMatchObject([
			{
				step: 'defineWpConfigConsts',
				consts: {
					WP_DEBUG: true,
				},
			},
			{
				step: 'setSiteOptions',
				options: {
					blogname: 'Lowered v2 plan',
				},
			},
			{
				step: 'installTheme',
				themeData: {
					resource: 'wordpress.org/themes',
					slug: 'twentytwentythree',
				},
				options: {
					activate: false,
				},
			},
			{
				step: 'installTheme',
				themeData: {
					resource: 'url',
					url: 'https://downloads.wordpress.org/theme/twentytwentyfour.1.2.3.zip',
				},
				options: {
					activate: true,
					humanReadableName: 'Twenty Twenty-Four',
				},
			},
			{
				step: 'installPlugin',
				pluginData: {
					resource: 'wordpress.org/plugins',
					slug: 'akismet',
				},
				ifAlreadyInstalled: 'skip',
				options: {
					activate: false,
					activationOptions: {
						mode: 'test',
					},
				},
			},
			{
				step: 'writeFile',
				path: '/tmp/blueprint-media-0',
				data: {
					resource: 'bundled',
					path: 'media/image.jpg',
				},
			},
			{
				step: 'runPHPWithOptions',
				options: {
					env: {
						BLUEPRINT_MEDIA: JSON.stringify([
							{
								path: '/tmp/blueprint-media-0',
								filename: 'image.jpg',
							},
						]),
					},
				},
			},
			{
				step: 'setSiteLanguage',
				language: 'pl_PL',
			},
			{
				step: 'mkdir',
				path: '/wordpress/wp-content/uploads/from-v2',
			},
			{
				step: 'defineWpConfigConsts',
				consts: {
					SCRIPT_DEBUG: true,
				},
			},
			{
				step: 'setSiteOptions',
				options: {
					timezone_string: 'Europe/Warsaw',
				},
			},
			{
				step: 'installPlugin',
				pluginData: {
					resource: 'zip',
					inner: {
						resource: 'git:directory',
						url: 'https://github.com/WordPress/wordpress-importer',
						ref: 'HEAD',
					},
				},
				options: {
					activate: true,
				},
			},
			{
				step: 'installTheme',
				themeData: {
					resource: 'literal:directory',
					name: 'inline-theme',
					files: {
						'style.css': 'Theme Name: Inline',
					},
				},
				options: {
					activate: false,
				},
			},
			{
				step: 'wp-cli',
				command: 'plugin list',
			},
			{
				step: 'runSql',
				sql: {
					resource: 'bundled',
					path: 'dump.sql',
				},
			},
		]);
		expect(
			compiled.compiled.unsupportedPlan.map((item) => item.type)
		).toEqual([]);
	});

	it('lowers Blueprint v2 install options to v1 install step options', async () => {
		const compiled = await compileBlueprintForExecution({
			version: 2,
			plugins: [
				{
					source: './plugins/sample-plugin.zip',
					active: false,
					ifAlreadyInstalled: 'skip',
					onError: 'skip-plugin',
					targetDirectoryName: 'sample-plugin-target',
					humanReadableName: 'Sample Plugin',
					activationOptions: {
						source: 'blueprint-v2',
					},
				},
			],
			themes: [
				{
					source: './themes/sample-theme.zip',
					ifAlreadyInstalled: 'error',
					onError: 'skip-theme',
					targetDirectoryName: 'sample-theme-target',
					humanReadableName: 'Sample Theme',
				},
			],
			activeTheme: {
				source: './themes/active-theme.zip',
				ifAlreadyInstalled: 'overwrite',
				targetDirectoryName: 'active-theme-target',
				humanReadableName: 'Active Theme',
			},
		});

		expect(compiled.version).toBe(2);
		if (compiled.version !== 2) {
			throw new Error('Expected a compiled Blueprint v2 result.');
		}
		expect(withoutProgressFromSteps(compiled.compiled.steps)).toEqual([
			{
				step: 'installTheme',
				themeData: {
					resource: 'bundled',
					path: 'themes/sample-theme.zip',
				},
				ifAlreadyInstalled: 'error',
				options: {
					activate: false,
					importStarterContent: false,
					onError: 'skip-theme',
					targetFolderName: 'sample-theme-target',
					humanReadableName: 'Sample Theme',
				},
			},
			{
				step: 'installTheme',
				themeData: {
					resource: 'bundled',
					path: 'themes/active-theme.zip',
				},
				ifAlreadyInstalled: 'overwrite',
				options: {
					activate: true,
					importStarterContent: false,
					targetFolderName: 'active-theme-target',
					humanReadableName: 'Active Theme',
				},
			},
			{
				step: 'installPlugin',
				pluginData: {
					resource: 'bundled',
					path: 'plugins/sample-plugin.zip',
				},
				ifAlreadyInstalled: 'skip',
				options: {
					activate: false,
					activationOptions: {
						source: 'blueprint-v2',
					},
					onError: 'skip-plugin',
					targetFolderName: 'sample-plugin-target',
					humanReadableName: 'Sample Plugin',
				},
			},
		]);
		expect(compiled.compiled.unsupportedPlan).toEqual([]);
	});

	it('adds useful progress metadata to Blueprint v2 generated steps', async () => {
		const compiled = await compileBlueprintForExecution({
			version: 2,
			media: ['./media/image.jpg'],
			additionalStepsAfterExecution: [
				{
					step: 'mkdir',
					path: 'site:wp-content/uploads/from-v2',
				},
			],
		});

		expect(compiled.version).toBe(2);
		if (compiled.version !== 2) {
			throw new Error('Expected a compiled Blueprint v2 result.');
		}
		expect(
			compiled.compiled.steps.map((step) => ({
				step: step.step,
				progress: step.progress,
			}))
		).toEqual([
			{
				step: 'writeFile',
				progress: {
					caption: 'Importing media',
					weight: 0.5,
				},
			},
			{
				step: 'runPHPWithOptions',
				progress: {
					caption: 'Importing media',
					weight: 0.5,
				},
			},
			{
				step: 'mkdir',
				progress: {
					caption: 'Creating directory',
					weight: 1,
				},
			},
		]);
	});

	it('does not add progress metadata when a Blueprint v2 plan item produces no steps', () => {
		const result = lowerBlueprintV2ExecutionPlan([
			{
				type: 'runStep',
				step: {
					step: 'writeFiles',
					files: {},
				},
				sourcePath: '/additionalStepsAfterExecution/0',
			},
		]);

		expect(result).toEqual({
			steps: [],
			unsupportedPlan: [],
		});
	});

	it('reports Blueprint v2 progress through the provided progress tracker', async () => {
		const progress = new ProgressTracker();
		const events: Array<{ progress: number; caption: string }> = [];
		progress.addEventListener('progress', (event: any) => {
			events.push({
				progress: event.detail.progress,
				caption: event.detail.caption,
			});
		});
		const compiled = await compileBlueprintForExecution(
			{
				version: 2,
				additionalStepsAfterExecution: [
					{
						step: 'mkdir',
						path: 'site:wp-content/uploads/from-v2',
					},
				],
			},
			{ progress }
		);

		await compiled.run({
			mkdir: vi.fn(),
		} as any);

		expect(events).toContainEqual({
			progress: 0,
			caption: 'Creating directory',
		});
		expect(events.at(-1)?.progress).toBe(100);
	});

	it('lowers Blueprint v2 mysql-dump content to runSql steps', async () => {
		const compiled = await compileBlueprintForExecution({
			version: 2,
			content: [
				{
					type: 'mysql-dump',
					source: [
						'./dump.sql',
						{
							filename: 'inline.sql',
							content: 'SELECT 1;',
						},
						'https://example.com/dump.sql',
					],
				},
			],
		});

		expect(compiled.version).toBe(2);
		if (compiled.version !== 2) {
			throw new Error('Expected a compiled Blueprint v2 result.');
		}
		expect(withoutProgressFromSteps(compiled.compiled.steps)).toEqual([
			{
				step: 'runSql',
				sql: {
					resource: 'bundled',
					path: 'dump.sql',
				},
			},
			{
				step: 'runSql',
				sql: {
					resource: 'literal',
					name: 'inline.sql',
					contents: 'SELECT 1;',
				},
			},
			{
				step: 'runSql',
				sql: {
					resource: 'url',
					url: 'https://example.com/dump.sql',
				},
			},
		]);
		expect(compiled.compiled.unsupportedPlan).toEqual([]);
	});

	it('lowers single-source Blueprint v2 mysql-dump content to a runSql step', async () => {
		const compiled = await compileBlueprintForExecution({
			version: 2,
			content: [
				{
					type: 'mysql-dump',
					source: './single-dump.sql',
				},
			],
		});

		expect(compiled.version).toBe(2);
		if (compiled.version !== 2) {
			throw new Error('Expected a compiled Blueprint v2 result.');
		}
		expect(withoutProgressFromSteps(compiled.compiled.steps)).toEqual([
			{
				step: 'runSql',
				sql: {
					resource: 'bundled',
					path: 'single-dump.sql',
				},
			},
		]);
		expect(compiled.compiled.unsupportedPlan).toEqual([]);
	});

	it('reports the source index for invalid Blueprint v2 mysql-dump sources', async () => {
		const declaration = {
			version: 2,
			content: [
				{
					type: 'mysql-dump',
					source: ['./ok.sql', 'not-a-file-reference'],
				},
			],
		} as unknown as BlueprintV2Declaration;

		await expect(
			compileBlueprintForExecution(declaration)
		).rejects.toMatchObject({
			name: 'InvalidBlueprintError',
			validationErrors: expect.arrayContaining([
				expect.objectContaining({ path: '/content/0/source/1' }),
			]),
		} satisfies Partial<InvalidBlueprintError>);
	});

	it('lowers Blueprint v2 WXR content to importWxr steps', async () => {
		const compiled = await compileBlueprintForExecution({
			version: 2,
			content: [
				{
					type: 'wxr',
					source: [
						'./content.wxr',
						{
							filename: 'inline.wxr',
							content: '<rss />',
						},
					],
					staticAssets: 'hotlink',
					urlsMode: 'rewrite',
					urlsMap: {
						'https://old.example': 'https://new.example',
					},
					authorsMode: 'default-author',
					defaultAuthorUsername: 'editor',
					importComments: true,
				},
			],
		});

		expect(compiled.version).toBe(2);
		if (compiled.version !== 2) {
			throw new Error('Expected a compiled Blueprint v2 result.');
		}
		expect(withoutProgressFromSteps(compiled.compiled.steps)).toEqual([
			{
				step: 'importWxr',
				file: {
					resource: 'bundled',
					path: 'content.wxr',
				},
				fetchAttachments: false,
				rewriteUrls: true,
				urlMapping: {
					'https://old.example': 'https://new.example',
				},
				importComments: true,
				authorsMode: 'default-author',
				importUsers: false,
				defaultAuthorUsername: 'editor',
			},
			{
				step: 'importWxr',
				file: {
					resource: 'literal',
					name: 'inline.wxr',
					contents: '<rss />',
				},
				fetchAttachments: false,
				rewriteUrls: true,
				urlMapping: {
					'https://old.example': 'https://new.example',
				},
				importComments: true,
				authorsMode: 'default-author',
				importUsers: false,
				defaultAuthorUsername: 'editor',
			},
		]);
		expect(compiled.compiled.unsupportedPlan).toEqual([]);
	});

	it('lowers Blueprint v2 WXR author maps to importWxr steps', async () => {
		const compiled = await compileBlueprintForExecution({
			version: 2,
			content: [
				{
					type: 'wxr',
					source: './content.wxr',
					authorsMode: 'map',
					authorsMap: {
						remote: 'admin',
					},
				},
			],
		});

		expect(compiled.version).toBe(2);
		if (compiled.version !== 2) {
			throw new Error('Expected a compiled Blueprint v2 result.');
		}
		expect(withoutProgressFromSteps(compiled.compiled.steps)).toEqual([
			{
				step: 'importWxr',
				file: {
					resource: 'bundled',
					path: 'content.wxr',
				},
				fetchAttachments: true,
				rewriteUrls: true,
				importComments: false,
				authorsMode: 'map',
				importUsers: false,
				authorsMap: {
					remote: 'admin',
				},
			},
		]);
		expect(compiled.compiled.unsupportedPlan).toEqual([]);
	});

	it('lowers Blueprint v2 WXR user import options to importWxr steps', async () => {
		const compiled = await compileBlueprintForExecution({
			version: 2,
			content: [
				{
					type: 'wxr',
					source: './content.wxr',
					authorsMode: 'create',
					importUsers: true,
				},
			],
		});

		expect(compiled.version).toBe(2);
		if (compiled.version !== 2) {
			throw new Error('Expected a compiled Blueprint v2 result.');
		}
		expect(withoutProgressFromSteps(compiled.compiled.steps)).toEqual([
			{
				step: 'importWxr',
				file: {
					resource: 'bundled',
					path: 'content.wxr',
				},
				fetchAttachments: true,
				rewriteUrls: true,
				importComments: false,
				authorsMode: 'create',
				importUsers: true,
			},
		]);
		expect(compiled.compiled.unsupportedPlan).toEqual([]);
	});

	it('lowers Blueprint v2 importContent steps through content lowering', async () => {
		const compiled = await compileBlueprintForExecution({
			version: 2,
			additionalStepsAfterExecution: [
				{
					step: 'importContent',
					content: [
						{
							type: 'mysql-dump',
							source: './dump.sql',
						},
						{
							type: 'wxr',
							source: 'https://example.com/content.wxr',
							authorsMode: 'default-author',
						},
					],
				},
			],
		});

		expect(compiled.version).toBe(2);
		if (compiled.version !== 2) {
			throw new Error('Expected a compiled Blueprint v2 result.');
		}
		expect(withoutProgressFromSteps(compiled.compiled.steps)).toEqual([
			{
				step: 'runSql',
				sql: {
					resource: 'bundled',
					path: 'dump.sql',
				},
			},
			{
				step: 'importWxr',
				file: {
					resource: 'url',
					url: 'https://example.com/content.wxr',
				},
				fetchAttachments: true,
				rewriteUrls: true,
				importComments: false,
				authorsMode: 'default-author',
				importUsers: false,
			},
		]);
		expect(compiled.compiled.unsupportedPlan).toEqual([]);
	});

	it('lowers Blueprint v2 writeFiles steps to writeFile and writeFiles steps', async () => {
		const compiled = await compileBlueprintForExecution({
			version: 2,
			additionalStepsAfterExecution: [
				{
					step: 'writeFiles',
					files: {
						'site:wp-content/uploads/readme.txt': {
							filename: 'readme.txt',
							content: 'Hello',
						},
						'site:wp-content/plugins/inline-plugin': {
							directoryName: 'inline-plugin',
							files: {
								'index.php': '<?php',
							},
						},
						'site:wp-content/plugins/git-plugin': {
							gitRepository:
								'https://github.com/example/plugin.git',
							ref: 'main',
							pathInRepository: 'plugin',
						},
					},
				},
			],
		});

		expect(compiled.version).toBe(2);
		if (compiled.version !== 2) {
			throw new Error('Expected a compiled Blueprint v2 result.');
		}
		expect(withoutProgressFromSteps(compiled.compiled.steps)).toEqual([
			{
				step: 'writeFile',
				path: '/wordpress/wp-content/uploads/readme.txt',
				data: {
					resource: 'literal',
					name: 'readme.txt',
					contents: 'Hello',
				},
			},
			{
				step: 'writeFiles',
				writeToPath: '/wordpress/wp-content/plugins/inline-plugin',
				filesTree: {
					resource: 'literal:directory',
					name: 'inline-plugin',
					files: {
						'index.php': '<?php',
					},
				},
			},
			{
				step: 'writeFiles',
				writeToPath: '/wordpress/wp-content/plugins/git-plugin',
				filesTree: {
					resource: 'git:directory',
					url: 'https://github.com/example/plugin.git',
					ref: 'main',
					path: 'plugin',
				},
			},
		]);
		expect(compiled.compiled.unsupportedPlan).toEqual([]);
	});

	it('lowers Blueprint v2 unzip and inline runPHP steps', async () => {
		const compiled = await compileBlueprintForExecution({
			version: 2,
			additionalStepsAfterExecution: [
				{
					step: 'unzip',
					zipFile: './archive.zip',
					extractToPath: 'site:wp-content/uploads/imported',
				},
				{
					step: 'runPHP',
					code: {
						filename: 'script.php',
						content: '<?php echo "Hello";',
					},
				},
				{
					step: 'runPHP',
					code: {
						filename: 'script-with-env.php',
						content: '<?php echo getenv("MODE");',
					},
					env: {
						MODE: 'test',
					},
				},
			],
		});

		expect(compiled.version).toBe(2);
		if (compiled.version !== 2) {
			throw new Error('Expected a compiled Blueprint v2 result.');
		}
		expect(withoutProgressFromSteps(compiled.compiled.steps)).toEqual([
			{
				step: 'unzip',
				zipFile: {
					resource: 'bundled',
					path: 'archive.zip',
				},
				extractToPath: '/wordpress/wp-content/uploads/imported',
			},
			{
				step: 'runPHP',
				code: {
					filename: 'script.php',
					content: '<?php echo "Hello";',
				},
			},
			{
				step: 'runPHPWithOptions',
				options: {
					code: '<?php echo getenv("MODE");',
					env: {
						MODE: 'test',
					},
				},
			},
		]);
		expect(compiled.compiled.unsupportedPlan).toEqual([]);
	});

	it('lowers Blueprint v2 runPHP file references through a temp file', async () => {
		const compiled = await compileBlueprintForExecution({
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
		});

		expect(compiled.version).toBe(2);
		if (compiled.version !== 2) {
			throw new Error('Expected a compiled Blueprint v2 result.');
		}
		expect(withoutProgressFromSteps(compiled.compiled.steps)).toEqual([
			{
				step: 'writeFile',
				path: '/tmp/blueprint-run-php-0.php',
				data: {
					resource: 'bundled',
					path: 'scripts/bootstrap.php',
				},
			},
			{
				step: 'runPHPWithOptions',
				options: {
					code: '<?php require "/tmp/blueprint-run-php-0.php";',
					env: {
						MODE: 'test',
					},
				},
			},
		]);
		expect(compiled.compiled.unsupportedPlan).toEqual([]);
	});

	it('lowers Blueprint v2 posts content to PHP import steps', async () => {
		const compiled = await compileBlueprintForExecution({
			version: 2,
			content: [
				{
					type: 'posts',
					source: [
						{
							post_title: 'Inline post',
							post_content: '<p>Hello</p>',
							post_status: 'publish',
						},
						'./posts/about.html',
					],
					urlsMode: 'preserve',
				},
			],
		});

		expect(compiled.version).toBe(2);
		if (compiled.version !== 2) {
			throw new Error('Expected a compiled Blueprint v2 result.');
		}
		expect(withoutProgress(compiled.compiled.steps[0])).toEqual({
			step: 'writeFile',
			path: '/tmp/blueprint-post-content-0',
			data: {
				resource: 'bundled',
				path: 'posts/about.html',
			},
		});
		expect(compiled.compiled.steps[1]).toMatchObject({
			step: 'runPHPWithOptions',
			options: {
				env: {
					BLUEPRINT_URLS_MODE: 'preserve',
					BLUEPRINT_URLS_MAP: '{}',
				},
			},
		});
		const env = (compiled.compiled.steps[1] as any).options.env;
		expect(JSON.parse(env.BLUEPRINT_POSTS)).toEqual([
			{
				post_title: 'Inline post',
				post_content: '<p>Hello</p>',
				post_status: 'publish',
			},
		]);
		expect(JSON.parse(env.BLUEPRINT_POST_FILES)).toEqual([
			{
				path: '/tmp/blueprint-post-content-0',
				post_title: 'Untitled Post',
				post_type: 'post',
			},
		]);
		expect(compiled.compiled.unsupportedPlan).toEqual([]);
	});

	it('lowers Blueprint v2 mu-plugins to file writes', async () => {
		const compiled = await compileBlueprintForExecution({
			version: 2,
			muPlugins: [
				{
					filename: 'demo-mu.php',
					content: '<?php add_filter("the_title", "trim");',
				},
				{
					directoryName: 'mu-package',
					files: {
						'load.php': '<?php',
					},
				},
			],
		});

		expect(compiled.version).toBe(2);
		if (compiled.version !== 2) {
			throw new Error('Expected a compiled Blueprint v2 result.');
		}
		expect(withoutProgressFromSteps(compiled.compiled.steps)).toEqual([
			{
				step: 'writeFile',
				path: '/wordpress/wp-content/mu-plugins/demo-mu.php',
				data: {
					resource: 'literal',
					name: 'demo-mu.php',
					contents: '<?php add_filter("the_title", "trim");',
				},
			},
			{
				step: 'writeFiles',
				writeToPath: '/wordpress/wp-content/mu-plugins/mu-package',
				filesTree: {
					resource: 'literal:directory',
					name: 'mu-package',
					files: {
						'load.php': '<?php',
					},
				},
			},
		]);
		expect(compiled.compiled.unsupportedPlan).toEqual([]);
	});

	it('lowers Blueprint v2 importMedia steps to media import PHP', async () => {
		const compiled = await compileBlueprintForExecution({
			version: 2,
			additionalStepsAfterExecution: [
				{
					step: 'importMedia',
					media: [
						{
							source: './media/logo.png',
							title: 'Logo',
							alt: 'Site logo',
						},
					],
				},
			],
		});

		expect(compiled.version).toBe(2);
		if (compiled.version !== 2) {
			throw new Error('Expected a compiled Blueprint v2 result.');
		}
		expect(withoutProgress(compiled.compiled.steps[0])).toEqual({
			step: 'writeFile',
			path: '/tmp/blueprint-media-0',
			data: {
				resource: 'bundled',
				path: 'media/logo.png',
			},
		});
		const env = (compiled.compiled.steps[1] as any).options.env;
		expect(JSON.parse(env.BLUEPRINT_MEDIA)).toEqual([
			{
				path: '/tmp/blueprint-media-0',
				filename: 'logo.png',
				title: 'Logo',
				alt: 'Site logo',
			},
		]);
		expect(compiled.compiled.unsupportedPlan).toEqual([]);
	});

	it('lowers Blueprint v2 roles, users, post types, and fonts', async () => {
		const compiled = await compileBlueprintForExecution({
			version: 2,
			fonts: {
				'brand-sans': {
					filename: 'brand-sans.woff2',
					content: 'fontdata',
				},
			},
			roles: [
				{
					name: 'movie_curator',
					capabilities: {
						read: 'true',
						edit_posts: 'true',
					},
				},
			],
			users: [
				{
					username: 'curator',
					email: 'curator@example.com',
					role: 'movie_curator',
					meta: {
						department: 'film',
					},
				},
			],
			postTypes: {
				movie: {
					label: 'Movies',
					public: true,
					show_in_rest: true,
				},
			},
		});

		expect(compiled.version).toBe(2);
		if (compiled.version !== 2) {
			throw new Error('Expected a compiled Blueprint v2 result.');
		}
		expect(compiled.compiled.steps.map((step) => step.step)).toEqual([
			'writeFile',
			'runPHPWithOptions',
			'runPHPWithOptions',
			'runPHPWithOptions',
			'writeFile',
		]);
		expect(compiled.compiled.steps[0]).toMatchObject({
			path: '/tmp/blueprint-font-0',
			data: {
				resource: 'literal',
				name: 'brand-sans.woff2',
				contents: 'fontdata',
			},
		});
		const fontEnv = (compiled.compiled.steps[1] as any).options.env;
		expect(JSON.parse(fontEnv.BLUEPRINT_FONT_COLLECTIONS)[0]).toMatchObject(
			{
				slug: 'brand-sans',
				name: 'Brand Sans',
			}
		);
		expect(JSON.parse(fontEnv.BLUEPRINT_FONT_FILES)).toEqual({
			'blueprint-font-file:font-0': {
				path: '/tmp/blueprint-font-0',
				filename: 'brand-sans.woff2',
			},
		});
		expect(
			JSON.parse(
				(compiled.compiled.steps[2] as any).options.env.BLUEPRINT_ROLES
			)
		).toEqual([
			{
				name: 'movie_curator',
				capabilities: {
					read: 'true',
					edit_posts: 'true',
				},
			},
		]);
		expect(
			JSON.parse(
				(compiled.compiled.steps[3] as any).options.env.BLUEPRINT_USERS
			)
		).toEqual([
			{
				username: 'curator',
				email: 'curator@example.com',
				role: 'movie_curator',
				meta: {
					department: 'film',
				},
			},
		]);
		expect(compiled.compiled.steps[4]).toMatchObject({
			step: 'writeFile',
			path: '/wordpress/wp-content/mu-plugins/blueprint-post-type-0.php',
			data: {
				resource: 'literal',
				name: 'blueprint-post-type-0.php',
			},
		});
		expect((compiled.compiled.steps[4] as any).data.contents).toContain(
			'register_post_type("movie"'
		);
		expect(compiled.compiled.unsupportedPlan).toEqual([]);
	});

	it('rejects empty Blueprint v2 target-site paths', async () => {
		await expect(
			compileBlueprintForExecution({
				version: 2,
				additionalStepsAfterExecution: [
					{
						step: 'rm',
						path: '',
					},
				],
			} as BlueprintV2Declaration)
		).rejects.toThrow('Invalid Blueprint v2 path: must not be empty.');
	});

	it('treats absolute data paths as Blueprint execution-context paths', async () => {
		const compiled = await compileBlueprintForExecution({
			version: 2,
			plugins: [
				{
					source: '/plugins/local-plugin.zip',
				},
			],
		});

		expect(compiled.version).toBe(2);
		if (compiled.version !== 2) {
			throw new Error('Expected a compiled Blueprint v2 result.');
		}
		expect(compiled.compiled.steps[0]).toMatchObject({
			step: 'installPlugin',
			pluginData: {
				resource: 'bundled',
				path: 'plugins/local-plugin.zip',
			},
		});
	});

	it('treats Blueprint v2 WordPress.org slugs as opaque strings', async () => {
		const compiled = await compileBlueprintForExecution({
			version: 2,
			plugins: [
				{
					source: 'wtyczka-żółć',
				},
				{
					source: 'opaque@not-a-supported-version',
				},
			],
		});

		expect(compiled.version).toBe(2);
		if (compiled.version !== 2) {
			throw new Error('Expected a compiled Blueprint v2 result.');
		}
		expect(compiled.compiled.steps).toMatchObject([
			{
				step: 'installPlugin',
				pluginData: {
					resource: 'wordpress.org/plugins',
					slug: 'wtyczka-żółć',
				},
			},
			{
				step: 'installPlugin',
				pluginData: {
					resource: 'wordpress.org/plugins',
					slug: 'opaque@not-a-supported-version',
				},
			},
		]);
	});

	it('preserves special inline directory filenames as plain file entries', async () => {
		const compiled = await compileBlueprintForExecution({
			version: 2,
			plugins: [
				{
					source: {
						directoryName: 'inline-plugin',
						files: {
							['__proto__']: 'not a prototype',
						},
					},
				},
			],
		});

		expect(compiled.version).toBe(2);
		if (compiled.version !== 2) {
			throw new Error('Expected a compiled Blueprint v2 result.');
		}
		const pluginData = (compiled.compiled.steps[0] as any).pluginData;
		expect(
			Object.prototype.hasOwnProperty.call(pluginData.files, '__proto__')
		).toBe(true);
		expect(pluginData.files.__proto__).toBe('not a prototype');
		expect(Object.getPrototypeOf(pluginData.files)).toBe(Object.prototype);
	});

	it('runs fully lowered Blueprint v2 plans through the v1 runner', async () => {
		const compiled = await compileBlueprintForExecution({
			version: 2,
			additionalStepsAfterExecution: [
				{
					step: 'mkdir',
					path: 'site:wp-content/uploads/from-v2',
				},
			],
		});
		const playground = {
			mkdir: vi.fn(),
		};

		await compiled.run(playground as any);

		expect(playground.mkdir).toHaveBeenCalledWith(
			'/wordpress/wp-content/uploads/from-v2'
		);
	});

	it('rejects unknown Blueprint v2 content before producing a plan', async () => {
		const declaration = {
			version: 2,
			content: [
				{
					type: 'unsupported-content',
				},
			],
		} as unknown as BlueprintV2Declaration;

		await expect(
			compileBlueprintForExecution(declaration)
		).rejects.toMatchObject({
			name: 'InvalidBlueprintError',
			validationErrors: expect.arrayContaining([
				expect.objectContaining({ path: '/content/0/type' }),
			]),
		} satisfies Partial<InvalidBlueprintError>);
	});
});
