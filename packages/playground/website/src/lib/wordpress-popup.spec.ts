import { getWordPressPopupUrl } from './wordpress-popup';

vi.mock('virtual:website-config', () => ({ buildVersion: 'test' }));

describe('WordPress popup URLs', () => {
	beforeEach(() => {
		vi.stubGlobal('window', {
			location: { origin: 'http://playground.localhost:9500' },
		});
	});
	afterEach(() => vi.unstubAllGlobals());

	it('keeps same-origin popup URLs unchanged', () => {
		const url =
			'http://playground.localhost:9500/scope:site/adminer/?select=wp_posts';
		expect(getWordPressPopupUrl(url)).toBe(url);
	});

	it('preserves the scoped path, query and fragment inside the app-origin popup', () => {
		const popup = new URL(
			getWordPressPopupUrl(
				'http://wp.playground.localhost:9500/scope:site/adminer/?select=wp_posts#result'
			)
		);
		expect(popup.origin).toBe('http://playground.localhost:9500');
		expect(popup.pathname).toBe('/wordpress-popup.html');
		expect(popup.search).toBe('');
		expect(popup.hash).toBe('#/scope:site/adminer/?select=wp_posts#result');
	});
});
