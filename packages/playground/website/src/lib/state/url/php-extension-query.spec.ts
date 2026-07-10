import { phpExtensionQueryArgsToExtensionsArray } from './php-extension-query';

describe('phpExtensionQueryArgsToExtensionsArray', () => {
	const baseUrl = 'https://playground.test/tools/?php=8.4';

	it('returns no extensions when the query does not request one', () => {
		expect(
			phpExtensionQueryArgsToExtensionsArray(undefined, baseUrl)
		).toEqual([]);
	});

	it('converts repeated php-extension values to manifest extension requests', () => {
		const manifestUrls = [
			'https://cdn.example.com/wp_mysql_parser/manifest.json',
			'/extensions/spx/manifest.json',
		];

		expect(
			phpExtensionQueryArgsToExtensionsArray(manifestUrls, baseUrl)
		).toEqual([
			{
				source: {
					format: 'manifest',
					manifestUrl:
						'https://cdn.example.com/wp_mysql_parser/manifest.json',
				},
			},
			{
				source: {
					format: 'manifest',
					manifestUrl:
						'https://playground.test/extensions/spx/manifest.json',
				},
			},
		]);
	});

	it('resolves relative manifest URLs and preserves encoded query strings', () => {
		expect(
			phpExtensionQueryArgsToExtensionsArray(
				'./build/manifest.json?artifact=spx%2Fphp-8.4&debug=yes',
				baseUrl
			)
		).toEqual([
			{
				source: {
					format: 'manifest',
					manifestUrl:
						'https://playground.test/tools/build/manifest.json' +
						'?artifact=spx%2Fphp-8.4&debug=yes',
				},
			},
		]);
	});

	it('rejects an empty php-extension value', () => {
		expect(() =>
			phpExtensionQueryArgsToExtensionsArray('', baseUrl)
		).toThrow(
			'Invalid php-extension query parameter: expected a manifest URL.'
		);
	});

	it('rejects unsupported URL schemes', () => {
		expect(() =>
			phpExtensionQueryArgsToExtensionsArray(
				'file:///tmp/wp_mysql_parser/manifest.json',
				baseUrl
			)
		).toThrow(/manifest URL must use http: or https:/);
	});
});
