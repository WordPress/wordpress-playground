import os from 'os';
import path from 'path';

export const WP_NOW_PATH = path.join(os.homedir(), '.wp-now');
export const WORDPRESS_ZIPS_PATH = path.join(WP_NOW_PATH, 'wordpress_zips');
export const WORDPRESS_VERSIONS_PATH = path.join(WP_NOW_PATH, 'wordpress_versions');
export const WP_DOWNLOAD_URL = 'https://wordpress.org/latest.zip'
export const SQLITE_URL = 'https://github.com/WordPress/sqlite-database-integration/archive/refs/heads/main.zip'
