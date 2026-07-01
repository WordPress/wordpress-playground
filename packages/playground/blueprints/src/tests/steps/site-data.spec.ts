import type { PHP } from '@php-wasm/universal';
import { RecommendedPHPVersion } from '@wp-playground/common';
import {
	getSqliteDriverModule,
	getWordPressModule,
} from '@wp-playground/wordpress-builds';
import { setSiteOptions } from '../../lib/steps/site-data';
import type { PHPRequestHandler } from '@php-wasm/universal';
import { bootWordPressAndRequestHandler } from '@wp-playground/wordpress';
import { loadNodeRuntime } from '@php-wasm/node';

describe('Blueprint step setSiteOptions()', () => {
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

	it('should set the site option', async () => {
		await setSiteOptions(php, {
			options: {
				blogname: 'My test site!',
			},
		});
		const response = await php.run({
			code: `<?php
                require '/wordpress/wp-load.php';
                echo get_option('blogname');
			`,
		});
		expect(response.text).toBe('My test site!');
	});

	it('should flush rewrite rules when setting permalink_structure', async () => {
		await php.run({
			code: `<?php
	                require '/wordpress/wp-load.php';
	                delete_option('rewrite_rules');
			`,
		});
		const missingRules = await php.run({
			code: `<?php
                require '/wordpress/wp-load.php';
                echo json_encode(get_option('rewrite_rules'));
			`,
		});
		expect(missingRules.json).toBe(false);

		await setSiteOptions(php, {
			options: {
				permalink_structure: '/%postname%/',
			},
		});

		const response = await php.run({
			code: `<?php
                require '/wordpress/wp-load.php';
                $rewrite_rules = get_option('rewrite_rules');
                echo json_encode([
                    'permalink_structure' => get_option('permalink_structure'),
                    'has_rewrite_rules' => is_array($rewrite_rules) && count($rewrite_rules) > 0,
                ]);
			`,
		});
		expect(response.json).toEqual({
			permalink_structure: '/%postname%/',
			has_rewrite_rules: true,
		});
	});
});
