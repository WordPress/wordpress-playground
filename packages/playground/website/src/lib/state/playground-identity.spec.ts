import type { RuntimeConfiguration } from '@wp-playground/blueprints';
import type { SiteInfo } from './redux/slice-sites';
import {
	getAutosaveFingerprintFromURL,
	getAutosaveFingerprintFromSite,
	getRuntimeBootFingerprint,
	getSetupUrlFromUrl,
} from './playground-identity';

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

describe('getSetupUrlFromUrl', () => {
	it('keeps setup query params and drops routing and UI params', () => {
		const setupUrl = getSetupUrlFromUrl(
			new URL(
				'https://playground.test/?php=8.3&php-extension=https://example.com/ext.json&plugin=a&plugin=b' +
					'&site-slug=demo&storage=temp&random=abc&modal=save-site' +
					'&can-save=no#blueprint'
			)
		);

		expect(setupUrl.toString()).toBe(
			'https://playground.test/?php=8.3&php-extension=https%3A%2F%2Fexample.com%2Fext.json&plugin=a&plugin=b#blueprint'
		);
	});
});

describe('getRuntimeBootFingerprint', () => {
	const runtimeConfiguration: RuntimeConfiguration = {
		phpVersion: '8.3',
		wpVersion: '6.8',
		intl: false,
		networking: false,
		extraLibraries: [],
		constants: {},
	};

	it('changes when iframe boot settings change', () => {
		expect(
			getRuntimeBootFingerprint({
				...runtimeConfiguration,
				phpVersion: '8.3',
			})
		).not.toBe(
			getRuntimeBootFingerprint({
				...runtimeConfiguration,
				phpVersion: '8.4',
			})
		);

		expect(
			getRuntimeBootFingerprint({
				...runtimeConfiguration,
				networking: false,
			})
		).not.toBe(
			getRuntimeBootFingerprint({
				...runtimeConfiguration,
				networking: true,
			})
		);

		expect(
			getRuntimeBootFingerprint({
				...runtimeConfiguration,
				extraLibraries: [],
			})
		).not.toBe(
			getRuntimeBootFingerprint({
				...runtimeConfiguration,
				extraLibraries: ['wp-cli'],
			})
		);
	});

	it('changes when PHP constants change', () => {
		expect(
			getRuntimeBootFingerprint({
				...runtimeConfiguration,
				constants: {
					WP_DEBUG: true,
				},
			})
		).not.toBe(
			getRuntimeBootFingerprint({
				...runtimeConfiguration,
				constants: {
					SITE_URL: 'https://playground.test',
				},
			})
		);
	});
});
