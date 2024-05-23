import { PHP } from '@php-wasm/universal';
import { RecommendedPHPVersion } from '@wp-playground/common';
import { getWordPressModule } from '@wp-playground/wordpress-builds';
import { login } from './login';
import { unzip } from './unzip';
import { PHPRequestHandler } from '@php-wasm/universal';

describe('Blueprint step installPlugin', () => {
	let php: PHP;
	let requestHandler: PHPRequestHandler;
	beforeEach(async () => {
		requestHandler = new PHPRequestHandler({
			phpFactory: async () =>
				new PHP(await loadNodeRuntime(RecommendedPHPVersion)),
			documentRoot: '/wordpress',
		});
		php = await requestHandler.getPrimaryPhp();

		await unzip(php, {
			zipFile: await getWordPressModule(),
			extractToPath: '/wordpress',
		});
	});

	it('should log the user in', async () => {
		await login(php, {});
		const response = await requestHandler.request({
			url: '/wp-admin',
		});
		expect(response.text).toContain('Dashboard');
	});
});
