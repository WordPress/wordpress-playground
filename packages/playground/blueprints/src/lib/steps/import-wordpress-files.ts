import type { StepHandler } from '.';
import { unzip } from './unzip';
import { dirname, joinPaths, phpVar, phpVars } from '@php-wasm/util';
import type { UniversalPHP } from '@php-wasm/universal';
import { ensureWpConfig } from '@wp-playground/wordpress';
import { wpContentFilesExcludedFromExport } from '../utils/wp-content-files-excluded-from-exports';
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
 * Any files that Playground recognizes as "excluded from the export"
 * will carry over from the existing document root into the imported
 * directories. For example, the sqlite-database-integration plugin.
 *
 * @param playground Playground client.
 * @param wordPressFilesZip Zipped WordPress site.
 */
export const importWordPressFiles: StepHandler<
	ImportWordPressFilesStep<File>
> = async (playground, { wordPressFilesZip, pathInZip = '' }) => {
	const documentRoot = await playground.documentRoot;

	// Unzip
	let importPath = joinPaths('/tmp', 'import');
	await playground.mkdir(importPath);
	await unzip(playground, {
		zipFile: wordPressFilesZip,
		extractToPath: importPath,
	});
	importPath = joinPaths(importPath, pathInZip);

	// Read the export manifest if it exists. The manifest contains the
	// site URL (including scope) at export time, which we'll use later
	// to update URLs in the database when the scope changes.
	const manifestPath = joinPaths(importPath, 'playground-export.json');
	let oldSiteUrl: string | null = null;
	if (await playground.fileExists(manifestPath)) {
		try {
			const manifestContent =
				await playground.readFileAsText(manifestPath);
			const manifest = JSON.parse(manifestContent);
			oldSiteUrl = manifest.siteUrl;
			// Remove the manifest file - it's not needed in the document root
			await playground.unlink(manifestPath);
		} catch {
			// Ignore error – tolerate missing and malformed manifests.
		}
	}

	// Carry over any Playground-related files, such as the
	// SQLite database plugin, from the current wp-content
	// into the one that's about to be imported
	const importedWpContentPath = joinPaths(importPath, 'wp-content');
	const wpContentPath = joinPaths(documentRoot, 'wp-content');
	for (const relativePath of wpContentFilesExcludedFromExport) {
		// Remove any paths that were supposed to be excluded from the export
		// but maybe weren't
		const excludedImportPath = joinPaths(
			importedWpContentPath,
			relativePath
		);
		await removePath(playground, excludedImportPath);

		// Replace them with files sourced from the live wp-content directory
		const restoreFromPath = joinPaths(wpContentPath, relativePath);
		if (await playground.fileExists(restoreFromPath)) {
			await playground.mkdir(dirname(excludedImportPath));
			await playground.mv(restoreFromPath, excludedImportPath);
		}
	}

	// Carry over the database directory if the imported zip file doesn't
	// already contain one.
	const importedDatabasePath = joinPaths(
		importPath,
		'wp-content',
		'database'
	);
	if (!(await playground.fileExists(importedDatabasePath))) {
		await playground.mv(
			joinPaths(documentRoot, 'wp-content', 'database'),
			importedDatabasePath
		);
	}

	// Move all the paths from the imported directory into the document root.
	// Overwrite, if needed.
	const importedFilenames = await playground.listFiles(importPath);
	for (const fileName of importedFilenames) {
		await removePath(playground, joinPaths(documentRoot, fileName));
		await playground.mv(
			joinPaths(importPath, fileName),
			joinPaths(documentRoot, fileName)
		);
	}

	// Remove the directory where we unzipped the imported zip file.
	await playground.rmdir(importPath);

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

async function removePath(playground: UniversalPHP, path: string) {
	if (await playground.fileExists(path)) {
		if (await playground.isDir(path)) {
			await playground.rmdir(path);
		} else {
			await playground.unlink(path);
		}
	}
}
