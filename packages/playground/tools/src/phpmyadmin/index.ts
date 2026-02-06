import type { StepDefinition } from '@wp-playground/blueprints';

export const PHPMYADMIN_VERSION = '5.2.3';
export const PHPMYADMIN_DOWNLOAD_URL = `https://files.phpmyadmin.net/phpMyAdmin/${PHPMYADMIN_VERSION}/phpMyAdmin-${PHPMYADMIN_VERSION}-english.zip`;
export const PHPMYADMIN_INSTALL_PATH = '/tools/phpmyadmin';
export const PHPMYADMIN_ENTRY_PATH =
	'/index.php?route=/database/structure&db=wordpress';

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
			path: `${PHPMYADMIN_INSTALL_PATH}/config.inc.php`,
			/* @ts-ignore */
			data: (await import('./config.inc.php?raw')).default as string,
		},
	];
}
