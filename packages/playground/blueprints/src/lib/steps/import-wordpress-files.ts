import type { StepHandler } from '.';
import { unzip } from './unzip';
import { logger } from '@php-wasm/logger';
import {
	dirname,
	joinPaths,
	phpVar,
	phpVars,
	randomFilename,
} from '@php-wasm/util';
import type { UniversalPHP } from '@php-wasm/universal';
import { ensureWpConfig } from '@wp-playground/wordpress';
import { getLegacyPlaygroundRuntimeWpContentPaths } from '../utils/legacy-playground-runtime-wp-content-paths';
import { wpContentPathsExcludedFromLegacyExports } from '../utils/legacy-wp-content-paths-excluded-from-exports';
import { defineSiteUrl } from './define-site-url';

/**
 * @inheritDoc importWordPressFiles
 * @example
 *
 * <code>
 * {
 * 		"step": "importWordPressFiles",
 * 		"wordPressFilesZip": {
 * 			"resource": "url",
 * 			"url": "https://mysite.com/import.zip"
 *  	}
 * }
 * </code>
 */
export interface ImportWordPressFilesStep<ResourceType> {
	step: 'importWordPressFiles';
	/**
	 * The zip file containing the top-level WordPress files and
	 * directories.
	 */
	wordPressFilesZip: ResourceType;
	/**
	 * The path inside the zip file where the WordPress files are.
	 */
	pathInZip?: string;
}

/**
 * Imports top-level WordPress files from a given zip file into
 * the `documentRoot`. For example, if a zip file contains the
 * `wp-content` and `wp-includes` directories, they will replace
 * the corresponding directories in Playground's `documentRoot`.
 *
 * Imported copies of Playground-owned runtime artifacts are discarded. For
 * example, an archive cannot replace `mu-plugins/sqlite-database-integration`,
 * `mu-plugins/0-playground.php`, or a Playground-generated `db.php`. If those
 * paths still exist in the importing document root, its copies are retained.
 * An unmarked custom `db.php` remains part of the imported site.
 *
 * A `formatVersion: 2` archive is otherwise authoritative for user-owned
 * `wp-content`: a customized Twenty Twenty-Five theme replaces the boot
 * default, while an absent theme remains deleted. For an older archive, stock
 * paths omitted by the exporter, such as `plugins/akismet`, `plugins/hello.php`,
 * and `themes/twentytwentyfive`, are restored from the importing document root
 * only when absent from the archive.
 *
 * @param playground Playground client.
 * @param wordPressFilesZip Zipped WordPress site.
 */
export const importWordPressFiles: StepHandler<
	ImportWordPressFilesStep<File>
