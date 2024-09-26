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

	it('should log the user in', async () => {
		await login(php, {
			username: 'admin',
		});
		const result = await php.run({
			code: `
				<?php
				echo PLAYGROUND_AUTO_LOGIN;
			`,
		});
		expect(result.text).toContain('admin');
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
	});
});
