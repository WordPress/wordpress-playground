import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { PlaygroundRoute } from './router';
import { getAppBaseUrl } from './app-base-url';
import type { SiteInfo } from '../redux/slice-sites';

describe('PlaygroundRoute', () => {
	beforeAll(() => {
		vi.stubGlobal('window', {
			location: {
				href: 'https://example.com/',
				origin: 'https://example.com',
			},
		});
	});

	afterAll(() => {
		vi.unstubAllGlobals();
	});

	it('strips Playground query keys and preserves WordPress/plugin params at the app base path', () => {
		const url =
			appBaseUrlWithSearch(
				'url=%2Fwp-admin%2F&blueprint-url=https%3A%2F%2Fexample.com%2Fblueprint.json&plugin=friends&playground-recovery-mode=health-check&app-store=1&p=42'
			) + '#legacy-blueprint';
		const expected = appBaseUrlWithSearch('app-store=1&p=42');

		expect(PlaygroundRoute.site(createDefaultSite(), url)).toBe(expected);
	});

	it('preserves all search params on WordPress subdirectories', () => {
		const url =
			'https://example.com/wp-admin/admin.php?url=%2Fwp-admin%2F&blueprint-url=https%3A%2F%2Fexample.com%2Fblueprint.json&plugin=friends&app-store=1&p=42';

		expect(PlaygroundRoute.site(createDefaultSite(), url)).toBe(url);
	});

	it('preserves all search params on WordPress subdirectories when adding site slugs', () => {
		const url =
			'https://example.com/wp-admin/admin.php?url=%2Fwp-admin%2F&blueprint-url=https%3A%2F%2Fexample.com%2Fblueprint.json&plugin=friends&app-store=1&p=42';

		expect(PlaygroundRoute.site(createSite('second-site'), url)).toBe(
			`${url}&site-slug=second-site`
		);
	});

	it('preserves the experimental Blueprint runner when adding site slugs', () => {
		const url = appBaseUrlWithSearch(
			'experimental-blueprints-v2-runner=yes&app-store=1'
		);
		const result = new URL(
			PlaygroundRoute.site(createSite('second-site'), url)
		);

		expect(result.searchParams.get('site-slug')).toBe('second-site');
		expect(
			result.searchParams.get('experimental-blueprints-v2-runner')
		).toBe('yes');
		expect(result.searchParams.has('app-store')).toBe(false);
	});
});

function appBaseUrlWithSearch(search: string): string {
	const url = getAppBaseUrl();
	url.search = search;
	return url.toString();
}

function createDefaultSite(): SiteInfo {
	return createSite('default');
}

function createSite(slug: string): SiteInfo {
	return {
		slug,
		metadata: {
			storage: 'opfs',
		},
	} as SiteInfo;
}
