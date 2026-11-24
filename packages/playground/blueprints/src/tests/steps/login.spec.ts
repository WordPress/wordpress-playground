import { PHP } from '@php-wasm/universal';
import type { PHPRequest } from '@php-wasm/universal';
import { vi } from 'vitest';
import { RecommendedPHPVersion } from '@wp-playground/common';
import {
	getSqliteDriverModule,
	getWordPressModule,
} from '@wp-playground/wordpress-builds';
import { login } from '../../lib/steps/login';
import type { PHPRequestHandler } from '@php-wasm/universal';
import { bootWordPressAndRequestHandler } from '@wp-playground/wordpress';
import { loadNodeRuntime } from '@php-wasm/node';
import { defineWpConfigConsts } from '../../lib/steps/define-wp-config-consts';
import { joinPaths, phpVar } from '@php-wasm/util';

describe('Blueprint step login', () => {
	let php: PHP;
	let handler: PHPRequestHandler;
	beforeEach(async () => {
		handler = await bootWordPressAndRequestHandler({
			createPhpRuntime: async () =>
				await loadNodeRuntime(RecommendedPHPVersion),
			siteUrl: 'http://playground-domain/',

			wordPressZip: await getWordPressModule(),
			sqliteIntegrationPluginZip: await getSqliteDriverModule(),
		});
		php = await handler.getPrimaryPhp();
	});

	afterEach(async () => {
		php.exit();
		await handler[Symbol.asyncDispose]();
	});

	const requestFollowRedirects = async (request: PHPRequest) => {
		let response = await handler.request(request);
		while (response.httpStatusCode === 302) {
			response = await handler.request({
				url: response.headers['location'][0],
			});
		}
		return response;
	};

	it('should log the user in', async () => {
		await login(php, {});
		const response = await requestFollowRedirects({
			url: '/',
		});
		expect(response.httpStatusCode).toBe(200);
		expect(response.text).toContain('Edit Site');
	}, 10000);

	it('should log the user into wp-admin', async () => {
		await login(php, {});
		const response = await requestFollowRedirects({
			url: '/wp-admin/',
		});
		expect(response.httpStatusCode).toBe(200);
		expect(response.text).toContain('Dashboard');
	}, 10000);

	it('should log the user in if the playground_force_auto_login_as_user query parameter is set', async () => {
		await defineWpConfigConsts(php, {
			consts: {
				PLAYGROUND_FORCE_AUTO_LOGIN_ENABLED: true,
			},
		});
		const response = await requestFollowRedirects({
			url: '/?playground_force_auto_login_as_user=admin',
		});
		expect(response.httpStatusCode).toBe(200);
		expect(response.text).toContain('Dashboard');
	});

	it('should set WordPress login cookie after login', async () => {
		await login(php, {});
		await php.writeFile(
			'/wordpress/nonce-test.php',
			`<?php
				require_once ${phpVar(joinPaths(handler.documentRoot, 'wp-load.php'))};
				if (!empty($_COOKIE) && array_filter(array_keys($_COOKIE), function($key) {
						return strpos($key, 'wordpress_logged_in_') === 0;
					})
				) {
					echo '1';
				}
			`
		);
		const response = await requestFollowRedirects({
			url: '/nonce-test.php',
		});
		expect(response.text).toBe('1');
	});
});

describe('Blueprint step login ordering', () => {
	let php: PHP;
	beforeEach(async () => {
		php = new PHP(await loadNodeRuntime(RecommendedPHPVersion));
	});

	afterEach(() => {
		php.exit();
		vi.restoreAllMocks();
	});

	it('should not resolve before defineConstant has finished', async () => {
		let finishDefineConstant: () => void = () => {};
		const defineConstant = vi.spyOn(php, 'defineConstant');
		defineConstant.mockImplementation(
			() =>
				new Promise<void>((resolve) => {
					finishDefineConstant = resolve;
				})
		);

		let loginSettled = false;
		const loginPromise = login(php, { username: 'editor' }).then(() => {
			loginSettled = true;
		});

		// Let any promise continuations run.
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(defineConstant).toHaveBeenCalledWith(
			'PLAYGROUND_AUTO_LOGIN_AS_USER',
			'editor'
		);
		expect(loginSettled).toBe(false);

		finishDefineConstant();
		await loginPromise;
		expect(loginSettled).toBe(true);
	});
});
