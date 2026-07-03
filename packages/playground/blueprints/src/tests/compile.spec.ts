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
