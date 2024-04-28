import { NodePHP } from '@php-wasm/node';
import {
	RecommendedPHPVersion,
	getWordPressModule,
} from '@wp-playground/wordpress';
import { unzip } from './unzip';
import { enableMultisite } from './enable-multisite';

const DOCROOT = '/test-dir';
describe('Blueprint step enableMultisite', () => {
	async function bootWordPress(options: { absoluteUrl: string }) {
		const php = await NodePHP.load(RecommendedPHPVersion, {
			requestHandler: {
				documentRoot: DOCROOT,
				...options,
			},
		});
		await unzip(php, {
			zipFile: await getWordPressModule(),
			extractToPath: DOCROOT,
		});
		return php;
	}

	it('should enable a multisite on a scoped URL', async () => {
		const php = await bootWordPress({
			absoluteUrl: 'http://playground-domain/scope:987987/',
		});
		await enableMultisite(php, {});

		const response = await php.request({
			url: '/wp-admin/network/',
		});

		for (const fn of global.asyncifyFunctions) {
			console.log(`"${fn}",`);
		}
		expect(response.text).toContain('My Sites');
	}, 30_000);

	it('should enable a multisite on a scopeless URL', async () => {
		const php = await bootWordPress({
			absoluteUrl: 'http://playground-domain/',
		});
		await enableMultisite(php, {});

		const response = await php.request({
			url: '/wp-admin/network/',
		});
		expect(response.text).toContain('My Sites');
	}, 30_000);
});
