import type { PHP } from '@php-wasm/universal';
import { RecommendedPHPVersion } from '@wp-playground/common';
import {
	getSqliteDriverModule,
	getWordPressModule,
} from '@wp-playground/wordpress-builds';
import { importWxr } from '../../lib/steps/import-wxr';
import { readFile } from 'fs/promises';
import { installPlugin } from '../../lib/steps/install-plugin';
import type { PHPRequestHandler } from '@php-wasm/universal';
import { bootWordPressAndRequestHandler } from '@wp-playground/wordpress';
import { loadNodeRuntime } from '@php-wasm/node';
import { CorePluginResource } from '../../lib/v1/resources';
import { resetData } from '../../lib/steps/reset-data';

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
	}, 30_000);

	beforeEach(async () => {
		handler = await bootWordPressAndRequestHandler({
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
	}, 30_000);

	afterEach(async () => {
		php.exit();
		await handler[Symbol.asyncDispose]();
	});

	it(
		'Should import a WXR file with JSON-encoded UTF-8 characters',
		async () => {
			const fileData = await readFile(
				__dirname + '/../fixtures/import-wxr-slash-issue.xml'
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
		},
		{ timeout: 30_000 }
	);

	it(
		'Should create and associate wp_theme taxonomy terms for Site Editor templates',
		async () => {
			const fileData = await readFile(
				__dirname + '/../fixtures/import-wxr-site-editor-template.xml'
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
		},
		{ timeout: 30_000 }
	);

	it(
		'Should rewrite site URLs in the imported content',
		async () => {
			const fileData = await readFile(
				__dirname + '/../fixtures/import-wxr-base-url-rewriting.xml'
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
		},
		{ timeout: 30_000 }
	);

	it(
		'Should preserve site URLs in imported content when URL rewriting is disabled',
		async () => {
			const fileData = await readFile(
				__dirname + '/../fixtures/import-wxr-base-url-rewriting.xml'
			);
			const file = new File([fileData], 'import.wxr');

			await importWxr(php, {
				file,
				rewriteUrls: false,
			});

			const result = await php.run({
				code: `<?php
			require getenv('DOCROOT') . '/wp-load.php';
			$posts = get_posts();
			echo json_encode([
				'post_content' => $posts[0]->post_content,
			]);
			`,
				env: {
					DOCROOT: handler.documentRoot,
				},
			});

			expect(result.json.post_content).toContain(
				'https://🚀-science.com/science'
			);
			expect(result.json.post_content).not.toContain(handler.absoluteUrl);
		},
		{ timeout: 30_000 }
	);

	it(
		'Should pass the attachment fetching option to the importer',
		async () => {
			await php.run({
				code: `<?php
			$mu_plugins_dir = getenv('DOCROOT') . '/wp-content/mu-plugins';
			if (!is_dir($mu_plugins_dir)) {
				mkdir($mu_plugins_dir, 0777, true);
			}
			file_put_contents(
				$mu_plugins_dir . '/capture-wxr-fetch-attachments.php',
				<<<'PHP'
				<?php
				add_filter('pre_http_request', function($preempt, $parsed_args, $url) {
					update_option(
						'playground_wxr_attachment_request_count',
						(int) get_option('playground_wxr_attachment_request_count', 0) + 1
					);
					return new WP_Error('playground_blocked_attachment_fetch', 'Blocked test attachment fetch.');
				}, 10, 3);
				PHP
			);
			`,
				env: {
					DOCROOT: handler.documentRoot,
				},
			});

			const createAttachmentWxr = (
				postId: number
			) => `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0"
	xmlns:excerpt="http://wordpress.org/export/1.2/excerpt/"
	xmlns:content="http://purl.org/rss/1.0/modules/content/"
	xmlns:dc="http://purl.org/dc/elements/1.1/"
	xmlns:wp="http://wordpress.org/export/1.2/"
>
<channel>
	<title>Attachment import</title>
	<link>https://example.com</link>
	<wp:wxr_version>1.2</wp:wxr_version>
	<wp:base_site_url>https://example.com</wp:base_site_url>
	<wp:base_blog_url>https://example.com</wp:base_blog_url>
	<item>
		<title>Remote image</title>
		<link>https://example.com/wp-content/uploads/image.jpg</link>
		<pubDate>Wed, 01 Jan 2025 00:00:00 +0000</pubDate>
		<dc:creator><![CDATA[admin]]></dc:creator>
		<guid isPermaLink="false">https://example.com/wp-content/uploads/image.jpg</guid>
		<description></description>
		<content:encoded><![CDATA[]]></content:encoded>
		<excerpt:encoded><![CDATA[]]></excerpt:encoded>
		<wp:post_id>${postId}</wp:post_id>
		<wp:post_date><![CDATA[2025-01-01 00:00:00]]></wp:post_date>
		<wp:post_date_gmt><![CDATA[2025-01-01 00:00:00]]></wp:post_date_gmt>
		<wp:post_modified><![CDATA[2025-01-01 00:00:00]]></wp:post_modified>
		<wp:post_modified_gmt><![CDATA[2025-01-01 00:00:00]]></wp:post_modified_gmt>
		<wp:comment_status><![CDATA[closed]]></wp:comment_status>
		<wp:ping_status><![CDATA[closed]]></wp:ping_status>
		<wp:post_name><![CDATA[remote-image]]></wp:post_name>
		<wp:status><![CDATA[inherit]]></wp:status>
		<wp:post_parent>0</wp:post_parent>
		<wp:menu_order>0</wp:menu_order>
		<wp:post_type><![CDATA[attachment]]></wp:post_type>
		<wp:post_password><![CDATA[]]></wp:post_password>
		<wp:is_sticky>0</wp:is_sticky>
		<wp:attachment_url><![CDATA[https://example.com/wp-content/uploads/image.jpg]]></wp:attachment_url>
	</item>
</channel>
</rss>`;

			await importWxr(php, {
				file: new File([createAttachmentWxr(9001)], 'import.wxr'),
			});

			const defaultResult = await php.run({
				code: `<?php
			require getenv('DOCROOT') . '/wp-load.php';
			echo json_encode((int) get_option('playground_wxr_attachment_request_count', 0));
			`,
				env: {
					DOCROOT: handler.documentRoot,
				},
			});

			expect(defaultResult.json).toBeGreaterThan(0);

			await php.run({
				code: `<?php
			require getenv('DOCROOT') . '/wp-load.php';
			update_option('playground_wxr_attachment_request_count', 0);
			`,
				env: {
					DOCROOT: handler.documentRoot,
				},
			});

			await importWxr(php, {
				file: new File([createAttachmentWxr(9002)], 'import.wxr'),
				fetchAttachments: false,
			});

			const result = await php.run({
				code: `<?php
			require getenv('DOCROOT') . '/wp-load.php';
			echo json_encode((int) get_option('playground_wxr_attachment_request_count', 0));
			`,
				env: {
					DOCROOT: handler.documentRoot,
				},
			});

			expect(result.json).toBe(0);
		},
		{ timeout: 30_000 }
	);

	it(
		'Should rewrite site URLs in the imported content (tt5 playground content)',
		async () => {
			const fileData = await readFile(
				__dirname +
					'/../fixtures/import-tt5-subset-of-demo-blueprint-playgroundcontent.xml'
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
		},
		{ timeout: 30_000 }
	);

	it(
		'Should replace all post authors with admin user',
		async () => {
			const fileData = await readFile(
				__dirname + '/../fixtures/import-wxr-comprehensive.xml'
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
		},
		{ timeout: 30_000 }
	);
});
