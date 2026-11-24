// @vitest-environment jsdom

import type {
	BlueprintBundle,
	BlueprintV1,
	BlueprintV2Declaration,
} from '@wp-playground/blueprints';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { logBlueprintEvents } from './tracking';

describe('logBlueprintEvents', () => {
	afterEach(() => {
		window.gtag = undefined;
	});

	it('logs plugin and theme slugs when available', async () => {
		const gtag = vi.fn();
		window.gtag = gtag;

		await logBlueprintEvents({
			steps: [
				{
					step: 'installPlugin',
					pluginData: {
						resource: 'wordpress.org/plugins',
						slug: 'gutenberg',
					},
				},
				{
					step: 'installTheme',
					themeData: {
						resource: 'wordpress.org/themes',
						slug: 'twentytwentyfive',
					},
				},
			],
		} as BlueprintV1);

		expect(gtag).toHaveBeenCalledWith('event', 'installPlugin', {
			resource: 'wordpress.org/plugins',
			plugin: 'gutenberg',
		});
		expect(gtag).toHaveBeenCalledWith('event', 'installTheme', {
			resource: 'wordpress.org/themes',
			theme: 'twentytwentyfive',
		});
	});

	it('logs the prefixed resource type when there is no slug', async () => {
		const gtag = vi.fn();
		window.gtag = gtag;

		await logBlueprintEvents({
			steps: [
				{
					step: 'installPlugin',
					pluginData: {
						resource: 'url',
						url: 'https://example.com/plugin.zip',
					},
				},
				{
					step: 'installTheme',
					themeData: {
						resource: 'git:directory',
						url: 'https://github.com/example/theme',
					},
				},
			],
		} as BlueprintV1);

		expect(gtag).toHaveBeenCalledWith('event', 'installPlugin', {
			resource: 'url',
			plugin: 'resource:url',
		});
		expect(gtag).toHaveBeenCalledWith('event', 'installTheme', {
			resource: 'git:directory',
			theme: 'resource:git:directory',
		});
	});

	it('logs v2 operations without exposing data-reference details', async () => {
		const gtag = vi.fn();
		window.gtag = gtag;
		const blueprint = {
			version: 2,
			constants: { WP_DEBUG: true },
			siteOptions: { blogname: 'Private site name' },
			plugins: [
				'gutenberg@latest',
				{
					source: 'https://private.example/plugin.zip?token=secret',
				},
			],
			themes: [
				{
					gitRepository: 'https://private.example/theme.git',
					ref: 'private-branch',
				},
			],
			activeTheme: 'twentytwentyfive',
			muPlugins: [
				{
					filename: 'private-mu-plugin.php',
					content: '<?php // secret code',
				},
			],
			media: ['./private-image.png'],
			siteLanguage: 'pl_PL',
			additionalStepsAfterExecution: [
				{
					step: 'installPlugin',
					source: './private-plugin.zip',
				},
				{
					step: 'installTheme',
					source: {
						directoryName: 'private-theme',
						files: {},
					},
				},
				{
					step: 'runPHP',
					code: {
						filename: 'private-code.php',
						content: '<?php // another secret',
					},
				},
			],
		} satisfies BlueprintV2Declaration;

		await logBlueprintEvents(blueprint);

		expect(gtag).toHaveBeenCalledWith('event', 'step', {
			step: 'defineWpConfigConsts',
		});
		expect(gtag).toHaveBeenCalledWith('event', 'step', {
			step: 'installMuPlugin',
		});
		expect(gtag).toHaveBeenCalledWith('event', 'step', {
			step: 'runPHP',
		});
		expect(gtag).toHaveBeenCalledWith('event', 'installPlugin', {
			resource: 'wordpress.org/plugins',
			plugin: 'gutenberg@latest',
		});
		expect(gtag).toHaveBeenCalledWith('event', 'installPlugin', {
			resource: 'url',
			plugin: 'resource:url',
		});
		expect(gtag).toHaveBeenCalledWith('event', 'installPlugin', {
			resource: 'bundled',
			plugin: 'resource:bundled',
		});
		expect(gtag).toHaveBeenCalledWith('event', 'installTheme', {
			resource: 'git:directory',
			theme: 'resource:git:directory',
		});
		expect(gtag).toHaveBeenCalledWith('event', 'installTheme', {
			resource: 'literal:directory',
			theme: 'resource:literal:directory',
		});

		const reportedData = JSON.stringify(gtag.mock.calls);
		expect(reportedData).not.toContain('private.example');
		expect(reportedData).not.toContain('private-plugin.zip');
		expect(reportedData).not.toContain('private-theme');
		expect(reportedData).not.toContain('secret code');
	});

	it('reads v2 events from Blueprint bundles', async () => {
		const gtag = vi.fn();
		window.gtag = gtag;
		const bundle = {
			read: vi.fn(async () => ({
				text: async () =>
					JSON.stringify({
						version: 2,
						additionalStepsAfterExecution: [
							{
								step: 'mkdir',
								path: 'wp-content/uploads',
							},
						],
					}),
			})),
		} as unknown as BlueprintBundle;

		await logBlueprintEvents(bundle);

		expect(gtag).toHaveBeenCalledWith('event', 'step', {
			step: 'mkdir',
		});
	});
});
