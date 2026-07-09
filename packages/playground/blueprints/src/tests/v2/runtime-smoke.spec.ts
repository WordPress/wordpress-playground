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
import {
	describe,
	beforeAll,
	beforeEach,
	afterEach,
	expect,
	it,
	vi,
} from 'vitest';
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

	it('applies site configuration options', async () => {
		const originalFetch = global.fetch;
		const goTo = vi.fn();
		const emptyZip = new Uint8Array([
			0x50, 0x4b, 0x05, 0x06, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
			0, 0, 0,
		]);
		(php as any).pathToInternalUrl = async (path: string) =>
			`http://playground-domain${path}`;
		(php as any).goTo = goTo;
		global.fetch = vi.fn(async (input) => {
			const url = String(input);
			if (url.includes('/translations/core/1.0/')) {
				return {
					json: async () => ({
						translations: [
							{
								language: 'es_ES',
								package: 'https://example.com/es_ES.zip',
							},
						],
					}),
				} as Response;
			}
			return {
				ok: true,
				arrayBuffer: async () => emptyZip.buffer,
			} as Response;
		});

		try {
			await applyBlueprint({
				version: 2,
				applicationOptions: {
					'wordpress-playground': {
						landingPage: '/wp-admin/edit.php',
						login: true,
					},
				},
				constants: {
					WP_DEBUG: true,
				},
				siteOptions: {
					blogname: 'V2 Runtime Site',
					timezone_string: 'Europe/Warsaw',
				},
				siteLanguage: 'es_ES',
			});
		} finally {
			global.fetch = originalFetch;
		}

		const result = await runWordPressJson({
			code: `
				echo json_encode([
					'wp_debug' => defined('WP_DEBUG') ? WP_DEBUG : null,
					'auto_login_user' => defined('PLAYGROUND_AUTO_LOGIN_AS_USER') ? PLAYGROUND_AUTO_LOGIN_AS_USER : null,
					'blogname' => get_option('blogname'),
					'timezone' => get_option('timezone_string'),
					'language' => get_option('WPLANG'),
				]);
			`,
		});

		expect(result).toEqual({
			wp_debug: true,
			auto_login_user: 'admin',
			blogname: 'V2 Runtime Site',
			timezone: 'Europe/Warsaw',
			language: 'es_ES',
		});
		expect(goTo).toHaveBeenCalledWith(
			'/index.php?playground-redirection-handler&next=' +
				encodeURIComponent('http://playground-domain/wp-admin/edit.php')
		);
	});

	it('installs plugins and themes with their v2 activation state', async () => {
		await applyBlueprint({
			version: 2,
			plugins: [
				{
					source: {
						directoryName: 'v2-active-plugin',
						files: {
							'index.php': `<?php
								/**
								 * Plugin Name: V2 Active Plugin
								 */
								register_activation_hook(__FILE__, function () {
									update_option('v2_active_plugin_activated', 'yes');
								});
							`,
						},
					},
				},
				{
					source: {
						directoryName: 'v2-inactive-plugin',
						files: {
							'index.php': `<?php
								/**
								 * Plugin Name: V2 Inactive Plugin
								 */
								register_activation_hook(__FILE__, function () {
									update_option('v2_inactive_plugin_activated', 'yes');
								});
							`,
						},
					},
					active: false,
				},
			],
			themes: [
				{
					source: {
						directoryName: 'v2-inactive-theme',
						files: {
							'style.css': `/*
								Theme Name: V2 Inactive Theme
							*/`,
							'index.php': '<?php',
						},
					},
				},
			],
			activeTheme: {
				source: {
					directoryName: 'v2-active-theme',
					files: {
						'style.css': `/*
							Theme Name: V2 Active Theme
						*/`,
						'index.php': '<?php',
					},
				},
			},
		});

		const result = await runWordPressJson({
			code: `
				require_once ABSPATH . 'wp-admin/includes/plugin.php';
				echo json_encode([
					'active_plugin_active' => is_plugin_active('v2-active-plugin/index.php'),
					'inactive_plugin_active' => is_plugin_active('v2-inactive-plugin/index.php'),
					'active_plugin_activated' => get_option('v2_active_plugin_activated'),
					'inactive_plugin_activated' => get_option('v2_inactive_plugin_activated', 'no'),
					'inactive_theme_exists' => wp_get_theme('v2-inactive-theme')->exists(),
					'active_theme_stylesheet' => get_stylesheet(),
					'active_theme_name' => wp_get_theme()->get('Name'),
				]);
			`,
		});

		expect(result).toEqual({
			active_plugin_active: true,
			inactive_plugin_active: false,
			active_plugin_activated: 'yes',
			inactive_plugin_activated: 'no',
			inactive_theme_exists: true,
			active_theme_stylesheet: 'v2-active-theme',
			active_theme_name: 'V2 Active Theme',
		});
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

	it('registers post types from bundled support files', async () => {
		const bundle = new InMemoryFilesystem({
			'blueprint.json': JSON.stringify({
				version: 2,
				postTypes: {
					event: './post-types/event.json',
				},
			}),
			'post-types': {
				'event.json': JSON.stringify({
					label: 'Events',
					public: true,
					show_in_rest: true,
					supports: ['title', 'editor'],
				}),
			},
		});

		await applyBlueprint(bundle);

		const result = await runWordPressJson({
			code: `
				$post_type = get_post_type_object('event');
				echo json_encode([
					'exists' => post_type_exists('event'),
					'label' => $post_type ? $post_type->label : null,
					'show_in_rest' => $post_type ? $post_type->show_in_rest : null,
					'supports_editor' => post_type_supports('event', 'editor'),
				]);
			`,
		});

		expect(result).toEqual({
			exists: true,
			label: 'Events',
			show_in_rest: true,
			supports_editor: true,
		});
	});

	it('loads inline mu-plugins', async () => {
		await applyBlueprint({
			version: 2,
			muPlugins: [
				{
					filename: 'v2-runtime-mu-plugin.php',
					content: `<?php
						add_action('init', function () {
							update_option('v2_runtime_mu_plugin_loaded', 'yes');
						});
					`,
				},
			],
		});

		const result = await runWordPressJson({
			code: `
				echo json_encode([
					'loaded' => get_option('v2_runtime_mu_plugin_loaded'),
				]);
			`,
		});

		expect(result).toEqual({
			loaded: 'yes',
		});
	});

	it('installs inline font files', async () => {
		await applyBlueprint({
			version: 2,
			fonts: {
				'v2-runtime-font': {
					filename: 'v2-runtime-font.woff2',
					content: 'fontdata',
				},
			},
		});

		const result = await runWordPressJson({
			code: `
				$family = get_page_by_path('v2-runtime-font', OBJECT, 'wp_font_family');
				$faces = $family ? get_posts([
					'post_type' => 'wp_font_face',
					'post_parent' => $family->ID,
					'post_status' => 'publish',
					'numberposts' => -1,
				]) : [];
				$face = $faces ? $faces[0] : null;
				echo json_encode([
					'family_exists' => (bool) $family,
					'family_title' => $family ? $family->post_title : null,
					'face_exists' => (bool) $face,
					'face_file' => $face ? get_post_meta($face->ID, '_wp_font_face_file', true) : null,
				]);
			`,
		});

		expect(result).toMatchObject({
			family_exists: true,
			family_title: 'V2 Runtime Font',
			face_exists: true,
		});
		expect(result.face_file).toMatch(/v2-runtime-font.*\.woff2$/);
	});

	it('imports bundled SQL dumps', async () => {
		const bundle = new InMemoryFilesystem({
			'blueprint.json': JSON.stringify({
				version: 2,
				content: [
					{
						type: 'mysql-dump',
						source: './sql/site-options.sql',
					},
				],
			}),
			sql: {
				'site-options.sql': `
					CREATE TABLE blueprint_v2_runtime_sql (value TEXT);
					INSERT INTO blueprint_v2_runtime_sql (value)
					VALUES ('imported from bundled SQL');
				`,
			},
		});

		await applyBlueprint(bundle);

		const result = await runWordPressJson({
			code: `
				global $wpdb;
				echo json_encode([
					'value' => $wpdb->get_var('SELECT value FROM blueprint_v2_runtime_sql'),
				]);
			`,
		});

		expect(result).toEqual({
			value: 'imported from bundled SQL',
		});
	});

	it('imports bundled WXR files', async () => {
		const wxr = await readFile(
			new URL('../fixtures/import-wxr-slash-issue.xml', import.meta.url)
		);
		const bundle = new InMemoryFilesystem({
			'blueprint.json': JSON.stringify({
				version: 2,
				plugins: ['wordpress-importer'],
				content: [
					{
						type: 'wxr',
						source: './content/import.wxr',
						authorsMode: 'default-author',
						importComments: false,
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
				$post = get_page_by_path('issue', OBJECT, 'post');
				echo json_encode([
					'exists' => (bool) $post,
					'title' => $post ? $post->post_title : null,
				]);
			`,
		});

		expect(result).toEqual({
			exists: true,
			title: '"Issue\\Issue"',
		});
	}, 30_000);

	it('writes files from additional Blueprint v2 steps', async () => {
		await applyBlueprint({
			version: 2,
			additionalStepsAfterExecution: [
				{
					step: 'writeFiles',
					files: {
						'site:wp-content/v2-runtime-readme.txt': {
							filename: 'v2-runtime-readme.txt',
							content: 'Written by Blueprint v2.',
						},
						'site:wp-content/v2-runtime-tree': {
							directoryName: 'v2-runtime-tree',
							files: {
								'nested.txt': 'Nested Blueprint v2 file.',
							},
						},
					},
				},
			],
		});

		expect(
			php.readFileAsText('/wordpress/wp-content/v2-runtime-readme.txt')
		).toBe('Written by Blueprint v2.');
		expect(
			php.readFileAsText(
				'/wordpress/wp-content/v2-runtime-tree/nested.txt'
			)
		).toBe('Nested Blueprint v2 file.');
	});

	it('runs bundled PHP files from additional Blueprint v2 steps', async () => {
		const bundle = new InMemoryFilesystem({
			'blueprint.json': JSON.stringify({
				version: 2,
				additionalStepsAfterExecution: [
					{
						step: 'runPHP',
						code: './scripts/set-option.php',
						env: {
							V2_RUNTIME_VALUE: 'set by bundled PHP',
						},
					},
				],
			}),
			scripts: {
				'set-option.php': `<?php
					require '/wordpress/wp-load.php';
					update_option(
						'v2_runtime_file_backed_runphp',
						getenv('V2_RUNTIME_VALUE')
					);
				`,
			},
		});

		await applyBlueprint(bundle);

		const result = await runWordPressJson({
			code: `
				echo json_encode([
					'value' => get_option('v2_runtime_file_backed_runphp'),
				]);
			`,
		});

		expect(result).toEqual({
			value: 'set by bundled PHP',
		});
	});

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
