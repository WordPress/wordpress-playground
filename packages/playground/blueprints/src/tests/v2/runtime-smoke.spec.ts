import type { PHP, PHPRequestHandler } from '@php-wasm/universal';
import { bootWordPressAndRequestHandler } from '@wp-playground/wordpress';
import { loadNodeRuntime } from '@php-wasm/node';
import { RecommendedPHPVersion } from '@wp-playground/common';
import {
	getSqliteDriverModule,
	getWordPressModule,
} from '@wp-playground/wordpress-builds';
import { InMemoryFilesystem } from '@wp-playground/storage';
import { readFile } from 'fs/promises';
import { describe, beforeAll, beforeEach, afterEach, expect, it } from 'vitest';
import { compileBlueprintForExecution } from '../../lib/compile';
import type { BlueprintV2Declaration } from '../../lib/v2/blueprint-v2-declaration';

describe('Blueprint v2 runtime smoke tests', () => {
	let php: PHP;
	let handler: PHPRequestHandler;
	let wordPressZip: Awaited<ReturnType<typeof getWordPressModule>>;
	let sqliteIntegrationPluginZip: Awaited<
		ReturnType<typeof getSqliteDriverModule>
	>;

	beforeAll(async () => {
		[wordPressZip, sqliteIntegrationPluginZip] = await Promise.all([
			getWordPressModule(),
			getSqliteDriverModule(),
		]);
	});

	beforeEach(async () => {
		handler = await bootWordPressAndRequestHandler({
			createPhpRuntime: () => loadNodeRuntime(RecommendedPHPVersion),
			siteUrl: 'http://playground-domain/',
			wordPressZip,
			sqliteIntegrationPluginZip,
		});
		php = await handler.getPrimaryPhp();
	});

	afterEach(async () => {
		php.exit();
		await handler[Symbol.asyncDispose]();
	});

	it('creates roles and users', async () => {
		await applyBlueprint({
			version: 2,
			roles: [
				{
					name: 'v2_runtime_editor',
					capabilities: {
						read: 'true',
						edit_posts: 'true',
					},
				},
			],
			users: [
				{
					username: 'v2_runtime_user',
					email: 'v2-runtime-user@example.com',
					role: 'v2_runtime_editor',
					meta: {
						from_blueprint: 'yes',
					},
				},
			],
		});

		const result = await runWordPressJson({
			code: `
				$user = get_user_by('login', 'v2_runtime_user');
				echo json_encode([
					'exists' => (bool) $user,
					'roles' => $user ? array_values($user->roles) : [],
					'can_edit_posts' => $user ? user_can($user, 'edit_posts') : false,
					'meta' => $user ? get_user_meta($user->ID, 'from_blueprint', true) : null,
				]);
			`,
		});

		expect(result).toEqual({
			exists: true,
			roles: ['v2_runtime_editor'],
			can_edit_posts: true,
			meta: 'yes',
		});
	});

	it('imports inline posts', async () => {
		await applyBlueprint({
			version: 2,
			content: [
				{
					type: 'posts',
					source: [
						{
							post_title: 'V2 Runtime Post',
							post_name: 'v2-runtime-post',
							post_content: '<p>Imported from Blueprint v2.</p>',
							post_status: 'publish',
						},
					],
				},
			],
		});

		const result = await runWordPressJson({
			code: `
				$post = get_page_by_path('v2-runtime-post', OBJECT, 'post');
				echo json_encode([
					'exists' => (bool) $post,
					'title' => $post ? $post->post_title : null,
					'content' => $post ? $post->post_content : null,
					'status' => $post ? $post->post_status : null,
				]);
			`,
		});

		expect(result).toEqual({
			exists: true,
			title: 'V2 Runtime Post',
			content: '<p>Imported from Blueprint v2.</p>',
			status: 'publish',
		});
	});

	it('applies site configuration declarations', async () => {
		await applyBlueprint({
			version: 2,
			constants: {
				WP_DEBUG: true,
				WP_ENVIRONMENT_TYPE: 'local',
			},
			siteOptions: {
				blogname: 'V2 Runtime Site',
				timezone_string: 'Europe/Warsaw',
			},
		});

		const result = await runWordPressJson({
			code: `
				echo json_encode([
					'wpDebug' => defined('WP_DEBUG') ? WP_DEBUG : null,
					'environment' => defined('WP_ENVIRONMENT_TYPE') ? WP_ENVIRONMENT_TYPE : null,
					'blogname' => get_option('blogname'),
					'timezone' => get_option('timezone_string'),
				]);
			`,
		});

		expect(result).toEqual({
			wpDebug: true,
			environment: 'local',
			blogname: 'V2 Runtime Site',
			timezone: 'Europe/Warsaw',
		});
	});

	it(
		'applies post import options at runtime',
		async () => {
			const bundle = new InMemoryFilesystem({
				'blueprint.json': JSON.stringify({
					version: 2,
					content: [
						{
							type: 'posts',
							source: [
								'./posts/file-backed.html',
								{
									post_title: 'V2 Parent Page',
									post_name: 'v2-parent-page',
									post_type: 'page',
									post_status: 'publish',
								},
								{
									post_title: 'V2 Child Page',
									post_name: 'v2-child-page',
									post_type: 'page',
									post_status: 'publish',
									post_parent_name: 'V2 Parent Page',
									page_template: 'templates/full-width.php',
									post_content:
										'<a href="https://source.example/child">Child</a>',
									meta_input: {
										source_url:
											'https://source.example/child-meta',
									},
								},
								{
									post_title: 'V2 Categorized Post',
									post_name: 'v2-categorized-post',
									post_status: 'publish',
									post_category: ['Blueprint Category'],
									post_tags: ['Blueprint Tag'],
								},
								{
									post_title: 'V2 Tax Input Post',
									post_name: 'v2-tax-input-post',
									post_status: 'publish',
									tax_input: {
										category: ['Tax Input Category'],
										post_tag: ['Tax Input Tag'],
									},
								},
							],
							urlsMap: {
								'https://source.example':
									'https://mapped.example',
							},
						},
					],
				}),
				posts: {
					'file-backed.html':
						'<p>File-backed https://source.example/post</p>',
				},
			});

			await applyBlueprint(bundle);

			const result = await runWordPressJson({
				code: `
				$file_backed_posts = get_posts(['name' => 'untitled-post', 'post_type' => 'post', 'post_status' => 'any', 'numberposts' => 1]);
				$parent_pages = get_posts(['name' => 'v2-parent-page', 'post_type' => 'page', 'post_status' => 'any', 'numberposts' => 1]);
				$child_pages = get_posts(['name' => 'v2-child-page', 'post_type' => 'page', 'post_status' => 'any', 'numberposts' => 1]);
				$categorized_posts = get_posts(['name' => 'v2-categorized-post', 'post_type' => 'post', 'post_status' => 'any', 'numberposts' => 1]);
				$tax_input_posts = get_posts(['name' => 'v2-tax-input-post', 'post_type' => 'post', 'post_status' => 'any', 'numberposts' => 1]);
				$file_backed_post = $file_backed_posts ? $file_backed_posts[0] : null;
				$parent_page = $parent_pages ? $parent_pages[0] : null;
				$child_page = $child_pages ? $child_pages[0] : null;
				$categorized_post = $categorized_posts ? $categorized_posts[0] : null;
				$tax_input_post = $tax_input_posts ? $tax_input_posts[0] : null;

				echo json_encode([
					'fileBackedContent' => $file_backed_post ? $file_backed_post->post_content : null,
					'childParentId' => $child_page ? (int) $child_page->post_parent : null,
					'parentId' => $parent_page ? (int) $parent_page->ID : null,
					'childTemplate' => $child_page ? get_post_meta($child_page->ID, '_wp_page_template', true) : null,
					'childContent' => $child_page ? $child_page->post_content : null,
					'childMeta' => $child_page ? get_post_meta($child_page->ID, 'source_url', true) : null,
					'categorizedCategories' => $categorized_post ? wp_get_post_terms($categorized_post->ID, 'category', ['fields' => 'names']) : [],
					'categorizedTags' => $categorized_post ? wp_get_post_terms($categorized_post->ID, 'post_tag', ['fields' => 'names']) : [],
					'taxInputCategories' => $tax_input_post ? wp_get_post_terms($tax_input_post->ID, 'category', ['fields' => 'names']) : [],
					'taxInputTags' => $tax_input_post ? wp_get_post_terms($tax_input_post->ID, 'post_tag', ['fields' => 'names']) : [],
				]);
			`,
			});

			expect(result.parentId).toBeGreaterThan(0);
			expect(result.childParentId).toBe(result.parentId);
			expect({
				fileBackedContent: result.fileBackedContent,
				childTemplate: result.childTemplate,
				childContent: result.childContent,
				childMeta: result.childMeta,
				categorizedCategories: result.categorizedCategories,
				categorizedTags: result.categorizedTags,
				taxInputCategories: result.taxInputCategories,
				taxInputTags: result.taxInputTags,
			}).toEqual({
				fileBackedContent:
					'<p>File-backed https://mapped.example/post</p>',
				childTemplate: 'templates/full-width.php',
				childContent:
					'<a href="https://mapped.example/child">Child</a>',
				childMeta: 'https://mapped.example/child-meta',
				categorizedCategories: ['Blueprint Category'],
				categorizedTags: ['Blueprint Tag'],
				taxInputCategories: ['Tax Input Category'],
				taxInputTags: ['Tax Input Tag'],
			});
		},
		{ timeout: 30_000 }
	);

	it('imports bundled media files', async () => {
		const image = await readFile(
			new URL('../fixtures/demo.png', import.meta.url)
		);
		const bundle = new InMemoryFilesystem({
			'blueprint.json': JSON.stringify({
				version: 2,
				media: [
					{
						source: './media/demo.png',
						title: 'V2 Runtime Image',
						alt: 'Imported by a v2 Blueprint runtime test',
					},
				],
			}),
			media: {
				'demo.png': image,
			},
		});

		await applyBlueprint(bundle);

		const result = await runWordPressJson({
			code: `
				$attachments = get_posts([
					'post_type' => 'attachment',
					'post_status' => 'inherit',
					'numberposts' => -1,
				]);
				$match = null;
				foreach ($attachments as $attachment) {
					if ($attachment->post_title === 'V2 Runtime Image') {
						$match = $attachment;
						break;
					}
				}
				echo json_encode([
					'exists' => (bool) $match,
					'mime_type' => $match ? $match->post_mime_type : null,
					'alt' => $match ? get_post_meta($match->ID, '_wp_attachment_image_alt', true) : null,
				]);
			`,
		});

		expect(result).toEqual({
			exists: true,
			mime_type: 'image/png',
			alt: 'Imported by a v2 Blueprint runtime test',
		});
	});

	it('installs v2 plugins and themes with runtime-visible options', async () => {
		await applyBlueprint({
			version: 2,
			plugins: [
				{
					source: {
						directoryName: 'inactive-runtime-plugin',
						files: {
							'inactive-runtime-plugin.php': `<?php
/**
 * Plugin Name: V2 Inactive Runtime Plugin
 */
add_action('init', function () {
	update_option('v2_inactive_runtime_plugin_loaded', 'yes');
});
`,
						},
					},
					active: false,
				},
				{
					source: {
						directoryName: 'active-runtime-plugin',
						files: {
							'active-runtime-plugin.php': `<?php
/**
 * Plugin Name: V2 Active Runtime Plugin
 */
register_activation_hook(__FILE__, function () {
	update_option(
		'v2_active_runtime_plugin_activation',
		get_option('blueprint_activation_' . plugin_basename(__FILE__))
	);
});
add_action('init', function () {
	update_option('v2_active_runtime_plugin_loaded', 'yes');
});
`,
						},
					},
					active: true,
					targetDirectoryName: 'active-runtime-plugin-target',
					activationOptions: {
						source: 'blueprint-v2-runtime-test',
						enabled: true,
					},
				},
			],
			themes: [
				{
					source: {
						directoryName: 'inactive-runtime-theme',
						files: {
							'style.css':
								'/*\nTheme Name: V2 Inactive Runtime Theme\n*/',
							'index.php': '<?php echo "inactive";',
						},
					},
				},
			],
			activeTheme: {
				source: {
					directoryName: 'active-runtime-theme',
					files: {
						'style.css':
							'/*\nTheme Name: V2 Active Runtime Theme\n*/',
						'index.php': '<?php echo "active";',
					},
				},
				targetDirectoryName: 'active-runtime-theme-target',
			},
		});

		const result = await runWordPressJson({
			code: `
				require_once ABSPATH . 'wp-admin/includes/plugin.php';
				$theme = wp_get_theme();
				echo json_encode([
					'activePluginInstalled' => file_exists(WP_PLUGIN_DIR . '/active-runtime-plugin-target/active-runtime-plugin.php'),
					'activePluginActive' => is_plugin_active('active-runtime-plugin-target/active-runtime-plugin.php'),
					'activePluginLoaded' => get_option('v2_active_runtime_plugin_loaded'),
					'activationOptions' => get_option('v2_active_runtime_plugin_activation'),
					'inactivePluginInstalled' => file_exists(WP_PLUGIN_DIR . '/inactive-runtime-plugin/inactive-runtime-plugin.php'),
					'inactivePluginActive' => is_plugin_active('inactive-runtime-plugin/inactive-runtime-plugin.php'),
					'inactivePluginLoaded' => get_option('v2_inactive_runtime_plugin_loaded', false),
					'activeThemeName' => $theme->get('Name'),
					'activeThemeStylesheet' => get_stylesheet(),
					'inactiveThemeInstalled' => wp_get_theme('inactive-runtime-theme')->exists(),
				]);
			`,
		});

		expect(result).toEqual({
			activePluginInstalled: true,
			activePluginActive: true,
			activePluginLoaded: 'yes',
			activationOptions: {
				source: 'blueprint-v2-runtime-test',
				enabled: true,
			},
			inactivePluginInstalled: true,
			inactivePluginActive: false,
			inactivePluginLoaded: false,
			activeThemeName: 'V2 Active Runtime Theme',
			activeThemeStylesheet: 'active-runtime-theme-target',
			inactiveThemeInstalled: true,
		});
	});

	it('registers post types through generated mu-plugins', async () => {
		await applyBlueprint({
			version: 2,
			postTypes: {
				movie: {
					label: 'Movies',
					public: true,
					show_in_rest: true,
				},
			},
		});

		const result = await runWordPressJson({
			code: `
				echo json_encode([
					'exists' => post_type_exists('movie'),
					'label' => post_type_exists('movie') ? get_post_type_object('movie')->label : null,
				]);
			`,
		});

		expect(result).toEqual({
			exists: true,
			label: 'Movies',
		});
	});

	it('registers post types from support files', async () => {
		const bundle = new InMemoryFilesystem({
			'blueprint.json': JSON.stringify({
				version: 2,
				postTypes: {
					book: './post-types/book.json',
				},
			}),
			'post-types': {
				'book.json': JSON.stringify({
					label: 'Books',
					public: true,
					show_in_rest: true,
					supports: ['title', 'editor', 'custom-fields'],
				}),
			},
		});

		await applyBlueprint(bundle);

		const result = await runWordPressJson({
			code: `
				$post_type = get_post_type_object('book');
				echo json_encode([
					'exists' => post_type_exists('book'),
					'label' => $post_type ? $post_type->label : null,
					'public' => $post_type ? $post_type->public : null,
					'showInRest' => $post_type ? $post_type->show_in_rest : null,
					'supportsTitle' => post_type_supports('book', 'title'),
					'supportsEditor' => post_type_supports('book', 'editor'),
					'supportsCustomFields' => post_type_supports('book', 'custom-fields'),
				]);
			`,
		});

		expect(result).toEqual({
			exists: true,
			label: 'Books',
			public: true,
			showInRest: true,
			supportsTitle: true,
			supportsEditor: true,
			supportsCustomFields: true,
		});
	});

	it(
		'applies WXR URL maps',
		async () => {
			const wxr = await readFile(
				new URL(
					'../fixtures/import-wxr-base-url-rewriting.xml',
					import.meta.url
				)
			);
			const bundle = new InMemoryFilesystem({
				'blueprint.json': JSON.stringify({
					version: 2,
					content: [
						{
							type: 'wxr',
							source: './content/import.wxr',
							urlsMap: {
								'https://🚀-science.com/science':
									'https://mapped.example/science',
							},
							authorsMode: 'default-author',
						},
					],
				}),
				content: {
					'import.wxr': wxr,
				},
			});

			await applyBlueprint(bundle);

			const result = await runWordPressJson({
				code: `
				$post = null;
				foreach (get_posts([
					'post_type' => 'post',
					'post_status' => 'any',
					'numberposts' => -1,
				]) as $candidate) {
					if ($candidate->post_title === '"The Road Not Taken" by Robert Frost') {
						$post = $candidate;
						break;
					}
				}
				echo json_encode([
					'exists' => (bool) $post,
					'content' => $post ? $post->post_content : null,
				]);
			`,
			});

			expect(result.exists).toBe(true);
			expect(result.content).toContain('https://mapped.example/science');
			expect(result.content).not.toContain(
				'https://🚀-science.com/science'
			);
			expect(result.content).toContain(handler.absoluteUrl);
		},
		{ timeout: 30_000 }
	);

	/**
	 * Compiles and executes one v2 Blueprint against the booted WordPress site.
	 */
	async function applyBlueprint(
		blueprint: BlueprintV2Declaration | InMemoryFilesystem
	) {
		const compiled = await compileBlueprintForExecution(blueprint);
		expect(compiled.version).toBe(2);
		await compiled.run(php);
	}

	/**
	 * Loads WordPress and evaluates a small assertion script that returns JSON.
	 */
	async function runWordPressJson({ code }: { code: string }) {
		const response = await php.run({
			code: `<?php
			require '/wordpress/wp-load.php';
			${code}
			`,
		});
		return response.json;
	}
});