> = async (playground, { wordPressFilesZip, pathInZip = '' }) => {
	const documentRoot = await playground.documentRoot;

	// Unzip
	const unzipRoot = joinPaths(
		'/tmp',
		`import-wordpress-files-${randomFilename()}`
	);
	let commitInProgress = false;
	let oldSiteUrl: string | null = null;
	try {
		await playground.mkdir(unzipRoot);
		await unzip(playground, {
			zipFile: wordPressFilesZip,
			extractToPath: unzipRoot,
		});
		let importPath = joinPaths(unzipRoot, pathInZip);
		importPath =
			(await findWordPressFilesRoot(playground, importPath)) ||
			importPath;

		// Read the export manifest if it exists. The manifest contains the
		// site URL (including scope) at export time, which we'll use later
		// to update URLs in the database when the scope changes.
		const manifestPath = joinPaths(importPath, 'playground-export.json');
		let exportFormatVersion: number | null = null;
		if (await playground.fileExists(manifestPath)) {
			try {
				const manifestContent =
					await playground.readFileAsText(manifestPath);
				const manifest = JSON.parse(manifestContent);
				if (typeof manifest.siteUrl === 'string') {
					oldSiteUrl = manifest.siteUrl;
				}
				if (typeof manifest.formatVersion === 'number') {
					exportFormatVersion = manifest.formatVersion;
				}
				// Remove the manifest file - it's not needed in the document root
				await playground.unlink(manifestPath);
			} catch {
				// Ignore error – tolerate missing and malformed manifests.
			}
		}

		const importedWpContentPath = joinPaths(importPath, 'wp-content');
		// wp-content is optional: this step also accepts partial WordPress archives
		// containing only other top-level paths, such as wp-config.php or wp-includes.
		// Apply wp-content compatibility rules only when the archive provides it.
		if (await playground.fileExists(importedWpContentPath)) {
			const wpContentPath = joinPaths(documentRoot, 'wp-content');

			// Old exports may contain Playground runtime implementations under wp-content.
			// They must not replace the runtime selected by the importing Playground.
			// db.php needs content-based ownership because WordPress also supports custom
			// database drop-ins at that path. During legacy WordPress boot,
			// writeLegacyDbPhp() creates db.php from generateDbPhpContent(), whose header
			// includes @playground-managed. Only a db.php containing that marker is
			// runtime-owned; an unmarked db.php remains user-owned.
			const importedRuntimePaths =
				await getLegacyPlaygroundRuntimeWpContentPaths(
					playground,
					importedWpContentPath
				);
			const currentRuntimePaths =
				await getLegacyPlaygroundRuntimeWpContentPaths(
					playground,
					wpContentPath
				);
			// Discard runtime implementations supplied by the archive.
			for (const relativePath of importedRuntimePaths) {
				await removePath(
					playground,
					joinPaths(importedWpContentPath, relativePath)
				);
			}
			// Stage runtime files that still live in the current wp-content so replacing
			// that directory does not delete the importing Playground's copies.
			for (const relativePath of currentRuntimePaths) {
				const importedRuntimePath = joinPaths(
					importedWpContentPath,
					relativePath
				);
				const currentRuntimePath = joinPaths(
					wpContentPath,
					relativePath
				);
				if (
					!(await playground.fileExists(importedRuntimePath)) &&
					(await playground.fileExists(currentRuntimePath))
				) {
					await playground.mkdir(dirname(importedRuntimePath));
					await playground.cp(
						currentRuntimePath,
						importedRuntimePath
					);
				}
			}

			if (exportFormatVersion === null || exportFormatVersion < 2) {
				// Old exports omitted these stock plugins and themes without recording
				// deletions. Restore current copies missing from the archive because we
				// cannot tell a user deletion from an exporter omission.
				for (const relativePath of wpContentPathsExcludedFromLegacyExports) {
					const importedUserPath = joinPaths(
						importedWpContentPath,
						relativePath
					);
					const userPath = joinPaths(wpContentPath, relativePath);
					if (
						!(await playground.fileExists(importedUserPath)) &&
						(await playground.fileExists(userPath))
					) {
						await playground.mkdir(dirname(importedUserPath));
						await playground.cp(userPath, importedUserPath);
					}
				}

				// Legacy exports may also omit the database directory.
				const importedDatabasePath = joinPaths(
					importedWpContentPath,
					'database'
				);
				const databasePath = joinPaths(wpContentPath, 'database');
				if (
					!(await playground.fileExists(importedDatabasePath)) &&
					(await playground.fileExists(databasePath))
				) {
					await playground.cp(databasePath, importedDatabasePath);
				}
			}
		}

		// Move all the paths from the imported directory into the document root.
		// Overwrite, if needed.
		const importedFilenames = await playground.listFiles(importPath);
		// Once replacement starts, cleanup would destroy the only remaining
		// copy of any staged paths that have not moved yet.
		commitInProgress = importedFilenames.length > 0;
		for (const fileName of importedFilenames) {
			await removePath(playground, joinPaths(documentRoot, fileName));
			await playground.mv(
				joinPaths(importPath, fileName),
				joinPaths(documentRoot, fileName)
			);
		}
		commitInProgress = false;
	} finally {
		if (commitInProgress) {
			logger.warn(
				`WordPress file import failed while replacing live files. ` +
					`The remaining staged files were preserved for recovery at ${unzipRoot}.`
			);
		} else {
			await removePath(playground, unzipRoot);
		}
	}

	// Ensure required constants are defined if wp-config.php doesn't define them.
	await ensureWpConfig(playground, documentRoot);

	const newSiteUrl = await playground.absoluteUrl;

	// If the manifest didn't provide the old site URL, try to infer it from
	// the database. The siteurl option still contains the URL from the export
	// at this point, before we update it with defineSiteUrl.
	if (!oldSiteUrl) {
		oldSiteUrl = await inferSiteUrlFromDatabase(playground, documentRoot);
	}

	// Adjust the site URL
	await defineSiteUrl(playground, {
		siteUrl: newSiteUrl,
	});

	// Upgrade the database
	const upgradePhp = phpVar(
		joinPaths(documentRoot, 'wp-admin', 'upgrade.php')
	);
	await playground.run({
		code: `<?php
            $_GET['step'] = 'upgrade_db';
            require ${upgradePhp};
            `,
	});

	// If the site URL changed (different scope), update all URLs in the database.
	// This ensures that image and media URLs that reference the old scope
	// are updated to use the new scope.
	if (oldSiteUrl && oldSiteUrl !== newSiteUrl) {
		await replaceSiteUrl(playground, documentRoot, oldSiteUrl, newSiteUrl);
	}
};

