import { vi } from 'vitest';
import { logger } from '@php-wasm/logger';
import { loadNodeRuntime } from '@php-wasm/node';
import { RecommendedPHPVersion } from '@wp-playground/common';
import {
	getSqliteDriverModule,
	getWordPressModule,
} from '@wp-playground/wordpress-builds';
import { bootWordPress, bootWordPressAndRequestHandler } from '../boot';

// Contract: starter content is localized at creation, while existing content survives boot.
// The installer request and the existing-database detection can independently regress.
describe('localized WordPress installation', () => {
	afterEach(() => vi.restoreAllMocks());
	it('creates German starter content and preserves existing content on subsequent boots', async () => {
		await using handler = await bootWordPressAndRequestHandler({
			createPhpRuntime: () => loadNodeRuntime(RecommendedPHPVersion),
			siteUrl: 'http://playground-domain/',
			wordPressZip: await getWordPressModule('6.8'),
			sqliteIntegrationPluginZip: await getSqliteDriverModule(),
			installationLanguage: 'de_DE',
			skipWordPressBundleDatabase: true,
		});
		const php = await handler.getPrimaryPhp();
		const state = await php.run({
			code: `<?php
				require '/wordpress/wp-load.php';
				echo json_encode([
					'locale' => get_option('WPLANG'),
					'title' => get_option('blogname'),
					'post' => get_post(1)->post_title,
				]);
			`,
		});
		expect(state.errors).toBe('');
		expect(state.json).toEqual({
			locale: 'de_DE',
			title: 'Meine Website',
			post: 'Hallo Welt!',
		});

		await php.run({
			code: `<?php
				require '/wordpress/wp-load.php';
				update_option('blogname', 'Custom title');
				wp_update_post(['ID' => 1, 'post_title' => 'Custom post']);
			`,
		});
		// Overlay the same factory bundle on an existing site. Its database must survive.
		vi.spyOn(logger, 'warn').mockImplementation(() => {});
		await bootWordPress(handler, {
			siteUrl: 'http://playground-domain/',
			wordpressInstallMode: 'download-and-install',
			wordPressZip: await getWordPressModule('6.8'),
			skipWordPressBundleDatabase: true,
			installationLanguage: 'fr_FR',
		});
		const preserved = await php.run({
			code: `<?php
				require '/wordpress/wp-load.php';
				echo json_encode([get_option('blogname'), get_post(1)->post_title, get_option('WPLANG')]);
			`,
		});
		expect(preserved.json).toEqual([
			'Custom title',
			'Custom post',
			'de_DE',
		]);
	}, 60000);
});
