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
import { dirname, joinPaths, phpVar, randomFilename } from '@php-wasm/util';
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
		expect(manifest.formatVersion).toBe(2);
		expect(manifest.siteUrl).toContain(`scope:${sourceScope}`);
	});

	it('should export all user-owned wp-content files and wp-config.php', async () => {
		const documentRoot = await sourcePHP.documentRoot;
		const customizedThemeFile = joinPaths(
			documentRoot,
			'wp-content/themes/twentytwentyfive/playground-export-test.txt'
		);
		await sourcePHP.mkdir(dirname(customizedThemeFile));
		await sourcePHP.writeFile(
			customizedThemeFile,
			new TextEncoder().encode('customized default theme')
		);

		const zipBuffer = await zipWpContent(sourcePHP);
		await targetPHP.writeFile('/tmp/check-complete.zip', zipBuffer);
		const result = await targetPHP.run({
			code: `<?php
			$zip = new ZipArchive();
			$zip->open('/tmp/check-complete.zip');
			echo json_encode([
				'themeFile' => $zip->getFromName('wp-content/themes/twentytwentyfive/playground-export-test.txt'),
				'hasWpConfig' => $zip->locateName('wp-config.php') !== false,
			]);
			$zip->close();
			`,
		});

		expect(JSON.parse(result.text)).toEqual({
			themeFile: 'customized default theme',
			hasWpConfig: true,
		});
	});

	it('should omit legacy runtime artifacts but preserve custom db.php', async () => {
		const documentRoot = await sourcePHP.documentRoot;
		const wpContentPath = joinPaths(documentRoot, 'wp-content');
		const runtimePluginPath = joinPaths(
			wpContentPath,
			'mu-plugins/0-playground.php'
		);
		const dbPhpPath = joinPaths(wpContentPath, 'db.php');
		await sourcePHP.mkdir(dirname(runtimePluginPath));
		await sourcePHP.writeFile(
			runtimePluginPath,
			new TextEncoder().encode('<?php // Legacy Playground runtime')
		);
		await sourcePHP.writeFile(
			dbPhpPath,
			new TextEncoder().encode(
				'<?php // @playground-managed generated database drop-in'
			)
		);

		const managedDbZip = await zipWpContent(sourcePHP);
		await targetPHP.writeFile('/tmp/managed-db.zip', managedDbZip);

		await sourcePHP.writeFile(
			dbPhpPath,
			new TextEncoder().encode('<?php // User-provided database drop-in')
		);
		const customDbZip = await zipWpContent(sourcePHP);
		await targetPHP.writeFile('/tmp/custom-db.zip', customDbZip);

		const result = await targetPHP.run({
			code: `<?php
			$managed = new ZipArchive();
			$managed->open('/tmp/managed-db.zip');
			$custom = new ZipArchive();
			$custom->open('/tmp/custom-db.zip');
			echo json_encode([
				'managedDb' => $managed->locateName('wp-content/db.php') !== false,
				'managedPlugin' => $managed->locateName('wp-content/mu-plugins/0-playground.php') !== false,
				'customDb' => $custom->getFromName('wp-content/db.php'),
				'customPlugin' => $custom->locateName('wp-content/mu-plugins/0-playground.php') !== false,
			]);
			$managed->close();
			$custom->close();
			`,
		});

		expect(JSON.parse(result.text)).toEqual({
			managedDb: false,
			managedPlugin: false,
			customDb: '<?php // User-provided database drop-in',
			customPlugin: false,
		});
	});

	it('should retain current runtime artifacts when old archives contain them', async () => {
		const targetDocumentRoot = await targetPHP.documentRoot;
		const runtimeRelativePath = 'wp-content/mu-plugins/0-playground.php';
		const targetRuntimePath = joinPaths(
			targetDocumentRoot,
			runtimeRelativePath
		);
		await targetPHP.mkdir(dirname(targetRuntimePath));
		await targetPHP.writeFile(
			targetRuntimePath,
			new TextEncoder().encode('<?php // Current Playground runtime')
		);

		const zipBuffer = await zipWpContent(sourcePHP);
		await targetPHP.writeFile('/tmp/legacy-runtime.zip', zipBuffer);
		await targetPHP.run({
			code: `<?php
			$zip = new ZipArchive();
			$zip->open('/tmp/legacy-runtime.zip');
			$zip->addFromString(
				${phpVar(runtimeRelativePath)},
				'<?php // Archived Playground runtime'
			);
			$zip->close();
			`,
		});

		await importWordPressFiles(targetPHP, {
			wordPressFilesZip: new File(
				[await targetPHP.readFileAsBuffer('/tmp/legacy-runtime.zip')],
				'legacy-runtime.zip'
			),
		});

		expect(await targetPHP.readFileAsText(targetRuntimePath)).toBe(
			'<?php // Current Playground runtime'
		);
	});

	it('should leave current runtime artifacts in place when staging fails', async () => {
		const targetDocumentRoot = await targetPHP.documentRoot;
		const targetRuntimePath = joinPaths(
			targetDocumentRoot,
			'wp-content/mu-plugins/0-playground.php'
		);
		await targetPHP.mkdir(dirname(targetRuntimePath));
		await targetPHP.writeFile(
			targetRuntimePath,
			new TextEncoder().encode('<?php // Current Playground runtime')
		);
		const zipBuffer = await zipWpContent(sourcePHP);
		vi.spyOn(targetPHP, 'cp').mockImplementation(() => {
			throw new Error('Failed to stage runtime artifact');
		});

		await expect(
			importWordPressFiles(targetPHP, {
				wordPressFilesZip: new File([zipBuffer], 'export.zip'),
			})
		).rejects.toThrow('Failed to stage runtime artifact');

		expect(await targetPHP.readFileAsText(targetRuntimePath)).toBe(
			'<?php // Current Playground runtime'
		);
	});

	it('should import customized default themes from versioned exports', async () => {
		const sourceDocumentRoot = await sourcePHP.documentRoot;
		const targetDocumentRoot = await targetPHP.documentRoot;
		const customizedThemeFile = joinPaths(
			sourceDocumentRoot,
			'wp-content/themes/twentytwentyfive/playground-import-test.txt'
		);
		await sourcePHP.writeFile(
			customizedThemeFile,
			new TextEncoder().encode('purple theme customization')
		);

		const zipBuffer = await zipWpContent(sourcePHP);
		await importWordPressFiles(targetPHP, {
			wordPressFilesZip: new File([zipBuffer], 'versioned-export.zip'),
		});

		expect(
			await targetPHP.readFileAsText(
				joinPaths(
					targetDocumentRoot,
					'wp-content/themes/twentytwentyfive/playground-import-test.txt'
				)
			)
		).toBe('purple theme customization');
	});

	it('should not restore user files missing from versioned exports', async () => {
		const sourceDocumentRoot = await sourcePHP.documentRoot;
		const targetDocumentRoot = await targetPHP.documentRoot;
		const themeRelativePath = 'wp-content/themes/twentytwentyfive';
		await sourcePHP.rmdir(
			joinPaths(sourceDocumentRoot, themeRelativePath),
			{ recursive: true }
		);

		const zipBuffer = await zipWpContent(sourcePHP);
		await importWordPressFiles(targetPHP, {
			wordPressFilesZip: new File([zipBuffer], 'versioned-export.zip'),
		});

		expect(
			await targetPHP.fileExists(
				joinPaths(targetDocumentRoot, themeRelativePath)
			)
		).toBe(false);
	});

	it('should restore user files omitted from legacy exports', async () => {
		const targetDocumentRoot = await targetPHP.documentRoot;
		const zipPath = joinPaths('/tmp', `${randomFilename()}.zip`);
		await targetPHP.run({
			code: `<?php
			$zip = new ZipArchive();
			$zip->open(${phpVar(zipPath)}, ZipArchive::CREATE | ZipArchive::OVERWRITE);
			$zip->addFromString('wp-content/plugins/legacy-import.php', '<?php');
			$zip->close();
			`,
		});

		const zipBuffer = await targetPHP.readFileAsBuffer(zipPath);
		await importWordPressFiles(targetPHP, {
			wordPressFilesZip: new File([zipBuffer], 'legacy-export.zip'),
		});

		expect(
			await targetPHP.fileExists(
				joinPaths(
					targetDocumentRoot,
					'wp-content/themes/twentytwentyfive'
				)
			)
		).toBe(true);
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

	it('should preserve live files and clean staging when preparation fails', async () => {
		const zipFile = await createMinimalWordPressFilesZip(targetPHP);
		const documentRoot = await targetPHP.documentRoot;
		const dbDropInPath = joinPaths(documentRoot, 'wp-content', 'db.php');
		const databasePath = joinPaths(documentRoot, 'wp-content', 'database');
		const dbDropInContents = '<?php // Live SQLite drop-in';
		await targetPHP.writeFile(dbDropInPath, dbDropInContents);
		expect(await targetPHP.fileExists(databasePath)).toBe(true);

		const listFiles = targetPHP.listFiles.bind(targetPHP);
		const listFilesSpy = vi
			.spyOn(targetPHP, 'listFiles')
			.mockImplementation((path, options) => {
				if (path.startsWith('/tmp/import-wordpress-files-')) {
					throw new Error('Injected pre-commit failure');
				}
				return listFiles(path, options);
			});

		try {
			await expect(
				importWordPressFiles(targetPHP, {
					wordPressFilesZip: zipFile,
				})
			).rejects.toThrow('Injected pre-commit failure');
		} finally {
			listFilesSpy.mockRestore();
		}

		expect(await targetPHP.readFileAsText(dbDropInPath)).toBe(
			dbDropInContents
		);
		expect(await targetPHP.fileExists(databasePath)).toBe(true);
		expect(
			(await targetPHP.listFiles('/tmp')).filter((path) =>
				path.startsWith('import-wordpress-files-')
			)
		).toEqual([]);
	});

	it('should preserve remaining staged files when replacement fails', async () => {
		const zipFile = await createMinimalWordPressFilesZip(targetPHP);
		const documentRoot = await targetPHP.documentRoot;
		const mv = targetPHP.mv.bind(targetPHP);
		const mvSpy = vi
			.spyOn(targetPHP, 'mv')
			.mockImplementation((fromPath, toPath) => {
				if (
					fromPath.startsWith('/tmp/import-wordpress-files-') &&
					toPath.startsWith(`${documentRoot}/`)
				) {
					throw new Error('Injected replacement failure');
				}
				return mv(fromPath, toPath);
			});

		try {
			await expect(
				importWordPressFiles(targetPHP, {
					wordPressFilesZip: zipFile,
				})
			).rejects.toThrow('Injected replacement failure');
		} finally {
			mvSpy.mockRestore();
		}

		const stagingDirectories = (await targetPHP.listFiles('/tmp')).filter(
			(path) => path.startsWith('import-wordpress-files-')
		);
		expect(stagingDirectories).toHaveLength(1);
		expect(
			await targetPHP.fileExists(
				joinPaths(
					'/tmp',
					stagingDirectories[0],
					'wp-content',
					'plugins',
					'import-test',
					'import-test.php'
				)
			)
		).toBe(true);
	});

	it('should import WordPress files from a single wrapping directory', async () => {
		const zipPath = joinPaths('/tmp', `${randomFilename()}.zip`);
		const pluginPath =
			'playground-export/wp-content/plugins/nested-plugin/nested-plugin.php';
		const themePath =
			'playground-export/wp-content/themes/nested-theme/style.css';

		await targetPHP.run({
			code: `<?php
			$zip = new ZipArchive();
			$zip->open(${phpVar(zipPath)}, ZipArchive::CREATE | ZipArchive::OVERWRITE);
			$zip->addFromString(${phpVar(pluginPath)}, ${phpVar('<?php /* Plugin Name: Nested Plugin */')});
			$zip->addFromString(${phpVar(themePath)}, ${phpVar('/* Theme Name: Nested Theme */')});
			$zip->close();
			`,
		});

		const zipBuffer = await targetPHP.readFileAsBuffer(zipPath);
		await targetPHP.unlink(zipPath);
		const zipFile = new File([zipBuffer], 'nested-wordpress-files.zip');

		await importWordPressFiles(targetPHP, {
			wordPressFilesZip: zipFile,
		});

		const documentRoot = await targetPHP.documentRoot;
		expect(
			await targetPHP.fileExists(
				`${documentRoot}/wp-content/plugins/nested-plugin/nested-plugin.php`
			)
		).toBe(true);
		expect(
			await targetPHP.fileExists(
				`${documentRoot}/wp-content/themes/nested-theme/style.css`
			)
		).toBe(true);
		expect(
			await targetPHP.fileExists(
				`${documentRoot}/playground-export/wp-content/plugins/nested-plugin/nested-plugin.php`
			)
		).toBe(false);
	});

	it('should unwrap WordPress file archives without wp-content', async () => {
		const zipPath = joinPaths('/tmp', `${randomFilename()}.zip`);
		const configSamplePath = 'playground-export/wp-config-sample.php';
		const configSampleContents = '<?php /* Nested config sample */';

		await targetPHP.run({
			code: `<?php
			$zip = new ZipArchive();
			$zip->open(${phpVar(zipPath)}, ZipArchive::CREATE | ZipArchive::OVERWRITE);
			$zip->addFromString(${phpVar(configSamplePath)}, ${phpVar(configSampleContents)});
			$zip->close();
			`,
		});

		const zipBuffer = await targetPHP.readFileAsBuffer(zipPath);
		await targetPHP.unlink(zipPath);
		const zipFile = new File([zipBuffer], 'nested-wordpress-config.zip');

		await importWordPressFiles(targetPHP, {
			wordPressFilesZip: zipFile,
		});

		const documentRoot = await targetPHP.documentRoot;
		expect(
			await targetPHP.readFileAsText(
				`${documentRoot}/wp-config-sample.php`
			)
		).toBe(configSampleContents);
		expect(
			await targetPHP.fileExists(
				`${documentRoot}/playground-export/wp-config-sample.php`
			)
		).toBe(false);
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

async function createMinimalWordPressFilesZip(playground: PHP) {
	const zipPath = joinPaths('/tmp', `${randomFilename()}.zip`);
	await playground.run({
		code: `<?php
		$zip = new ZipArchive();
		$zip->open(${phpVar(zipPath)}, ZipArchive::CREATE | ZipArchive::OVERWRITE);
		$zip->addFromString('wp-content/plugins/import-test/import-test.php', '<?php');
		$zip->close();
		`,
	});

	const zipBuffer = await playground.readFileAsBuffer(zipPath);
	await playground.unlink(zipPath);
	return new File([zipBuffer], 'minimal-wordpress-files.zip');
}
