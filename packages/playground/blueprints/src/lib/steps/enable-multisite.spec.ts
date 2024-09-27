import { RecommendedPHPVersion } from '@wp-playground/common';
import {
	getSqliteDatabaseModule,
	getWordPressModule,
} from '@wp-playground/wordpress-builds';
import { enableMultisite } from './enable-multisite';
import { bootWordPress } from '@wp-playground/wordpress';
import { loadNodeRuntime } from '@php-wasm/node';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('Blueprint step enableMultisite', () => {
	async function doBootWordPress(options: { absoluteUrl: string }) {
		const requestHandler = await bootWordPress({
			createPhpRuntime: async () =>
				await loadNodeRuntime(RecommendedPHPVersion),
			siteUrl: options.absoluteUrl,
			sapiName: 'cli',

			wordPressZip: await getWordPressModule(),
			sqliteIntegrationPluginZip: await getSqliteDatabaseModule(),
			createFiles: {
				'/tmp/wp-cli.phar': readFileSync(
					join(__dirname, '../../test/wp-cli.phar')
				),
			},
		});
		const php = await requestHandler.getPrimaryPhp();

		return { php, requestHandler };
	}

	it('should enable a multisite on a scoped URL', async () => {
		const { php } = await doBootWordPress({
			absoluteUrl: 'http://playground-domain/scope:987987/',
		});
		await enableMultisite(php, {});

		/**
		 * Relying on HTTP requests for unit tests won't work because of the wp-login redirects.
		 * Checking for constants will confirm if multisite is enabled.
		 */
		const result = await php.run({
			code: `
				<?php
				echo json_encode([
					'WP_ALLOW_MULTISITE' => defined('WP_ALLOW_MULTISITE'),
					'SUBDOMAIN_INSTALL' => defined('SUBDOMAIN_INSTALL'),
				]);
			`,
		});
		expect(result.json['WP_ALLOW_MULTISITE']).toEqual(true);
		expect(result.json['SUBDOMAIN_INSTALL']).toEqual(false);
	});

	it('should enable a multisite on a scopeless URL', async () => {
		const { php } = await doBootWordPress({
			absoluteUrl: 'http://playground-domain/',
		});
		await enableMultisite(php, {});

		const result = await php.run({
			code: `
				<?php
				echo json_encode([
					'WP_ALLOW_MULTISITE' => defined('WP_ALLOW_MULTISITE'),
					'SUBDOMAIN_INSTALL' => defined('SUBDOMAIN_INSTALL'),
				]);
			`,
		});
		expect(result.json['WP_ALLOW_MULTISITE']).toEqual(true);
		expect(result.json['SUBDOMAIN_INSTALL']).toEqual(false);
	});
});
