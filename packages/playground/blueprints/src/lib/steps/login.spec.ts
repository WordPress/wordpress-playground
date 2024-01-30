import { NodePHP } from '@php-wasm/node';
import {
	RecommendedPHPVersion,
	getWordPressModule,
} from '@wp-playground/wordpress';
import { login } from './login';
import { unzip } from './unzip';

describe('Blueprint step installPlugin', () => {
	let php: NodePHP;
	beforeEach(async () => {
		php = await NodePHP.load(RecommendedPHPVersion, {
			requestHandler: {
				documentRoot: '/wordpress',
			},
		});
		await unzip(php, {
			zipFile: await getWordPressModule(),
			extractToPath: '/wordpress',
		});
	});

	it('should log the user in', async () => {
		await login(php, {});
		const response = await php.request({
			url: '/wp-admin',
		});
		expect(response.text).toContain('Dashboard');
	});
});
