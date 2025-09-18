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
import { CorePluginResource } from '../v1/resources';
import { resetData } from './reset-data';

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
				DOCROOT: handler.documentRoot,
			},
		});
	};

	let importerPlugin: ArrayBuffer | undefined = undefined;
	beforeAll(async () => {
		const pluginResource = new CorePluginResource({
			resource: 'wordpress.org/plugins',
			slug: 'wordpress-importer',
		});
		importerPlugin = await (await pluginResource.resolve()).arrayBuffer();
	});

	beforeEach(async () => {
		handler = await bootWordPress({
			createPhpRuntime: async () =>
				await loadNodeRuntime(RecommendedPHPVersion),
			// Simulate playground.wordpress.net URL scheme:
			siteUrl: 'http://playground-domain/scope:kind-quiet-lake/',

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
		await installPlugin(php, {
			pluginData: new File([importerPlugin!], 'wordpress-importer.zip'),
			options: {
				activate: true,
			},
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
				DOCROOT: handler.documentRoot,
			},
		});
		const json = result.json;

		expect(json.post_content).toEqual(expectedPostContent);
		expect(json.post_title).toEqual(`"Issue\\Issue"`);
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

	it('Should rewrite site URLs in the imported content', async () => {
		const fileData = await readFile(
			__dirname + '/fixtures/import-wxr-base-url-rewriting.xml'
		);
		const file = new File([fileData], 'import.wxr');

		await importWxr(php, { file });

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
				DOCROOT: handler.documentRoot,
			},
		});
		const json = result.json;

		const newSiteUrl = handler.absoluteUrl;
		const expectedPostContent = `<!-- wp:paragraph -->
<p>
    <!-- Rewrites URLs that match the base URL -->
    URLs to rewrite:

    ${newSiteUrl}
    ${newSiteUrl}
    ${newSiteUrl}
    ${newSiteUrl}/
    <a href="${newSiteUrl}/wp-content/image.png">Test</a>

    <!-- Correctly ignores URLs that are similar to the base URL but do not match it -->
    This isn't migrated: https://🚀-science.comcast/science <br>
    Or this: super-🚀-science.com/science
</p>
<!-- /wp:paragraph -->

<!-- wp:image {"src":"http:\\/\\/playground-domain\\/scope:kind-quiet-lake\\/wp-content\\/image.png"} -->
<img src="${newSiteUrl}/wp-content/image.png">
<!-- /wp:image -->
`;

		expect(json.post_content).toEqual(expectedPostContent);
	});

	it('Should rewrite site URLs in the imported content (tt5 playground content)', async () => {
		const fileData = await readFile(
			__dirname +
				'/fixtures/import-tt5-subset-of-demo-blueprint-playgroundcontent.xml'
		);
		const file = new File([fileData], 'import.wxr');

		await importWxr(php, { file });

		const result = await php.run({
			code: `<?php
			require getenv('DOCROOT') . '/wp-load.php';
			$post = get_post(63);
			echo json_encode([
				'post_content' => $post->post_content,
				'post_title' => $post->post_title,
			]);
			`,
			env: {
				DOCROOT: handler.documentRoot,
			},
		});
		const json = result.json;

		// const newSiteUrl = php.absoluteUrl;
		const expectedPostContent = `<!-- wp:paragraph -->
<p>Template are the blueprints for different layouts for your web pages. There following template are available in the theme:</p>
<!-- /wp:paragraph -->

<!-- wp:list -->
<ul class="wp-block-list"><!-- wp:list-item -->
<li>a <a href="/scope:kind-quiet-lake/templates/single-page-layout/" data-type="page" data-id="65">single page template</a>, showing the single page layout</li>
<!-- /wp:list-item -->

<!-- wp:list-item -->
<li>a <a href="/scope:kind-quiet-lake/page-no-title/" data-type="page" data-id="192">page  no title template</a> that allows for a Hero image or a Cover block directly on the top of the page. </li>
<!-- /wp:list-item -->

<!-- wp:list-item -->
<li><a href="/scope:kind-quiet-lake/notfound">404 page not found</a> template, the message that is displayed when vistors caught a bad link to your site. </li>
<!-- /wp:list-item --></ul>
<!-- /wp:list -->

<!-- wp:paragraph -->
<p></p>
<!-- /wp:paragraph -->`;

		expect(json.post_content).toEqual(expectedPostContent);
	});

	it('Should replace all post authors with admin user', async () => {
		const fileData = await readFile(
			__dirname + '/fixtures/import-wxr-comprehensive.xml'
		);
		const file = new File([fileData], 'import.wxr');

		await resetData(php, {});
		await importWxr(php, { file });

		const result = await php.run({
			code: `<?php
			require getenv('DOCROOT') . '/wp-load.php';
			
			// Get all imported posts
			$posts = get_posts([
				'post_type' => ['post', 'page'],
				'post_status' => 'any',
				'numberposts' => -1,
				'orderby' => 'ID',
				'order' => 'ASC'
			]);
			
			// Get admin user info
			$admin_user = get_user_by('login', 'admin');
			
			$post_authors = [];
			foreach ($posts as $post) {
				$author = get_user_by('ID', $post->post_author);
				$post_authors[] = [
					'post_id' => $post->ID,
					'post_title' => $post->post_title,
					'post_type' => $post->post_type,
					'author_id' => $post->post_author,
					'author_login' => $author ? $author->user_login : null,
					'author_display_name' => $author ? $author->display_name : null,
				];
			}
			
			echo json_encode([
				'admin_user_id' => $admin_user ? $admin_user->ID : null,
				'admin_user_login' => $admin_user ? $admin_user->user_login : null,
				'total_posts' => count($posts),
				'post_authors' => $post_authors,
			]);
			`,
			env: {
				DOCROOT: handler.documentRoot,
			},
		});
		const json = result.json;

		// Verify admin user exists
		expect(json.admin_user_id).toBeTruthy();
		expect(json.admin_user_login).toBe('admin');

		// Verify we imported the expected posts (1 post + 1 page from comprehensive fixture)
		expect(json.total_posts).toBe(2);

		// Verify all imported posts are authored by admin
		json.post_authors.forEach((postAuthor: any) => {
			expect(postAuthor.author_id).toBe(json.admin_user_id + '');
			expect(postAuthor.author_login).toBe('admin');
		});

		// Verify specific posts exist with correct titles
		const postTitles = json.post_authors.map((p: any) => p.post_title);
		expect(postTitles).toContain('Comprehensive Post');
		expect(postTitles).toContain('Comprehensive Page');
	});
});