/**
 * Extracts the scope path segment from a Playground URL.
 * For example, "http://playground.wordpress.net/scope:abc123/" returns "/scope:abc123/".
 * Returns null if no scope is found.
 */
function extractScopePath(url: string): string | null {
	const match = url.match(/\/scope:[^/]+\/?/);
	return match ? match[0].replace(/\/?$/, '/') : null;
}

/**
 * Replaces the scope path segment in URLs stored in the database.
 * Only replaces /scope:old-scope/ with /scope:new-scope/, leaving the rest
 * of URLs intact. This is a targeted replacement that handles scope changes
 * when importing a Playground export into a different scope.
 *
 * This approach is reasonably safe because:
 * - The scope string is fairly unique (/scope:xyz/ pattern)
 * - The database fits into memory anyway
 * - There's no expectation of HTML entities or other escaping within the scope string
 */
async function replaceSiteUrl(
	playground: UniversalPHP,
	documentRoot: string,
	oldSiteUrl: string,
	newSiteUrl: string
) {
	const oldScopePath = extractScopePath(oldSiteUrl);
	const newScopePath = extractScopePath(newSiteUrl);

	// If we can't extract scope paths, there's nothing to replace
	if (!oldScopePath || !newScopePath) {
		return;
	}

	// If the scopes are the same, no replacement needed
	if (oldScopePath === newScopePath) {
		return;
	}

	await playground.run({
		code: `<?php
		require_once getenv('DOCUMENT_ROOT') . '/wp-load.php';
		global $wpdb;

		$old_scope = getenv('OLD_SCOPE');
		$new_scope = getenv('NEW_SCOPE');

		// Update URLs in posts content, excerpts, and GUIDs
		$wpdb->query($wpdb->prepare(
			"UPDATE {$wpdb->posts} SET post_content = REPLACE(post_content, %s, %s)",
			$old_scope, $new_scope
		));
		$wpdb->query($wpdb->prepare(
			"UPDATE {$wpdb->posts} SET post_excerpt = REPLACE(post_excerpt, %s, %s)",
			$old_scope, $new_scope
		));
		$wpdb->query($wpdb->prepare(
			"UPDATE {$wpdb->posts} SET guid = REPLACE(guid, %s, %s)",
			$old_scope, $new_scope
		));

		// Update URLs in post meta
		$wpdb->query($wpdb->prepare(
			"UPDATE {$wpdb->postmeta} SET meta_value = REPLACE(meta_value, %s, %s) WHERE meta_value LIKE %s",
			$old_scope, $new_scope, '%' . $wpdb->esc_like($old_scope) . '%'
		));

		// Update URLs in options (handles both regular and serialized data)
		$wpdb->query($wpdb->prepare(
			"UPDATE {$wpdb->options} SET option_value = REPLACE(option_value, %s, %s) WHERE option_value LIKE %s",
			$old_scope, $new_scope, '%' . $wpdb->esc_like($old_scope) . '%'
		));

		// Update URLs in user meta
		$wpdb->query($wpdb->prepare(
			"UPDATE {$wpdb->usermeta} SET meta_value = REPLACE(meta_value, %s, %s) WHERE meta_value LIKE %s",
			$old_scope, $new_scope, '%' . $wpdb->esc_like($old_scope) . '%'
		));

		// Update URLs in term meta
		$wpdb->query($wpdb->prepare(
			"UPDATE {$wpdb->termmeta} SET meta_value = REPLACE(meta_value, %s, %s) WHERE meta_value LIKE %s",
			$old_scope, $new_scope, '%' . $wpdb->esc_like($old_scope) . '%'
		));

		// Update URLs in comments
		$wpdb->query($wpdb->prepare(
			"UPDATE {$wpdb->comments} SET comment_content = REPLACE(comment_content, %s, %s) WHERE comment_content LIKE %s",
			$old_scope, $new_scope, '%' . $wpdb->esc_like($old_scope) . '%'
		));
		$wpdb->query($wpdb->prepare(
			"UPDATE {$wpdb->comments} SET comment_author_url = REPLACE(comment_author_url, %s, %s) WHERE comment_author_url LIKE %s",
			$old_scope, $new_scope, '%' . $wpdb->esc_like($old_scope) . '%'
		));
		`,
		env: {
			DOCUMENT_ROOT: documentRoot,
			OLD_SCOPE: oldScopePath,
			NEW_SCOPE: newScopePath,
		},
	});
}

