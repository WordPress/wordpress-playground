import { InMemoryFilesystem } from '@wp-playground/storage';
import { vi } from 'vitest';
import { compileBlueprintForExecution } from '../lib/compile';
import type { BlueprintV1Declaration } from '../lib/v1/types';
import type { BlueprintV2Declaration } from '../lib/v2/blueprint-v2-declaration';

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
			'setSiteLanguage',
			'mkdir',
			'defineWpConfigConsts',
			'setSiteOptions',
			'installPlugin',
			'installTheme',
			'wp-cli',
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
		]);
		expect(
			compiled.compiled.unsupportedPlan.map((item) => item.type)
		).toEqual(['importMedia', 'runStep']);
	});

	it('rejects running Blueprint v2 plans until plan items are wired', async () => {
		const compiled = await compileBlueprintForExecution({
			version: 2,
			siteOptions: {
				blogname: 'Compiled but not runnable yet',
			},
		});

		await expect(compiled.run({} as any)).rejects.toThrow(
			'executionPlan: Blueprint v2 execution plans are not runnable by the TypeScript runner yet.'
		);
	});
});
