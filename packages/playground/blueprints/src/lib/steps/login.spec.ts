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
import { defineWpConfigConsts } from './define-wp-config-consts';

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

	it('should log the user in', async () => {
		await login(php, {});
		const loginResponse = await handler.request({
			url: '/wp-admin/',
		});
		expect(loginResponse.httpStatusCode).toBe(302);
		expect(loginResponse.headers['location']).toHaveLength(1);
		const initialRedirectUrl = new URL(
			loginResponse.headers['location'][0]
		);
		expect(initialRedirectUrl.pathname).toBe('/wp-admin/');

		const adminResponse = await handler.request({
			url: '/wp-admin/',
		});
		expect(adminResponse.httpStatusCode).toBe(200);
		expect(adminResponse.text).toContain('Dashboard');
	});

	it('should log the user in if the auto login parameter is set', async () => {
		await defineWpConfigConsts(php, {
			consts: {
				PLAYGROUND_FORCE_AUTO_LOGIN_ENABLED: true,
			},
		});
		const loginResponse = await handler.request({
			url: '/wp-admin/?playground_force_auto_login_as_user=admin',
		});
		expect(loginResponse.httpStatusCode).toBe(302);
		expect(loginResponse.headers['location']).toHaveLength(1);
		const initialRedirectUrl = new URL(
			loginResponse.headers['location'][0]
		);
		expect(initialRedirectUrl.pathname).toBe('/wp-admin/');

		const adminResponse = await handler.request({
			url: '/wp-admin/',
		});
		expect(adminResponse.httpStatusCode).toBe(200);
		expect(adminResponse.text).toContain('Dashboard');
	});
});
