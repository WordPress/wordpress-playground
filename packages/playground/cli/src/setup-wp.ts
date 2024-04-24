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
import { withPHPIniValues } from './setup-php';

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
	await prepareWordPress(php, wpZip, sqliteZip);

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

/**
 * Prepare the WordPress document root given a WordPress zip file and
 * the sqlite-database-integration zip file.
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
async function prepareWordPress(php: NodePHP, wpZip: File, sqliteZip: File) {
	php.mkdir('/tmp/unzipped-wordpress');
	await unzip(php, {
		zipFile: wpZip,
		extractToPath: '/tmp/unzipped-wordpress',
	});
	// The zip file may contain a subdirectory, or not.
	const wpPath = php.fileExists('/tmp/unzipped-wordpress/wordpress')
		? '/tmp/unzipped-wordpress/wordpress'
		: '/tmp/unzipped-wordpress';
	php.mv(wpPath, '/wordpress');

	php.mkdir('/tmp/sqlite-database-integration');
	await unzip(php, {
		zipFile: sqliteZip,
		extractToPath: '/tmp/sqlite-database-integration',
	});

	php.mv(
		'/tmp/sqlite-database-integration/sqlite-database-integration-main',
		'/wordpress/sqlite-database-integration'
	);

	const db = php.readFileAsText(
		'/wordpress/sqlite-database-integration/db.copy'
	);
	const updatedDb = db
		.replace(
			"'{SQLITE_IMPLEMENTATION_FOLDER_PATH}'",
			"__DIR__.'/../sqlite-database-integration/'"
		)
		.replace(
			"'{SQLITE_PLUGIN}'",
			"__DIR__.'/../sqlite-database-integration/load.php'"
		);
	php.writeFile('/wordpress/wp-content/db.php', updatedDb);

	/**
	 * This should be a mu-plugin, but since the user may have
	 * provided custom mounts, we avoid writing to the mu-plugins
	 * directory
	 *
	 * @TODO: Either document this hack, or find a better way to
	 *        handle this.
	 * @TODO: The web version also uses an mu-plugin and it has the
	 *        same filters as this one. Also wp-now and VS Code.
	 *        There seems to be an opportunity to share the code between
	 *        the two.
	 */

	php.writeFile(
		'/wordpress/wp-includes/default-filters.php',
		php.readFileAsText('/wordpress/wp-includes/default-filters.php') +
			`
		// Redirect /wp-admin to /wp-admin/
		add_filter( 'redirect_canonical', function( $redirect_url ) {
			if ( '/wp-admin' === $redirect_url ) {
				return $redirect_url . '/';
			}
			return $redirect_url;
		} );

		// Needed because gethostbyname( 'wordpress.org' ) returns
		// a private network IP address for some reason.
		add_filter( 'allowed_redirect_hosts', function( $deprecated = '' ) {
			return array(
				'wordpress.org',
				'api.wordpress.org',
				'downloads.wordpress.org',
			);
		} );

		// Support permalinks without "index.php"
		add_filter( 'got_url_rewrite', '__return_true' );
		`
	);
	php.writeFile(
		'/wordpress/wp-config.php',
		php.readFileAsText('/wordpress/wp-config-sample.php')
	);
}
