import { loadNodeRuntime } from '@php-wasm/node';
import { RecommendedPHPVersion } from '@wp-playground/common';
import { getWordPressModule } from '@wp-playground/wordpress-builds';
import { bootWordPress, isWordPressInstalled } from '../boot';

describe('Test database', () => {
	it(`should not start WordPress without a working driver module`, async () => {
		await expect(async () => {
			await bootWordPress({
				createPhpRuntime: async () =>
					await loadNodeRuntime(RecommendedPHPVersion),
				siteUrl: 'http://playground-domain/',
				wordPressZip: await getWordPressModule(),
				sqliteIntegrationPluginZip: undefined,
			});
		}).rejects.toThrow();
	});

	it(`should not install WordPress with data but without a working driver module`, async () => {
		const handler = await bootWordPress({
			createPhpRuntime: async () =>
				await loadNodeRuntime(RecommendedPHPVersion),
			siteUrl: 'http://playground-domain/',
			wordPressZip: await getWordPressModule(),
			sqliteIntegrationPluginZip: undefined,
			dataSqlPath: '/wordpress/wp-content/database/.ht.sqlite',
		});

		const php = await handler.getPrimaryPhp();
		const isInstalled = await isWordPressInstalled(php);

		expect(isInstalled).toBe(false);
	});
});
