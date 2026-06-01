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

	it('preserves Blueprint v2 login intent when the login query parameter is absent', async () => {
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
