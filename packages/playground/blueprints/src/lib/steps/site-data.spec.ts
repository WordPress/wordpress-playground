import { PHP } from '@php-wasm/universal';
import { RecommendedPHPVersion } from '@wp-playground/common';
import {
	getSqliteDatabaseModule,
	getWordPressModule,
} from '@wp-playground/wordpress-builds';
import { setSiteOptions } from './site-data';
import { PHPRequestHandler } from '@php-wasm/universal';
import { bootWordPress } from '@wp-playground/wordpress';
import { loadNodeRuntime } from '@php-wasm/node';

describe('Blueprint step setSiteOptions()', () => {
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
});
