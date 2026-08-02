import type { StepDefinition } from '@wp-playground/blueprints';
import { joinPaths } from '@php-wasm/util';

/**
 * phpMyAdmin installation, detection, URL construction, and request routing
 * live in separate consumers (Website, Personal WP, and CLI). These values are
 * exported from one place to keep that shared contract in sync.
 */

// Keep the downloaded archive and its extracted directory name on the same release.
export const PHPMYADMIN_VERSION = '5.2.3';

// The archive installed by the shared Blueprint steps.
export const PHPMYADMIN_DOWNLOAD_URL = `https://files.phpmyadmin.net/phpMyAdmin/${PHPMYADMIN_VERSION}/phpMyAdmin-${PHPMYADMIN_VERSION}-english.zip`;

// PHP filesystem path, kept outside the WordPress document root and site exports.
export const PHPMYADMIN_INSTALL_PATH = '/tools/phpmyadmin';

// Complete-install marker checked by the UI before deciding whether to reinstall.
export const PHPMYADMIN_CONFIG_PATH = joinPaths(
	PHPMYADMIN_INSTALL_PATH,
	'config.inc.php'
);

// Default public URL shared by the browser UIs and CLI.
export const PHPMYADMIN_URL_PATH = '/phpmyadmin';

// Initial phpMyAdmin route opened after installation.
export const PHPMYADMIN_ENTRY_PATH =
	'/index.php?route=/database/structure&db=wordpress';

// Default browser-runtime mapping from the public URL to the PHP filesystem path.
export const PHPMYADMIN_PATH_ALIAS = {
	urlPrefix: PHPMYADMIN_URL_PATH,
	fsPath: PHPMYADMIN_INSTALL_PATH,
} as const;

/**
 * Returns the blueprint steps needed to install phpMyAdmin in Playground.
 *
 * This installs phpMyAdmin and applies the following modifications:
 *   1. Inject a "config.inc.php" file to configure phpMyAdmin for Playground.
 *   2. Inject a "DbiMysqli.php" file to implement the MySQL-on-SQLite driver.
 *
 * @returns Blueprint steps to install phpMyAdmin in Playground.
 */
export async function getPhpMyAdminInstallSteps(): Promise<StepDefinition[]> {
	return [
		{
			step: 'unzip',
			zipFile: {
				resource: 'url',
				url: PHPMYADMIN_DOWNLOAD_URL,
			},
			extractToPath: '/tmp',
		},
		{
			step: 'mkdir',
			path: PHPMYADMIN_INSTALL_PATH,
		},
		{
			step: 'mv',
			fromPath: `/tmp/phpMyAdmin-${PHPMYADMIN_VERSION}-english`,
			toPath: PHPMYADMIN_INSTALL_PATH,
		},
		{
			step: 'writeFile',
			path: `${PHPMYADMIN_INSTALL_PATH}/libraries/classes/Dbal/DbiMysqli.php`,
			/* @ts-ignore */
			data: (await import('./DbiMysqli.php?raw')).default as string,
		},
		{
			step: 'writeFile',
			path: PHPMYADMIN_CONFIG_PATH,
			/* @ts-ignore */
			data: (await import('./config.inc.php?raw')).default as string,
		},
	];
}
