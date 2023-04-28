import os from 'os';
import path from 'path';

/**
 * The hidden folder name for storing WP Now related files.
 */
export const WP_NOW_HIDDEN_FOLDER = '.wp-now';

/**
 * The full path to the hidden WP Now folder in the user's home directory.
 */
export const WP_NOW_PATH = path.join(os.homedir(), WP_NOW_HIDDEN_FOLDER);

/**
 * The path where WordPress zip files and unzipped folders will be stored within the WP Now folder.
 */
export const WORDPRESS_ZIPS_PATH = path.join(WP_NOW_PATH, 'wordpress_zips');

/**
 * The file name for the SQLite plugin name.
 */
export const SQLITE_FILENAME = 'sqlite-database-integration';

/**
 * The full path to the SQLite database integration folder.
 */
export const SQLITE_PATH = path.join(WP_NOW_PATH, `${SQLITE_FILENAME}-main`);

/**
 * The URL for downloading the latest version of WordPress.
 */
export const WP_DOWNLOAD_URL = 'https://wordpress.org/latest.zip';

/**
 * The URL for downloading the SQLite database integration WordPress Plugin.
 */
export const SQLITE_URL =
	'https://github.com/WordPress/sqlite-database-integration/archive/refs/heads/main.zip';

/**
 * The default starting port for running the WP Now server.
 */
export const DEFAULT_PORT = 8881;
