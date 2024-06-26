import { PHP } from '@php-wasm/universal';
import { RecommendedPHPVersion } from '@wp-playground/common';
import {
	getSqliteDatabaseModule,
	getWordPressModule,
} from '@wp-playground/wordpress-builds';
import { importThemeStarterContent } from './import-theme-starter-content';
import { PHPRequestHandler } from '@php-wasm/universal';
import { bootWordPress } from '@wp-playground/wordpress';
import { loadNodeRuntime } from '@php-wasm/node';

describe('Blueprint step importThemeStarterContent', () => {
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

	it('Should import theme starter content', async () => {
		const docroot = php.documentRoot;
		php.mkdir(`${docroot}/wp-content/themes/test-theme`);
		php.writeFile(
			`${docroot}/wp-content/themes/test-theme/style.css`,
			`/**
* Theme Name: Test Theme
* Theme URI: https://example.com/test-theme
* Author: Test Author
*/
			`
		);
		php.writeFile(
			`${docroot}/wp-content/themes/test-theme/functions.php`,
			`<?php
function testtheme_theme_support() {
	// Basic starter content to set up a static front page.
	add_theme_support( 'starter-content', [
		'posts' => [
			'front' => [
				'post_type'    => 'page',
				'post_title'   => 'Static front',
				'post_content' => 'Static front page content'
			],
			'blog',
		],
		// Default to a static front page and assign the front and posts pages.
		'options' => [
			'show_on_front'  => 'page',
			'page_on_front'  => '{{front}}',
			'page_for_posts' => '{{blog}}',
		],
	] );
}
add_action( 'after_setup_theme', 'testtheme_theme_support' );
			`
		);

		// Theme doesn't need to be active.
		await importThemeStarterContent(php, {
			themeSlug: 'test-theme',
		});

		const response = await php.run({
			code: `<?php
				require '/wordpress/wp-load.php';
				echo json_encode([
					'show_on_front' => get_option('show_on_front'),
					'front_page'    => get_post( get_option('page_on_front') ),
				]);
			`,
		});
		const json = response.json;

		expect(json.show_on_front).toEqual('page');
		expect(json.front_page.post_title).toEqual('Static front');
	});
});
