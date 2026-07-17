import { describe, expect, it } from 'vitest';
import { getDisplayedSitePath } from './displayed-site-path';

describe('getDisplayedSitePath', () => {
	it('passes ordinary paths through unchanged', () => {
		expect(getDisplayedSitePath('/wp-admin/')).toBe('/wp-admin/');
		expect(getDisplayedSitePath('/?p=1')).toBe('/?p=1');
	});

	it('shows the redirection target instead of the handler URL', () => {
		const url =
			'/index.php?playground-redirection-handler&next=' +
			encodeURIComponent('http://localhost:5400/scope:my-app/');
		expect(getDisplayedSitePath(url)).toBe('/');
	});

	it('keeps the target path, query, and hash', () => {
		const url =
			'/index.php?playground-redirection-handler&next=' +
			encodeURIComponent(
				'http://localhost:5400/scope:my-app/docs/?page=2#top'
			);
		expect(getDisplayedSitePath(url)).toBe('/docs/?page=2#top');
	});

	it('leaves the URL alone when the target is missing or malformed', () => {
		expect(
			getDisplayedSitePath('/index.php?playground-redirection-handler')
		).toBe('/index.php?playground-redirection-handler');
	});
});
