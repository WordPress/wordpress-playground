import { getWordPressPopupUrl } from './wordpress-popup';

vi.mock('virtual:website-config', () => ({ buildVersion: 'test' }));

describe('Personal WP popup routing', () => {
	beforeEach(() =>
		vi.stubGlobal('window', {
			location: { origin: 'https://personal.example' },
		})
	);
	afterEach(() => vi.unstubAllGlobals());

	it('keeps same-origin WordPress tools on their existing URL', () => {
		const target =
			'https://personal.example/scope:site/adminer/?table=posts#row';
		expect(getWordPressPopupUrl(target)).toBe(target);
	});

	it('preserves split-origin destinations through the custom app host', () => {
		const target =
			'https://wordpress.example/scope:site/adminer/?table=posts#row';
		const popup = new URL(getWordPressPopupUrl(target));
		expect(popup.origin).toBe('https://personal.example');
		expect(popup.hash.substring(1)).toBe(target);
	});
});
