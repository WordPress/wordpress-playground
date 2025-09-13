import type { PHP } from '@php-wasm/universal';
import { RecommendedPHPVersion } from '@wp-playground/common';
import {
	getSqliteDriverModule,
	getWordPressModule,
} from '@wp-playground/wordpress-builds';
import { importWxr } from './import-wxr';
import { readFile } from 'fs/promises';
import { installPlugin } from './install-plugin';
import type { PHPRequestHandler } from '@php-wasm/universal';
import { bootWordPress } from '@wp-playground/wordpress';
import { loadNodeRuntime } from '@php-wasm/node';

describe('Blueprint step importWxr', () => {
	let php: PHP;
	let handler: PHPRequestHandler;

	const checkTemplateImportResults = async () => {
		return await php.run({
			code: `<?php
			require getenv('DOCROOT') . '/wp-load.php';

			// Get the imported template
			$templates = get_posts([
				'post_type' => 'wp_template',
				'post_status' => 'publish',
				'numberposts' => -1,
				'post_title' => 'Index'
			]);

			$template = $templates ? $templates[0] : null;
			$terms = $template ? wp_get_object_terms($template->ID, 'wp_theme') : [];
			$adonay_term = get_term_by('slug', 'adonay', 'wp_theme');

			echo json_encode([
				'template_found' => !empty($template),
				'template_title' => $template ? $template->post_title : null,
				'terms_associated_count' => count($terms),
				'adonay_term_exists' => !empty($adonay_term),
				'associated_term_slugs' => array_map(function($term) {
					return $term->slug;
				}, $terms)
			]);
			`,
			env: {
				DOCROOT: await php.documentRoot,
			},
		});
	};

	beforeEach(async () => {
		handler = await bootWordPress({
			createPhpRuntime: async () =>
				await loadNodeRuntime(RecommendedPHPVersion),
			siteUrl: 'http://playground-domain/',

			wordPressZip: await getWordPressModule(),
			sqliteIntegrationPluginZip: await getSqliteDriverModule(),
		});
		php = await handler.getPrimaryPhp();

		// Delete all posts
		await php.run({
			code: `<?php
			require '/wordpress/wp-load.php';
			$posts = get_posts();
			foreach ($posts as $post) {
				wp_delete_post($post->ID, true);
			}
			`,
		});

		// Install the WordPress importer plugin
		const pluginZipData = await readFile(
			__dirname + '/../../../../website/public/wordpress-importer.zip'
		);
		const pluginZipFile = new File([pluginZipData], 'plugin.zip');
		await installPlugin(php, {
			pluginData: pluginZipFile,
		});
	});

	it('Should import a WXR file with JSON-encoded UTF-8 characters', async () => {
		const fileData = await readFile(
			__dirname + '/fixtures/import-wxr-slash-issue.xml'
		);
		const file = new File([fileData], 'import.wxr');

		await importWxr(php, { file });

		const expectedPostContent = `<!-- wp:inseri-core/text-editor {"blockId":"DSrQIjN5UjosCHJQImF5z","blockName":"textEditor","height":60,"content":"\\u0022#test\\u0022","contentType":"application/json"} -->
<div class="wp-block-inseri-core-text-editor" data-attributes="{&quot;blockId&quot;:&quot;DSrQIjN5UjosCHJQImF5z&quot;,&quot;blockName&quot;:&quot;textEditor&quot;,&quot;content&quot;:&quot;\\&quot;#test\\&quot;&quot;,&quot;contentType&quot;:&quot;application/json&quot;,&quot;editable&quot;:false,&quot;height&quot;:60,&quot;isVisible&quot;:true,&quot;label&quot;:&quot;&quot;}">is loading ...</div>
<!-- /wp:inseri-core/text-editor -->`;

		const result = await php.run({
			code: `<?php
			require getenv('DOCROOT') . '/wp-load.php';
			$posts = get_posts();
			echo json_encode([
				'post_content' => $posts[0]->post_content,
				'post_title' => $posts[0]->post_title,
			]);
			`,
			env: {
				DOCROOT: await php.documentRoot,
			},
		});
		const json = result.json;

		expect(json.post_content).toEqual(expectedPostContent);
		expect(json.post_title).toEqual(`"Issue\\Issue"`);
	});

	it('Should fail to associate wp_theme taxonomy when fix is disabled', async () => {
		// Create mu-plugins directory and write a plugin that disables the fix during import_start
		await php.mkdir('/wordpress/wp-content/mu-plugins');
		await php.writeFile(
			'/wordpress/wp-content/mu-plugins/disable-wp-theme-fix.php',
			`<?php
add_action( 'import_start', function() {
	remove_filter( 'wp_import_post_terms', 'wp_playground_import_post_terms_handler', 10 );
} );
`
		);

		const fileData = await readFile(
			__dirname + '/fixtures/import-wxr-site-editor-template.xml'
		);
		const file = new File([fileData], 'import.wxr');

		await importWxr(php, { file });

		const result = await checkTemplateImportResults();
		const json = result.json;

		// Verify the template was imported but taxonomy association failed
		expect(json.template_found).toBe(true);
		expect(json.template_title).toEqual('Index');
		expect(json.terms_associated_count).toBe(0);
		expect(json.adonay_term_exists).toBe(false);
		expect(json.associated_term_slugs).toEqual([]);

		// Clean up the mu-plugin
		await php.unlink(
			'/wordpress/wp-content/mu-plugins/disable-wp-theme-fix.php'
		);
	});

	it('Should create and associate wp_theme taxonomy terms for Site Editor templates', async () => {
		const fileData = await readFile(
			__dirname + '/fixtures/import-wxr-site-editor-template.xml'
		);
		const file = new File([fileData], 'import.wxr');

		await importWxr(php, { file });

		const result = await checkTemplateImportResults();
		const json = result.json;

		// Verify the template was imported and taxonomy association worked
		expect(json.template_found).toBe(true);
		expect(json.template_title).toEqual('Index');
		expect(json.terms_associated_count).toBe(1);
		expect(json.adonay_term_exists).toBe(true);
		expect(json.associated_term_slugs).toEqual(['adonay']);
	});
});
