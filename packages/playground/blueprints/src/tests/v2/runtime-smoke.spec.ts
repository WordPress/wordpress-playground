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
