import type { SiteInfo } from '../redux/slice-sites';
import {
	getAutosaveFingerprintFromURL,
	getAutosaveFingerprintFromSite,
} from './setup-url';

describe('getAutosaveFingerprintFromURL', () => {
	it('ignores runtime, UI, and cache-busting parameters', () => {
		const first = getAutosaveFingerprintFromURL(
			new URL(
				'https://playground.test/?php=8.3&wp=6.8&random=abc' +
					'&modal=save-site&site-slug=demo&_=1&cacheBustWhatever=1#'
			)
		);
		const second = getAutosaveFingerprintFromURL(
			new URL('https://playground.test/?wp=6.8&php=8.3&cb=2&ts=3&v=4')
		);

		expect(first).toBe(second);
	});

	it('keeps setup-affecting parameters distinct', () => {
		expect(
			getAutosaveFingerprintFromURL(
				new URL('https://playground.test/?php=8.3&wp=6.8')
			)
		).not.toBe(
			getAutosaveFingerprintFromURL(
				new URL('https://playground.test/?php=8.4&wp=6.8')
			)
		);
	});

	it('includes the blueprint fragment', () => {
		expect(
			getAutosaveFingerprintFromURL(
				new URL('https://playground.test/#one')
			)
		).not.toBe(
			getAutosaveFingerprintFromURL(
				new URL('https://playground.test/#two')
			)
		);
	});

	it('normalizes stored site metadata like URL search parameters', () => {
		const site = {
			slug: 'test-site',
			originalUrlParams: {
				searchParams: { wp: '6.8', php: '8.3' },
				hash: '#blueprint',
			},
			metadata: {},
		} as unknown as SiteInfo;

		expect(getAutosaveFingerprintFromSite(site)).toBe(
			getAutosaveFingerprintFromURL(
				new URL('https://playground.test/?php=8.3&wp=6.8#blueprint')
			)
		);
	});

	it('normalizes repeated URL parameters like stored metadata arrays', () => {
		const site = {
			slug: 'test-site',
			originalUrlParams: {
				searchParams: {
					plugin: ['a', 'b'],
					theme: 'twentytwentyfive',
				},
			},
			metadata: {},
		} as unknown as SiteInfo;

		expect(getAutosaveFingerprintFromSite(site)).toBe(
			getAutosaveFingerprintFromURL(
				new URL(
					'https://playground.test/?plugin=a&plugin=b&theme=twentytwentyfive'
				)
			)
		);
	});

	it('treats repeated setup parameter order as insignificant', () => {
		expect(
			getAutosaveFingerprintFromURL(
				new URL(
					'https://playground.test/?plugin=a&plugin=b&theme=twentytwentyfive'
				)
			)
		).toBe(
			getAutosaveFingerprintFromURL(
				new URL(
					'https://playground.test/?theme=twentytwentyfive&plugin=b&plugin=a'
				)
			)
		);
	});
});
