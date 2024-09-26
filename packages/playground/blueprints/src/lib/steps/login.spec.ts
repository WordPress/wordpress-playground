import { PHP } from '@php-wasm/universal';
import { RecommendedPHPVersion } from '@wp-playground/common';
import {
	getSqliteDatabaseModule,
	getWordPressModule,
} from '@wp-playground/wordpress-builds';
import { login } from './login';
import { PHPRequestHandler } from '@php-wasm/universal';
import { bootWordPress } from '@wp-playground/wordpress';
import { loadNodeRuntime } from '@php-wasm/node';

describe('Blueprint step login', () => {
	let php: PHP;
	let handler: PHPRequestHandler;
	beforeEach(async () => {
		handler = await bootWordPress({
			createPhpRuntime: async () =>
				await loadNodeRuntime(RecommendedPHPVersion),
			siteUrl: 'http://playground-domain/',

			wordPressZip: await getWordPressModule(),
			sqliteIntegrationPluginZip: await getSqliteDatabaseModule(),
		});
		php = await handler.getPrimaryPhp();
	});

	it('should redirect user to wp-login.php with correct redirect_to', async () => {
		await login(php, {});
		const response = await handler.request({
			url: '/wp-admin/',
		});
		expect(response.httpStatusCode).toBe(302);
		expect(response.headers['location']).toHaveLength(1);
		const initialRedirectUrl = new URL(response.headers['location'][0]);
		expect(initialRedirectUrl.pathname).toBe('/wp-login.php');
		expect(initialRedirectUrl.searchParams.get('redirect_to')).toBe(
			`${handler.absoluteUrl}/wp-admin/`
		);

		const loginResponse = await handler.request({
			url: initialRedirectUrl.toString(),
		});
		expect(loginResponse.httpStatusCode).toBe(302);
		expect(loginResponse.headers['location']).toHaveLength(1);
		const postLoginRedirectUrl = new URL(
			loginResponse.headers['location'][0]
		);
		expect(postLoginRedirectUrl.pathname).toBe(
			`${handler.absoluteUrl}/wp-admin/`
		);

		const wpAdminResponse = await handler.request({
			url: postLoginRedirectUrl.toString(),
		});
		expect(wpAdminResponse.text).toContain('Dashboard');
	});

	// TODO
	it('should serve a logged out response when login disabled');
});
