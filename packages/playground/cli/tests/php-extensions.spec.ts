import { cliExtensionArgsToExtensionsArray } from '../src/php-extensions';

describe('CLI PHP extensions', () => {
	test('converts built-in extension flags to runtime extension requests', () => {
		expect(
			cliExtensionArgsToExtensionsArray({
				intl: true,
				redis: true,
				memcached: true,
				xdebug: true,
			})
		).toEqual(['intl', 'redis', 'memcached', 'xdebug']);
	});

	test('converts --php-extension values to manifest extension requests', () => {
		expect(
			cliExtensionArgsToExtensionsArray({
				phpExtension: [
					'./dist/wp_mysql_parser/manifest.json',
					'https://example.com/spx/manifest.json',
				],
			})
		).toEqual([
			{
				source: {
					format: 'manifest',
					manifestUrl: './dist/wp_mysql_parser/manifest.json',
				},
			},
			{
				source: {
					format: 'manifest',
					manifestUrl: 'https://example.com/spx/manifest.json',
				},
			},
		]);
	});
});
