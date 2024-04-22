import { NodePHP, getPHPLoaderModule } from '@php-wasm/node';
import {
	RecommendedPHPVersion,
	getWordPressModule,
} from '@wp-playground/wordpress';
import { unzip } from './unzip';
import { enableMultisite } from './enable-multisite';
import {
	PHPProcessManager,
	PHPRequestHandler,
	loadPHPRuntime,
} from '@php-wasm/universal';

const DOCROOT = '/test-dir';
describe('Blueprint step enableMultisite', () => {
	async function bootWordPress(options: { absoluteUrl: string }) {
		const phpFactory = async () => {
			const phpLoaderModule = await getPHPLoaderModule(
				RecommendedPHPVersion
			);
			const runtimeId = await loadPHPRuntime(phpLoaderModule);
			return new NodePHP(runtimeId);
		};
		const php = await phpFactory();

		const processManager = new PHPProcessManager<NodePHP>();
		processManager.setPhpFactory(phpFactory);
		processManager.setPrimaryPhp(php);

		const requestHandler = new PHPRequestHandler({
			processManager,
			absoluteUrl: options.absoluteUrl,
			documentRoot: '/',
		}) as any;

		await unzip(php, {
			zipFile: await getWordPressModule(),
			extractToPath: DOCROOT,
		});
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
