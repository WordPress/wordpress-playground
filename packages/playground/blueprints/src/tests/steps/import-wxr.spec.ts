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

	const createWxr = ({
		siteTitle,
		authorLogin,
		authorEmail,
		postTitle,
		postSlug,
		postId,
	}: {
		siteTitle: string;
		authorLogin: string;
		authorEmail: string;
		postTitle: string;
		postSlug: string;
		postId: number;
	}) => `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0"
	xmlns:excerpt="http://wordpress.org/export/1.2/excerpt/"
	xmlns:content="http://purl.org/rss/1.0/modules/content/"
	xmlns:dc="http://purl.org/dc/elements/1.1/"
	xmlns:wp="http://wordpress.org/export/1.2/"
>
<channel>
	<title>${siteTitle}</title>
	<link>https://old.example</link>
	<description>WXR option coverage</description>
	<wp:wxr_version>1.2</wp:wxr_version>
	<wp:base_site_url>https://old.example</wp:base_site_url>
	<wp:base_blog_url>https://old.example</wp:base_blog_url>
	<wp:author>
		<wp:author_id>${postId}</wp:author_id>
		<wp:author_login><![CDATA[${authorLogin}]]></wp:author_login>
		<wp:author_email><![CDATA[${authorEmail}]]></wp:author_email>
		<wp:author_display_name><![CDATA[${authorLogin} Display]]></wp:author_display_name>
		<wp:author_first_name><![CDATA[Remote]]></wp:author_first_name>
		<wp:author_last_name><![CDATA[Author]]></wp:author_last_name>
	</wp:author>
	<item>
		<title>${postTitle}</title>
		<link>https://old.example/${postSlug}/</link>
		<pubDate>Wed, 01 Jan 2025 00:00:00 +0000</pubDate>
		<dc:creator><![CDATA[${authorLogin}]]></dc:creator>
		<guid isPermaLink="false">https://old.example/?p=${postId}</guid>
		<description></description>
		<content:encoded><![CDATA[<p>Visit https://old.example/page</p>]]></content:encoded>
		<excerpt:encoded><![CDATA[]]></excerpt:encoded>
		<wp:post_id>${postId}</wp:post_id>
		<wp:post_date><![CDATA[2025-01-01 00:00:00]]></wp:post_date>
		<wp:post_date_gmt><![CDATA[2025-01-01 00:00:00]]></wp:post_date_gmt>
		<wp:post_modified><![CDATA[2025-01-01 00:00:00]]></wp:post_modified>
		<wp:post_modified_gmt><![CDATA[2025-01-01 00:00:00]]></wp:post_modified_gmt>
		<wp:comment_status><![CDATA[open]]></wp:comment_status>
		<wp:ping_status><![CDATA[closed]]></wp:ping_status>
		<wp:post_name><![CDATA[${postSlug}]]></wp:post_name>
		<wp:status><![CDATA[publish]]></wp:status>
		<wp:post_parent>0</wp:post_parent>
		<wp:menu_order>0</wp:menu_order>
		<wp:post_type><![CDATA[post]]></wp:post_type>
		<wp:post_password><![CDATA[]]></wp:post_password>
		<wp:is_sticky>0</wp:is_sticky>
		<wp:postmeta>
			<wp:meta_key><![CDATA[source_url]]></wp:meta_key>
			<wp:meta_value><![CDATA[https://old.example/meta]]></wp:meta_value>
		</wp:postmeta>
		<wp:comment>
			<wp:comment_id>${postId}</wp:comment_id>
			<wp:comment_author><![CDATA[Commenter]]></wp:comment_author>
			<wp:comment_author_email><![CDATA[commenter@example.com]]></wp:comment_author_email>
			<wp:comment_author_url><![CDATA[https://old.example/commenter]]></wp:comment_author_url>
			<wp:comment_author_IP><![CDATA[]]></wp:comment_author_IP>
			<wp:comment_date><![CDATA[2025-01-01 00:00:00]]></wp:comment_date>
			<wp:comment_date_gmt><![CDATA[2025-01-01 00:00:00]]></wp:comment_date_gmt>
			<wp:comment_content><![CDATA[Comment https://old.example/comment]]></wp:comment_content>
			<wp:comment_approved><![CDATA[1]]></wp:comment_approved>
			<wp:comment_type><![CDATA[]]></wp:comment_type>
			<wp:comment_parent>0</wp:comment_parent>
			<wp:comment_user_id>0</wp:comment_user_id>
		</wp:comment>
	</item>
</channel>
</rss>`;

	const inspectImportedPost = async (postSlug: string) => {
		const result = await php.run({
			code: `<?php
			require getenv('DOCROOT') . '/wp-load.php';

			$posts = get_posts([
				'name' => getenv('POST_SLUG'),
				'post_type' => 'post',
				'post_status' => 'any',
				'numberposts' => 1,
			]);
			$post = $posts ? $posts[0] : null;
			$author = $post ? get_user_by('ID', $post->post_author) : null;
			$comments = $post ? get_comments(['post_id' => $post->ID]) : [];
			$comment = $comments ? $comments[0] : null;

			echo json_encode([
				'post_found' => !empty($post),
				'post_content' => $post ? $post->post_content : null,
				'author_login' => $author ? $author->user_login : null,
				'source_url' => $post ? get_post_meta($post->ID, 'source_url', true) : null,
				'comment_count' => count($comments),
				'comment_author_url' => $comment ? $comment->comment_author_url : null,
				'comment_content' => $comment ? $comment->comment_content : null,
				'blogname' => get_option('blogname'),
			]);
			`,
			env: {
				DOCROOT: handler.documentRoot,
				POST_SLUG: postSlug,
			},
		});
		return result.json;
	};

	const inspectWxrCleanupState = async () => {
		const result = await php.run({
			code: `<?php
			require getenv('DOCROOT') . '/wp-load.php';
			echo json_encode([
				'data_filter' => has_filter('wp_import_post_data_processed', 'blueprint_wxr_rewrite_post_data'),
				'meta_filter' => has_filter('wp_import_post_meta', 'blueprint_wxr_rewrite_post_meta'),
				'comments_filter' => has_filter('wp_import_post_comments', 'blueprint_wxr_filter_post_comments'),
				'url_map_global' => array_key_exists('blueprint_wxr_url_map', $GLOBALS),
				'comments_global' => array_key_exists('blueprint_wxr_import_comments', $GLOBALS),
				'authors_global' => array_key_exists('blueprint_wxr_imported_author_ids', $GLOBALS),
				'current_file_global' => array_key_exists('wpcli_import_current_file', $GLOBALS),
			]);
			`,
			env: {
				DOCROOT: handler.documentRoot,
			},
		});
		return result.json;
	};

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
		'Should honor WXR URL, author map, user, comment, and site option controls',
		async () => {
			await php.run({
				code: `<?php
			require getenv('DOCROOT') . '/wp-load.php';
			wp_create_user('mapped_user', 'password', 'mapped@example.com');
			`,
				env: {
					DOCROOT: handler.documentRoot,
				},
			});

			const file = new File(
				[
					createWxr({
						siteTitle: 'Mapped Import Site',
						authorLogin: 'remote_mapped_author',
						authorEmail: 'remote-mapped@example.com',
						postTitle: 'Mapped Import Post',
						postSlug: 'mapped-import-post',
						postId: 501,
					}),
				],
				'import.wxr'
			);

			await importWxr(php, {
				file,
				urlMap: {
					'https://old.example': 'https://new.example',
				},
				authorsMode: 'map',
				authorsMap: {
					remote_mapped_author: 'mapped_user',
				},
				importComments: true,
				importUsers: false,
				importSiteOptions: true,
			});

			const imported = await inspectImportedPost('mapped-import-post');
			const remoteUserExists = await php.run({
				code: `<?php
				require getenv('DOCROOT') . '/wp-load.php';
				echo json_encode((bool) username_exists('remote_mapped_author'));
			`,
				env: {
					DOCROOT: handler.documentRoot,
				},
			});
			const cleanupState = await inspectWxrCleanupState();

			expect(imported.post_found).toBe(true);
			expect(imported.author_login).toBe('mapped_user');
			expect(remoteUserExists.json).toBe(false);
			expect(cleanupState).toEqual({
				data_filter: false,
				meta_filter: false,
				comments_filter: false,
				url_map_global: false,
				comments_global: false,
				authors_global: false,
				current_file_global: false,
			});
			expect(imported.blogname).toBe('Mapped Import Site');
			expect(imported.post_content).toContain('https://new.example/page');
			expect(imported.source_url).toBe('https://new.example/meta');
			expect(imported.comment_count).toBe(1);
			expect(imported.comment_author_url).toBe(
				'https://new.example/commenter'
			);
			expect(imported.comment_content).toContain(
				'https://new.example/comment'
			);
		},
		{ timeout: 30_000 }
	);

	it(
		'Should skip WXR comments, users, and site options when disabled',
		async () => {
			await php.run({
				code: `<?php
			require getenv('DOCROOT') . '/wp-load.php';
			update_option('blogname', 'Original Site Name');
			`,
				env: {
					DOCROOT: handler.documentRoot,
				},
			});

			const file = new File(
				[
					createWxr({
						siteTitle: 'Skipped Import Site',
						authorLogin: 'remote_skipped_author',
						authorEmail: 'remote-skipped@example.com',
						postTitle: 'Skipped Import Post',
						postSlug: 'skipped-import-post',
						postId: 601,
					}),
				],
				'import.wxr'
			);

			await importWxr(php, {
				file,
				authorsMode: 'default-author',
				importComments: false,
				importUsers: false,
				importSiteOptions: false,
			});

			const imported = await inspectImportedPost('skipped-import-post');
			const remoteUserExists = await php.run({
				code: `<?php
			require getenv('DOCROOT') . '/wp-load.php';
			echo json_encode((bool) username_exists('remote_skipped_author'));
			`,
				env: {
					DOCROOT: handler.documentRoot,
				},
			});

			expect(imported.post_found).toBe(true);
			expect(imported.author_login).toBe('admin');
			expect(remoteUserExists.json).toBe(false);
			expect(imported.blogname).toBe('Original Site Name');
			expect(imported.comment_count).toBe(0);
		},
		{ timeout: 30_000 }
	);

	it(
		'Should create and assign WXR authors in create mode when user import is disabled',
		async () => {
			const file = new File(
				[
					createWxr({
						siteTitle: 'Imported User Site',
						authorLogin: 'remote_imported_author',
						authorEmail: 'remote-imported@example.com',
						postTitle: 'Imported User Post',
						postSlug: 'imported-user-post',
						postId: 701,
					}),
				],
				'import.wxr'
			);

			await importWxr(php, {
				file,
				authorsMode: 'create',
				importComments: false,
				importUsers: false,
				importSiteOptions: false,
			});

			const imported = await inspectImportedPost('imported-user-post');
			const remoteUserExists = await php.run({
				code: `<?php
			require getenv('DOCROOT') . '/wp-load.php';
			echo json_encode((bool) username_exists('remote_imported_author'));
			`,
				env: {
					DOCROOT: handler.documentRoot,
				},
			});

			expect(imported.post_found).toBe(true);
			expect(imported.author_login).toBe('remote_imported_author');
			expect(remoteUserExists.json).toBe(true);
			expect(imported.comment_count).toBe(0);
		},
		{ timeout: 30_000 }
	);

	it(
		'Should import multiple WXR files in one site without helper redeclaration failures',
		async () => {
			const firstFile = new File(
				[
					createWxr({
						siteTitle: 'First Import Site',
						authorLogin: 'remote_repeat_one',
						authorEmail: 'remote-repeat-one@example.com',
						postTitle: 'First Repeated Import Post',
						postSlug: 'first-repeated-import-post',
						postId: 801,
					}),
				],
				'first.wxr'
			);
			const secondFile = new File(
				[
					createWxr({
						siteTitle: 'Second Import Site',
						authorLogin: 'remote_repeat_two',
						authorEmail: 'remote-repeat-two@example.com',
						postTitle: 'Second Repeated Import Post',
						postSlug: 'second-repeated-import-post',
						postId: 802,
					}),
				],
				'second.wxr'
			);

			await importWxr(php, {
				file: firstFile,
				authorsMode: 'default-author',
				importComments: false,
				importUsers: false,
				importSiteOptions: false,
			});
			await importWxr(php, {
				file: secondFile,
				authorsMode: 'default-author',
				importComments: false,
				importUsers: false,
				importSiteOptions: false,
			});

			const firstImported = await inspectImportedPost(
				'first-repeated-import-post'
			);
			const secondImported = await inspectImportedPost(
				'second-repeated-import-post'
			);

			expect(firstImported.post_found).toBe(true);
			expect(secondImported.post_found).toBe(true);
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

	it(
		'Should clean WXR filters and globals when the importer fails',
		async () => {
			const file = new File(
				[
					createWxr({
						siteTitle: 'Failed Import Site',
						authorLogin: 'remote_failed_author',
						authorEmail: 'remote-failed@example.com',
						postTitle: 'Failed Import Post',
						postSlug: 'failed-import-post',
						postId: 777,
					}),
				],
				'import.wxr'
			);

			await expect(
				importWxr(php, {
					file,
					authorsMode: 'invalid-mode' as any,
				})
			).rejects.toThrow('Invalid WXR authors mode');

			expect(await inspectWxrCleanupState()).toEqual({
				data_filter: false,
				meta_filter: false,
				comments_filter: false,
				url_map_global: false,
				comments_global: false,
				authors_global: false,
				current_file_global: false,
			});
		},
		{ timeout: 30_000 }
	);
});
