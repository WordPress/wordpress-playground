import { PHP } from '@php-wasm/universal';
import { loadNodeRuntime } from '@php-wasm/node';
import { setSiteLanguage } from './set-site-language';
import { RecommendedPHPVersion } from '@wp-playground/common';
import { bootWordPress } from '@wp-playground/wordpress';
import {
	getSqliteDatabaseModule,
	getWordPressModule,
} from '@wp-playground/wordpress-builds';

const docroot = '/wordpress';
describe('Blueprint step setSiteLanguage', () => {
	let php: PHP;
	beforeEach(async () => {
		const handler = await bootWordPress({
			createPhpRuntime: async () =>
				await loadNodeRuntime(RecommendedPHPVersion),
			siteUrl: 'http://playground-domain/',
			documentRoot: docroot,

			wordPressZip: await getWordPressModule(),
			sqliteIntegrationPluginZip: await getSqliteDatabaseModule(),
		});
		php = await handler.getPrimaryPhp();
	});

	it('should set the site language', async () => {
		setSiteLanguage(php, {
			language: 'hr',
		});
		const response = await php.run({
			code: `<?php
				require '${docroot}/wp-load.php';
				echo get_locale();
			`,
		});
		expect(response.text).toBe('hr');
	});
});
