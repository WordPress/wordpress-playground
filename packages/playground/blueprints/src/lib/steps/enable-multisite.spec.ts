import { PHP } from '@php-wasm/universal';
import { RecommendedPHPVersion } from '@wp-playground/common';
import { getWordPressModule } from '@wp-playground/wordpress-builds';
import { unzip } from './unzip';
import { enableMultisite } from './enable-multisite';
import { PHPRequestHandler } from '@php-wasm/universal';
import {
	enablePlatformMuPlugins,
	preloadRequiredMuPlugin,
} from '@wp-playground/wordpress';
import { loadNodeRuntime } from '@php-wasm/node';

const DOCROOT = '/test-dir';
describe('Blueprint step enableMultisite', () => {
	async function bootWordPress(options: { absoluteUrl: string }) {
		const requestHandler = new PHPRequestHandler({
			phpFactory: async () =>
				new PHP(await loadNodeRuntime(RecommendedPHPVersion)),
			absoluteUrl: options.absoluteUrl,
			documentRoot: DOCROOT,
		});
		const php = await requestHandler.getPrimaryPhp();
		await unzip(php, {
			zipFile: await getWordPressModule(),
			extractToPath: DOCROOT,
		});
		// Ensure we're preloading platform-level mu-plugins
		await enablePlatformMuPlugins(php);
		await preloadRequiredMuPlugin(php);
		return { php, requestHandler };
	}

	it('should enable a multisite on a scoped URL', async () => {
		const { php, requestHandler } = await bootWordPress({
			absoluteUrl: 'http://playground-domain/scope:987987/',
		});
		await enableMultisite(php, {});

		const response = await requestHandler.request({
			url: '/wp-admin/network/',
		});
		expect(response.text).toContain('My Sites');
	}, 30_000);

	it('should enable a multisite on a scopeless URL', async () => {
		const { php, requestHandler } = await bootWordPress({
			absoluteUrl: 'http://playground-domain/',
		});
		await enableMultisite(php, {});

		const response = await requestHandler.request({
			url: '/wp-admin/network/',
		});
		expect(response.text).toContain('My Sites');
	}, 30_000);
});
