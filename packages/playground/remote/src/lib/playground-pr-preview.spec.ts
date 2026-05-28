import {
	getPlaygroundPrPreviewFromUrl,
	getPlaygroundPrPreviewServiceWorkerUrl,
	mapToPlaygroundPrPreviewUrl,
	shouldBypassPlaygroundPrPreview,
	shouldMapToPlaygroundPrPreview,
} from './playground-pr-preview';

describe('getPlaygroundPrPreviewFromUrl', () => {
	it('accepts a matching preview service worker URL', () => {
		expect(
			getPlaygroundPrPreviewFromUrl(
				'https://playground.test/playground-pr-preview-sw.js?playground-pr=123&playground-pr-sha=abcdef1'
			)
		).toEqual({
			pr: '123',
			sha: 'abcdef1',
			basePath: '/pr-previews/123/abcdef1/',
		});
	});

	it('rejects URLs where params and path disagree', () => {
		expect(
			getPlaygroundPrPreviewFromUrl(
				'https://playground.test/pr-previews/123/abcdef1/sw.js?playground-pr=124&playground-pr-sha=abcdef1'
			)
		).toBeUndefined();
	});
});

describe('getPlaygroundPrPreviewServiceWorkerUrl', () => {
	it('points preview remote.html pages at the preview service worker', () => {
		const serviceWorkerUrl = getPlaygroundPrPreviewServiceWorkerUrl(
			'/sw.js',
			'https://playground.test',
			'https://playground.test/remote.html?playground-pr=123&playground-pr-sha=abcdef1'
		);

		expect(serviceWorkerUrl.toString()).toBe(
			'https://playground.test/playground-pr-preview-sw.js?playground-pr=123&playground-pr-sha=abcdef1'
		);
	});
});

describe('PR preview URL mapping', () => {
	const preview = {
		pr: '123',
		sha: 'abcdef1',
		basePath: '/pr-previews/123/abcdef1/',
	};

	it('maps static root URLs to the preview build path', () => {
		const mapped = mapToPlaygroundPrPreviewUrl(
			new URL('https://playground.test/assets/index.js?v=1'),
			preview
		);

		expect(mapped.toString()).toBe(
			'https://playground.test/pr-previews/123/abcdef1/assets/index.js?v=1'
		);
	});

	it('does not map dynamic or already-preview URLs', () => {
		expect(
			shouldMapToPlaygroundPrPreview(
				new URL('https://playground.test/plugin-proxy.php')
			)
		).toBe(false);
		expect(
			shouldMapToPlaygroundPrPreview(
				new URL('https://playground.test/client/index.js')
			)
		).toBe(false);
		expect(
			shouldBypassPlaygroundPrPreview(
				new URL('https://playground.test/pr-previews/123/current.json')
			)
		).toBe(true);
	});
});
