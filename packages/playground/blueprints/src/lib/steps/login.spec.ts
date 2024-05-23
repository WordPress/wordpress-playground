import { NodePHP } from '@php-wasm/node';
import { RecommendedPHPVersion } from '@wp-playground/common';
import {
	getSqliteDatabaseModule,
	getWordPressModule,
} from '@wp-playground/wordpress-builds';
import { login } from './login';
import { PHPRequestHandler } from '@php-wasm/universal';
import { bootWordPress } from '@wp-playground/wordpress';

describe('Blueprint step installPlugin', () => {
	let php: NodePHP;
	let handler: PHPRequestHandler<NodePHP>;
	beforeEach(async () => {
		handler = await bootWordPress({
			createPhpInstance: () => new NodePHP(),
			createPhpRuntime: () => NodePHP.loadRuntime(RecommendedPHPVersion),
			siteUrl: 'http://playground-domain/',

			wordPressZip: await getWordPressModule(),
			sqliteIntegrationPluginZip: await getSqliteDatabaseModule(),
		});
		php = await handler.getPrimaryPhp();
	});

	it('should log the user in', async () => {
		await login(php, {});
		const response = await handler.request({
			url: '/wp-admin',
		});
		expect(response.text).toContain('Dashboard');
	});
});