/**
 * Attempts to infer the old site URL from the WordPress database.
 * This is used when importing legacy exports that don't have a manifest file.
 * We query the siteurl option directly from the database using raw SQL because
 * get_option('siteurl') would return the WP_SITEURL constant value instead of
 * what's stored in the database.
 */
async function inferSiteUrlFromDatabase(
	playground: UniversalPHP,
	documentRoot: string
): Promise<string | null> {
	const js = phpVars({ documentRoot });
	const result = await playground.run({
		code: `<?php
		require_once ${js.documentRoot} . '/wp-load.php';
		global $wpdb;
		$row = $wpdb->get_row("SELECT option_value FROM {$wpdb->options} WHERE option_name = 'siteurl'");
		echo $row ? $row->option_value : '';
		`,
	});
	const siteUrl = result.text.trim();
	return siteUrl || null;
}

const WORDPRESS_ROOT_MARKERS = [
	'wp-content',
	'wp-admin',
	'wp-includes',
	'wp-config.php',
	'wp-config-sample.php',
];

/**
 * Finds the directory containing the WordPress files in an extracted archive.
 *
 * Some ZIP tools wrap the selected files in a single parent directory. Without
 * unwrapping that directory, importWordPressFiles() reports success but moves
 * the wrapper into WordPress, leaving the live wp-content unchanged.
 *
 * Only one wrapper directory is supported, and only when it is the only entry
 * at the requested import path. Deeper layouts are ambiguous, so they are left
 * unchanged instead of guessing.
 *
 * wp-content is not required here. importWordPressFiles() can also replace
 * other top-level WordPress files such as wp-admin, wp-includes, or
 * wp-config.php.
 */
async function findWordPressFilesRoot(
	playground: UniversalPHP,
	importPath: string
): Promise<string | null> {
	if (await hasWordPressRootMarker(playground, importPath)) {
		return importPath;
	}

	const fileNames = await playground.listFiles(importPath);
	if (fileNames.length !== 1) {
		return null;
	}

	const nestedPath = joinPaths(importPath, fileNames[0]);
	if (!(await playground.isDir(nestedPath))) {
		return null;
	}

	if (await hasWordPressRootMarker(playground, nestedPath)) {
		return nestedPath;
	}

	return null;
}

async function hasWordPressRootMarker(
	playground: UniversalPHP,
	path: string
): Promise<boolean> {
	for (const marker of WORDPRESS_ROOT_MARKERS) {
		if (await playground.fileExists(joinPaths(path, marker))) {
			return true;
		}
	}
	return false;
}

async function removePath(playground: UniversalPHP, path: string) {
	if (await playground.fileExists(path)) {
		if (await playground.isDir(path)) {
			await playground.rmdir(path);
		} else {
			await playground.unlink(path);
		}
	}
}
