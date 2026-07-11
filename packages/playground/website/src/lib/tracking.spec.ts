// @vitest-environment jsdom

import type { BlueprintV1 } from '@wp-playground/blueprints';
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
});
