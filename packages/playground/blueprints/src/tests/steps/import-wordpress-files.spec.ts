import type { PHP, PHPRequestHandler } from '@php-wasm/universal';
import { RecommendedPHPVersion } from '@wp-playground/common';
import { importWordPressFiles } from '../../lib/steps/import-wordpress-files';
import { zipWpContent } from '../../lib/steps/zip-wp-content';
import {
	getSqliteDriverModule,
	getWordPressModule,
} from '@wp-playground/wordpress-builds';
import { bootWordPressAndRequestHandler } from '@wp-playground/wordpress';
import { loadNodeRuntime } from '@php-wasm/node';
import { phpVar } from '@php-wasm/util';
import { setURLScope } from '@php-wasm/scopes';

describe('Blueprint step importWordPressFiles', () => {
	let sourceHandler: PHPRequestHandler;
	let sourcePHP: PHP;
	let targetHandler: PHPRequestHandler;
	let targetPHP: PHP;

	const sourceScope = 'source-scope-123';
	const targetScope = 'target-scope-456';

	beforeEach(async () => {
		// Boot source playground with a specific scope
		const sourceSiteUrl = setURLScope(
			new URL('http://playground-domain/'),
			sourceScope
		).toString();

		sourceHandler = await bootWordPressAndRequestHandler({
			createPhpRuntime: async () =>
				await loadNodeRuntime(RecommendedPHPVersion),
			siteUrl: sourceSiteUrl,
			wordPressZip: await getWordPressModule(),
			sqliteIntegrationPluginZip: await getSqliteDriverModule(),
		});
		sourcePHP = await sourceHandler.getPrimaryPhp();

		// Boot target playground with a different scope
		const targetSiteUrl = setURLScope(
			new URL('http://playground-domain/'),
			targetScope
		).toString();

		targetHandler = await bootWordPressAndRequestHandler({
			createPhpRuntime: async () =>
				await loadNodeRuntime(RecommendedPHPVersion),
			siteUrl: targetSiteUrl,
			wordPressZip: await getWordPressModule(),
			sqliteIntegrationPluginZip: await getSqliteDriverModule(),
		});
		targetPHP = await targetHandler.getPrimaryPhp();
	});

	afterEach(async () => {
		sourcePHP.exit();
		targetPHP.exit();
		await sourceHandler[Symbol.asyncDispose]();
		await targetHandler[Symbol.asyncDispose]();
	});

	it('should include playground-export.json manifest in the exported zip', async () => {
		const zipBuffer = await zipWpContent(sourcePHP);

		// Check that the zip contains the manifest by inspecting it
		await targetPHP.writeFile('/tmp/check.zip', zipBuffer);
		const result = await targetPHP.run({
			code: `<?php
			$zip = new ZipArchive();
			$zip->open('/tmp/check.zip');
			$manifest = $zip->getFromName('playground-export.json');
			$zip->close();
			echo $manifest;
			`,
		});

		expect(result.text).toBeTruthy();
		const manifest = JSON.parse(result.text);
		expect(manifest.siteUrl).toContain(`scope:${sourceScope}`);
	});

	it('should replace old scope URLs with new scope URLs in post content during import', async () => {
		// Create a post with an image URL containing the source scope
		const sourceUrl = await sourcePHP.absoluteUrl;
		const imageUrl = `${sourceUrl.replace(/\/$/, '')}/wp-content/uploads/2024/01/test-image.png`;

		await sourcePHP.run({
			code: `<?php
			require ${phpVar(await sourcePHP.documentRoot)} . '/wp-load.php';
			wp_insert_post([
				'post_title' => 'Test Post with Image',
				'post_content' => '<img src="${imageUrl}" alt="test">',
				'post_status' => 'publish',
			]);
			`,
		});

		// Export from source
		const zipBuffer = await zipWpContent(sourcePHP);
		const zipFile = new File([zipBuffer], 'export.zip');

		// Import into target
		await importWordPressFiles(targetPHP, {
			wordPressFilesZip: zipFile,
		});

		// Check that the URLs were updated
		const result = await targetPHP.run({
			code: `<?php
			require ${phpVar(await targetPHP.documentRoot)} . '/wp-load.php';
			$posts = get_posts(['post_status' => 'publish', 'numberposts' => 1]);
			echo $posts[0]->post_content;
			`,
		});

		// The image URL should now contain the target scope instead of source scope
		expect(result.text).toContain(`scope:${targetScope}`);
		expect(result.text).not.toContain(`scope:${sourceScope}`);
	});

	it('should replace URLs in post meta during import', async () => {
		const sourceUrl = await sourcePHP.absoluteUrl;
		const imageUrl = `${sourceUrl.replace(/\/$/, '')}/wp-content/uploads/2024/01/featured.jpg`;

		await sourcePHP.run({
			code: `<?php
			require ${phpVar(await sourcePHP.documentRoot)} . '/wp-load.php';
			$post_id = wp_insert_post([
				'post_title' => 'Test Post',
				'post_content' => 'Test content',
				'post_status' => 'publish',
			]);
			update_post_meta($post_id, '_custom_image_url', ${phpVar(imageUrl)});
			`,
		});

		// Export and import
		const zipBuffer = await zipWpContent(sourcePHP);
		const zipFile = new File([zipBuffer], 'export.zip');
		await importWordPressFiles(targetPHP, {
			wordPressFilesZip: zipFile,
		});

		// Check that the meta URL was updated
		const result = await targetPHP.run({
			code: `<?php
			require ${phpVar(await targetPHP.documentRoot)} . '/wp-load.php';
			$posts = get_posts(['post_status' => 'publish', 'numberposts' => 1]);
			echo get_post_meta($posts[0]->ID, '_custom_image_url', true);
			`,
		});

		expect(result.text).toContain(`scope:${targetScope}`);
		expect(result.text).not.toContain(`scope:${sourceScope}`);
	});

	it('should replace URLs in options during import', async () => {
		const sourceUrl = await sourcePHP.absoluteUrl;
		const logoUrl = `${sourceUrl.replace(/\/$/, '')}/wp-content/uploads/logo.png`;

		await sourcePHP.run({
			code: `<?php
			require ${phpVar(await sourcePHP.documentRoot)} . '/wp-load.php';
			update_option('custom_logo_url', ${phpVar(logoUrl)});
			`,
		});

		// Export and import
		const zipBuffer = await zipWpContent(sourcePHP);
		const zipFile = new File([zipBuffer], 'export.zip');
		await importWordPressFiles(targetPHP, {
			wordPressFilesZip: zipFile,
		});

		// Check that the option URL was updated
		const result = await targetPHP.run({
			code: `<?php
			require ${phpVar(await targetPHP.documentRoot)} . '/wp-load.php';
			echo get_option('custom_logo_url');
			`,
		});

		expect(result.text).toContain(`scope:${targetScope}`);
		expect(result.text).not.toContain(`scope:${sourceScope}`);
	});

	it('should infer scope from database when manifest is missing and still replace URLs', async () => {
		// Create a post with an image URL containing the source scope
		const sourceUrl = sourcePHP.absoluteUrl;
		const imageUrl = `${sourceUrl.replace(/\/$/, '')}/wp-content/uploads/2024/01/legacy-image.png`;

		// First, update the siteurl option in the database to match the scoped URL.
		// This simulates a site where the user changed the URL or where the option
		// was set correctly during setup. By default, the database may contain a
		// different URL than the scoped one we're using.
		await sourcePHP.run({
			code: `<?php
			require ${phpVar(sourcePHP.documentRoot)} . '/wp-load.php';
			global $wpdb;
			$wpdb->update(
				$wpdb->options,
				['option_value' => ${phpVar(sourceUrl)}],
				['option_name' => 'siteurl']
			);
			wp_insert_post([
				'post_title' => 'Legacy Post with Image',
				'post_content' => '<img src="${imageUrl}" alt="legacy">',
				'post_status' => 'publish',
			]);
			`,
		});

		// Export from source, then remove the manifest to simulate a legacy export
		const zipBuffer = await zipWpContent(sourcePHP);
		await targetPHP.writeFile('/tmp/with-manifest.zip', zipBuffer);

		// Remove the manifest from the zip
		await targetPHP.run({
			code: `<?php
			$zip = new ZipArchive();
			$zip->open('/tmp/with-manifest.zip');
			$zip->deleteName('playground-export.json');
			$zip->close();
			`,
		});

		const modifiedZipBuffer = await targetPHP.readFileAsBuffer(
			'/tmp/with-manifest.zip'
		);
		const zipFile = new File([modifiedZipBuffer], 'legacy-export.zip');

		// Import into target - should infer the old scope from the database
		await importWordPressFiles(targetPHP, {
			wordPressFilesZip: zipFile,
		});

		// Check that the URLs were updated despite no manifest
		const result = await targetPHP.run({
			code: `<?php
			require ${phpVar(targetPHP.documentRoot)} . '/wp-load.php';
			$posts = get_posts(['post_status' => 'publish', 'numberposts' => 1]);
			echo $posts[0]->post_content;
			`,
		});

		// The image URL should now contain the target scope instead of source scope
		expect(result.text).toContain(`scope:${targetScope}`);
		expect(result.text).not.toContain(`scope:${sourceScope}`);
	});
});
