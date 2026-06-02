import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getBrowserPathAsLandingPage } from './landing-page';
import { getAppBaseUrl } from './app-base-url';

describe('getBrowserPathAsLandingPage', () => {
	beforeEach(() => {
		vi.stubGlobal('window', {
			location: {
				origin: 'https://example.com',
			},
		});
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('preserves front-page WordPress query params at the app base path', () => {
		expect(
			getBrowserPathAsLandingPage({
				pathname: getAppBaseUrl().pathname,
				search: '?p=42&s=term&plugin=friends&app-store=1',
			})
		).toBe('/?p=42&s=term&app-store=1');
	});

	it('ignores app base path searches that only contain Playground params', () => {
		expect(
			getBrowserPathAsLandingPage({
				pathname: getAppBaseUrl().pathname,
				search: '?plugin=friends&blueprint-url=https%3A%2F%2Fexample.com%2Fblueprint.json',
			})
		).toBeUndefined();
	});

	it('preserves all search params on reflected WordPress paths', () => {
		expect(
			getBrowserPathAsLandingPage({
				pathname: '/wp-admin/edit.php',
				search: '?post_type=page',
			})
		).toBe('/wp-admin/edit.php?post_type=page');
	});
});
