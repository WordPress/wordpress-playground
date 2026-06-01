import { afterEach, describe, expect, it, vi } from 'vitest';
import type { BlueprintV1Declaration } from '@wp-playground/blueprints';
import type { SiteMetadata } from '../state/redux/slice-sites';
import {
	classifyBlueprintUrl,
	getBlueprintUsageStatsProperties,
	getSiteUsageStatsProperties,
	getUsageStatsDate,
	isUsageStatsAllowedOnCurrentHost,
	logPersonalWpEvent,
	shouldLogReturningVisitUsageStats,
} from './usage-stats';

describe('Personal WP usage stats', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('sends best-effort events to the configured endpoint', () => {
		vi.stubGlobal('location', {
			hostname: 'my.wordpress.net',
		});
		const fetchImpl = vi.fn().mockResolvedValue(new Response(null));

		logPersonalWpEvent(
			'returning_visit',
			{
				site_age_bucket: '8-30-days',
			},
			{
				endpoint: 'https://usage-stats.example.test/events',
				fetchImpl,
			}
		);

		expect(fetchImpl).toHaveBeenCalledOnce();
		const [url, init] = fetchImpl.mock.calls[0];
		expect(url).toBe('https://usage-stats.example.test/events');
		expect(init).toMatchObject({
			method: 'POST',
			credentials: 'omit',
			keepalive: true,
			mode: 'no-cors',
			headers: {
				'content-type': 'text/plain;charset=UTF-8',
			},
		});
		expect(JSON.parse(init.body)).toMatchObject({
			schema: 'personal-wp-event/v1',
			app: 'personal-wp',
			event: 'returning_visit',
			properties: {
				site_age_bucket: '8-30-days',
			},
		});
	});

	it('does not call fetch without an endpoint', () => {
		const fetchImpl = vi.fn();

		logPersonalWpEvent(
			'returning_visit',
			{},
			{
				endpoint: undefined,
				fetchImpl,
			}
		);

		expect(fetchImpl).not.toHaveBeenCalled();
	});

	it('does not call fetch outside my.wordpress.net', () => {
		vi.stubGlobal('location', {
			hostname: 'staging.my.wordpress.net',
		});
		const fetchImpl = vi.fn();

		logPersonalWpEvent(
			'returning_visit',
			{},
			{
				endpoint: 'https://my.wordpress.net/mywp-event.php',
				fetchImpl,
			}
		);

		expect(fetchImpl).not.toHaveBeenCalled();
		expect(isUsageStatsAllowedOnCurrentHost()).toBe(false);
	});

	it('allows usage stats on my.wordpress.net', () => {
		vi.stubGlobal('location', {
			hostname: 'my.wordpress.net',
		});

		expect(isUsageStatsAllowedOnCurrentHost()).toBe(true);
	});

	it('summarizes site details without stable identifiers', () => {
		const now = Date.UTC(2026, 4, 28);
		const metadata: SiteMetadata = {
			storage: 'opfs',
			id: 'site-id-that-must-not-be-reported',
			name: 'Private Client Site',
			whenCreated: now - 12 * 24 * 60 * 60 * 1000,
			lastAccessDate: now - 2 * 24 * 60 * 60 * 1000,
			originalBlueprint: {},
			originalBlueprintSource: {
				type: 'remote-url',
				url: 'https://private.example.test/blueprint.json?token=secret',
			},
			runtimeConfiguration: {
				phpVersion: '8.4',
				wpVersion: 'latest',
				intl: true,
				networking: false,
				extraLibraries: ['wp-cli'],
				constants: {
					WP_DEBUG: true,
				},
			},
		};

		const properties = getSiteUsageStatsProperties(metadata, now);

		expect(properties).toEqual({
			site_age_bucket: '8-30-days',
			previous_visit_age_bucket: '1-7-days',
		});
		expect(JSON.stringify(properties)).not.toContain('Private Client Site');
		expect(JSON.stringify(properties)).not.toContain(
			'site-id-that-must-not-be-reported'
		);
	});

	it('deduplicates returning visits by UTC day in local metadata', () => {
		const now = Date.UTC(2026, 4, 28, 23, 30);
		const metadata = {
			storage: 'opfs',
			whenCreated: now - 30 * 24 * 60 * 60 * 1000,
			lastAccessDate: now - 24 * 60 * 60 * 1000,
		} as SiteMetadata;

		expect(getUsageStatsDate(now)).toBe('2026-05-28');
		expect(shouldLogReturningVisitUsageStats(metadata, now)).toBe(true);

		metadata.lastUsageStatsReturningVisitDate = '2026-05-28';
		expect(shouldLogReturningVisitUsageStats(metadata, now)).toBe(false);

		expect(
			shouldLogReturningVisitUsageStats(
				metadata,
				Date.UTC(2026, 4, 29, 0, 1)
			)
		).toBe(true);
	});

	it('summarizes blueprint details without full URLs or content fields', () => {
		const blueprint = {
			login: true,
			landingPage: '/wp-admin/admin.php?page=secret',
			plugins: ['friends', 'Invalid Plugin Name'],
			steps: [
				{
					step: 'installPlugin',
					pluginData: {
						resource: 'wordpress.org/plugins',
						slug: 'woocommerce',
					},
				},
				{
					step: 'installPlugin',
					pluginZipFile: {
						resource: 'url',
						url: 'https://private.example.test/plugin.zip?token=secret',
					},
				},
				{
					step: 'writeFile',
					path: '/wordpress/wp-content/private.txt',
					data: {
						resource: 'literal',
						contents: 'user@example.test',
					},
				},
				{
					step: 'x'.repeat(100),
					file: {
						resource: 'data:application/zip;base64,private',
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
		} as unknown as BlueprintV1Declaration;

		const properties = getBlueprintUsageStatsProperties(
			blueprint,
			'https://private.example.test/blueprint.json?token=secret'
		);

		expect(properties).toEqual({
			blueprint_source: 'external-url',
		});

		const serialized = JSON.stringify(properties);
		expect(serialized).not.toContain('private.example.test');
		expect(serialized).not.toContain('token=secret');
		expect(serialized).not.toContain('user@example.test');
		expect(serialized).not.toContain('/wp-admin/admin.php');
		expect(serialized).not.toContain('woocommerce');
		expect(serialized).not.toContain('twentytwentyfive');
	});

	it('reports only safe plugin slugs from app blueprint plugin installs', () => {
		const properties = getBlueprintUsageStatsProperties(
			{
				steps: [
					{
						step: 'installPlugin',
						pluginData: {
							resource: 'git:directory',
							url: 'https://github.com/akirk/ai-assistant',
						},
						options: {
							targetFolderName: 'ai-assistant',
						},
					},
					{
						step: 'installPlugin',
						pluginData: {
							resource: 'wordpress.org/plugins',
							slug: 'friends',
						},
					},
					{
						step: 'installPlugin',
						pluginData: {
							resource: 'git:directory',
							url: 'https://github.com/akirk/send-to-e-reader.git',
						},
					},
					{
						step: 'installPlugin',
						pluginData: {
							resource: 'git:directory',
							url: 'https://private.example.test/private-plugin',
						},
					},
					{
						step: 'installPlugin',
						pluginData: {
							resource: 'wordpress.org/plugins',
							slug: 'Invalid Plugin Name',
						},
					},
				],
			} as unknown as BlueprintV1Declaration,
			'/blueprints/apps/ai-assistant.json',
			{ requestSource: 'my-apps' }
		);

		expect(properties.plugin_slugs).toEqual([
			'ai-assistant',
			'friends',
			'send-to-e-reader',
			'unknown',
		]);
		expect(JSON.stringify(properties)).not.toContain(
			'private.example.test'
		);
	});

	it('classifies blueprint URLs instead of reporting them', () => {
		vi.stubGlobal('location', {
			href: 'https://playground.wordpress.net/',
			origin: 'https://playground.wordpress.net',
		});

		expect(classifyBlueprintUrl('/blueprint.json')).toBe('same-origin');
		expect(
			classifyBlueprintUrl(
				'https://raw.githubusercontent.com/WordPress/blueprints/trunk/blueprint.json'
			)
		).toBe('github');
		expect(classifyBlueprintUrl('data:application/json,{}')).toBe(
			'data-url'
		);
		expect(classifyBlueprintUrl('http://[invalid')).toBe('invalid-url');
	});

	it('does not report blueprint identifiers', () => {
		vi.stubGlobal('location', {
			href: 'https://playground.wordpress.net/',
			origin: 'https://playground.wordpress.net',
		});

		const properties = getBlueprintUsageStatsProperties(
			{
				steps: [],
			},
			'/blueprints/chat-to-blog/blueprint.json?token=secret',
			{ requestSource: 'my-apps' }
		);

		expect(properties).toEqual({
			blueprint_source: 'same-origin',
		});
		expect(JSON.stringify(properties)).not.toContain('token=secret');
	});
});
