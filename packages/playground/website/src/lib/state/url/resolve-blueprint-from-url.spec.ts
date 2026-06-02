import { describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
	const g = globalThis as any;
	if (typeof g.window === 'undefined') {
		g.window = {};
	}
	g.window.self = g.window;
	g.window.top = g.window;
	g.location = new URL('https://playground.test/');
	g.window.location = g.location;
});

// eslint-disable-next-line import/first
import {
	applyQueryOverrides,
	resolveBlueprintFromURL,
} from './resolve-blueprint-from-url';
// eslint-disable-next-line import/first
import { createBlueprintV2ExecutionPlan } from '@wp-playground/blueprints';
// eslint-disable-next-line import/first
import { GENERATED_GUTENBERG_INSTALLER_MARKER } from '../../gutenberg-preview';

describe('resolveBlueprintFromURL', () => {
	it('allows query API plugin installs to fail without skipping later plugins', async () => {
		const result = await resolveBlueprintFromURL(
			new URL(
				'https://playground.test/?plugin=activitypub&plugin=inexistant&plugin=biscotti'
			)
		);

		expect(result.source).toEqual({ type: 'none' });
		expect(result.blueprint).toMatchObject({
			steps: [
				{
					step: 'installPlugin',
					pluginData: {
						resource: 'wordpress.org/plugins',
						slug: 'activitypub',
					},
					options: {
						activate: true,
						onError: 'skip-plugin',
					},
				},
				{
					step: 'installPlugin',
					pluginData: {
						resource: 'wordpress.org/plugins',
						slug: 'inexistant',
					},
					options: {
						activate: true,
						onError: 'skip-plugin',
					},
				},
				{
					step: 'installPlugin',
					pluginData: {
						resource: 'wordpress.org/plugins',
						slug: 'biscotti',
					},
					options: {
						activate: true,
						onError: 'skip-plugin',
					},
				},
			],
		});
	});

	it('allows query API theme installs to fail without skipping later themes', async () => {
		const result = await resolveBlueprintFromURL(
			new URL(
				'https://playground.test/?theme=pendant&theme=inexistant&theme=disco'
			)
		);

		expect(result.source).toEqual({ type: 'none' });
		expect(result.blueprint).toMatchObject({
			steps: [
				{
					step: 'installTheme',
					themeData: {
						resource: 'wordpress.org/themes',
						slug: 'pendant',
					},
					options: {
						activate: false,
						onError: 'skip-theme',
					},
				},
				{
					step: 'installTheme',
					themeData: {
						resource: 'wordpress.org/themes',
						slug: 'inexistant',
					},
					options: {
						activate: false,
						onError: 'skip-theme',
					},
				},
				{
					step: 'installTheme',
					themeData: {
						resource: 'wordpress.org/themes',
						slug: 'disco',
					},
					options: {
						activate: true,
						onError: 'skip-theme',
					},
				},
			],
		});
	});

	it('applies Query API platform overrides to Blueprint v2 declarations', async () => {
		const result = await applyQueryOverrides(
			{
				version: 2,
				phpVersion: '8.0',
				wordpressVersion: '6.4',
				applicationOptions: {
					'wordpress-playground': {
						login: true,
					},
				},
			},
			new URLSearchParams(
				'php=8.1&wp=6.3&login=no&url=/custom.php&networking=no&language=es_ES&multisite=yes'
			)
		);

		expect(result).toMatchObject({
			version: 2,
			phpVersion: '8.1',
			wordpressVersion: '6.3',
			applicationOptions: {
				'wordpress-playground': {
					login: false,
					landingPage: '/custom.php',
					networkAccess: false,
				},
			},
			additionalStepsAfterExecution: [
				{
					step: 'defineConstants',
					constants: {
						WP_DEVELOPMENT_MODE: 'all',
					},
				},
				{
					step: 'setSiteLanguage',
					language: 'es_ES',
				},
				{
					step: 'enableMultisite',
				},
			],
		});
	});

	it('applies Query API install and WXR controls to Blueprint v2 declarations', async () => {
		const result = await applyQueryOverrides(
			{
				version: 2,
				additionalStepsAfterExecution: [
					{
						step: 'mkdir',
						path: '/wordpress/existing',
					},
				],
			},
			new URLSearchParams(
				'plugin=activitypub&plugin=https://github.com/example/plugin&theme=pendant&theme=disco&import-wxr=https://example.com/content.wxr'
			)
		);

		expect(result).toMatchObject({
			version: 2,
			additionalStepsAfterExecution: [
				{
					step: 'mkdir',
					path: '/wordpress/existing',
				},
				{
					step: 'installPlugin',
					source: 'activitypub',
					active: true,
					onError: 'skip-plugin',
				},
				{
					step: 'installPlugin',
					source: {
						gitRepository: 'https://github.com/example/plugin',
						ref: 'HEAD',
					},
					active: true,
					onError: 'skip-plugin',
				},
				{
					step: 'installTheme',
					source: 'pendant',
					active: false,
					onError: 'skip-theme',
				},
				{
					step: 'installTheme',
					source: 'disco',
					active: true,
					onError: 'skip-theme',
				},
				{
					step: 'importContent',
					content: [
						{
							type: 'wxr',
							source: 'https://example.com/content.wxr',
							authorsMode: 'default-author',
							defaultAuthorUsername: 'admin',
							importComments: true,
						},
					],
				},
			],
		});

		expect(createBlueprintV2ExecutionPlan(result as any)).toContainEqual(
			expect.objectContaining({
				step: 'importWxr',
				file: {
					resource: 'url',
					url: 'https://example.com/content.wxr',
				},
				authorsMode: 'default-author',
				defaultAuthorUsername: 'admin',
				importComments: true,
			})
		);
	});

	it('rejects unsupported Query API import-site on Blueprint v2 declarations', async () => {
		await expect(
			applyQueryOverrides(
				{
					version: 2,
				},
				new URLSearchParams('import-site=https://example.com/site.zip')
			)
		).rejects.toThrow(/import-site/);
	});

	it('defaults Blueprint v2 login while preserving explicit Blueprint login intent', async () => {
		await expect(
			applyQueryOverrides(
				{
					version: 2,
				},
				new URLSearchParams('php=8.2')
			)
		).resolves.toMatchObject({
			version: 2,
			applicationOptions: {
				'wordpress-playground': {
					login: true,
				},
			},
		});

		await expect(
			applyQueryOverrides(
				{
					version: 2,
					applicationOptions: {
						'wordpress-playground': {
							login: false,
						},
					},
				},
				new URLSearchParams('php=8.2')
			)
		).resolves.toMatchObject({
			version: 2,
			applicationOptions: {
				'wordpress-playground': {
					login: false,
				},
			},
		});

		await expect(
			applyQueryOverrides(
				{
					version: 2,
					applicationOptions: {
						'wordpress-playground': {
							login: false,
						},
					},
				},
				new URLSearchParams('login=yes')
			)
		).resolves.toMatchObject({
			version: 2,
			applicationOptions: {
				'wordpress-playground': {
					login: true,
				},
			},
		});
	});

	it('defaults Blueprint v2 networking while preserving explicit Blueprint networking intent', async () => {
		await expect(
			applyQueryOverrides(
				{
					version: 2,
				},
				new URLSearchParams('')
			)
		).resolves.toMatchObject({
			version: 2,
			applicationOptions: {
				'wordpress-playground': {
					networkAccess: true,
				},
			},
		});

		await expect(
			applyQueryOverrides(
				{
					version: 2,
					applicationOptions: {
						'wordpress-playground': {
							networkAccess: false,
						},
					},
				},
				new URLSearchParams('')
			)
		).resolves.toMatchObject({
			version: 2,
			applicationOptions: {
				'wordpress-playground': {
					networkAccess: false,
				},
			},
		});

		await expect(
			applyQueryOverrides(
				{
					version: 2,
					applicationOptions: {
						'wordpress-playground': {
							networkAccess: true,
						},
					},
				},
				new URLSearchParams('networking=no')
			)
		).resolves.toMatchObject({
			version: 2,
			applicationOptions: {
				'wordpress-playground': {
					networkAccess: false,
				},
			},
		});
	});

	it('applies Query API runtime defaults to Blueprint v2 declarations', async () => {
		await expect(
			applyQueryOverrides(
				{
					version: 2,
				},
				new URLSearchParams('')
			)
		).resolves.toMatchObject({
			version: 2,
			phpVersion: '8.3',
			wordpressVersion: 'latest',
		});
	});

	it('applies core PR previews to Blueprint v2 declarations', async () => {
		const result = await applyQueryOverrides(
			{ version: 2 },
			new URLSearchParams('core-pr=12345')
		);

		expect(result).toMatchObject({
			version: 2,
			wordpressVersion:
				'https://playground.test/plugin-proxy.php?org=WordPress&repo=wordpress-develop&workflow=Test%20Build%20Processes&artifact=wordpress-build-12345&pr=12345',
		});
	});

	it('applies Gutenberg Query API previews to Blueprint v2 declarations', async () => {
		const result = await applyQueryOverrides(
			{
				version: 2,
				additionalStepsAfterExecution: [
					{
						step: 'mkdir',
						path: 'site:wp-content/uploads/existing',
					},
				],
			},
			new URLSearchParams('gutenberg-pr=73010')
		);

		expect(result).toMatchObject({
			version: 2,
			applicationOptions: {
				'wordpress-playground': {
					networkAccess: true,
				},
			},
			additionalStepsAfterExecution: [
				{
					step: 'runPHP',
					code: {
						filename: 'install-gutenberg.php',
					},
					env: {
						[GENERATED_GUTENBERG_INSTALLER_MARKER]: '1',
					},
				},
				{
					step: 'mkdir',
					path: 'site:wp-content/uploads/existing',
				},
			],
		});
		expect(
			(result as any).additionalStepsAfterExecution[0].code.content
		).toContain(
			'https://playground.test/plugin-proxy.php?org=WordPress&repo=gutenberg'
		);
		expect(
			(result as any).additionalStepsAfterExecution[0].code.content
		).toContain('&pr=73010');
	});
});
