import fs from 'fs';

import { NodePHP } from '@php-wasm/node';
import { EmscriptenDownloadMonitor } from '@php-wasm/progress';
import {
	defineSiteUrl,
	runWpInstallationWizard,
	unzip,
	zipWpContent,
} from '@wp-playground/blueprints';
import path from 'path';
import {
	resolveWPRelease,
	cachedDownload,
	CACHE_FOLDER,
	readAsFile,
} from './download';
import {
	preloadSqliteIntegration,
	unzipWordPress,
	withPHPIniValues,
} from '@wp-playground/wordpress';

/**
 * Ensures a functional WordPress installation in php document root.
 *
 * This is a TypeScript function for now, just to get something off the
 * ground, but it will be superseded by the PHP Blueprints library developed
 * at https://github.com/WordPress/blueprints-library/
 *
 * That PHP library will come with a set of functions and a CLI tool to
 * turn a Blueprint into a WordPress directory structure or a zip Snapshot.
 * Let's **not** invest in the TypeScript implementation of this function,
 * accept the limitation, and switch to the PHP implementation as soon
 * as that's viable.
 */
export async function setupWordPress(
	php: NodePHP,
	wpVersion = 'latest',
	monitor: EmscriptenDownloadMonitor
) {
	/**
	 * @TODO: This looks similar to what the website does to setup WordPress.
	 *        Perhaps there's a common function that could be shared?
	 */
	const wpDetails = await resolveWPRelease(wpVersion);
	const [wpZip, sqliteZip] = await Promise.all([
		cachedDownload(wpDetails.url, `${wpDetails.version}.zip`, monitor),
		cachedDownload(
			'https://github.com/WordPress/sqlite-database-integration/archive/refs/heads/main.zip',
			'sqlite.zip',
			monitor
		),
	]);
	await unzipWordPress(php, wpZip);
	// Setup the SQLite integration if no custom database drop-in is present
	if (!php.fileExists('/wordpress/wp-content/db.php')) {
		await preloadSqliteIntegration(php, sqliteZip);
	}

	const preinstalledWpContentPath = path.join(
		CACHE_FOLDER,
		`prebuilt-wp-content-for-wp-${wpDetails.version}.zip`
	);
	if (fs.existsSync(preinstalledWpContentPath)) {
		/**
		 * @TODO: This caching mechanism will be made generic and provided as a
		 *        handler for the PHP Blueprints library.
		 */
		await unzip(php, {
			zipFile: readAsFile(preinstalledWpContentPath),
			extractToPath: '/wordpress',
		});
	} else {
		// Define a fake URL for the installation wizard.
		await defineSiteUrl(php, {
			siteUrl: 'http://playground.internal',
		});

		// Disable networking for the installation wizard
		// to avoid loopback requests and also speed it up.
		// @TODO: Expose withPHPIniValues as a function from the
		//        php-wasm library.
		await withPHPIniValues(
			php,
			{
				disable_functions: 'fsockopen',
				allow_url_fopen: '0',
			},
			async () =>
				await runWpInstallationWizard(php, {
					options: {},
				})
		);

		const wpContent = await zipWpContent(php);
		fs.writeFileSync(preinstalledWpContentPath, wpContent);
	}
}
