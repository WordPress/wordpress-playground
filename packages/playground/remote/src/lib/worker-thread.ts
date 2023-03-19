import {
	loadPHPRuntime,
	PHP,
	PHPServer,
	PHPBrowser,
	PHPClient,
	exposeAPI,
	PublicAPI,
	getPHPLoaderModule,
	parseWorkerStartupOptions,
} from '@php-wasm/web';
import { EmscriptenDownloadMonitor } from '@php-wasm/progress';
import { setURLScope } from '@php-wasm/scopes';
import { DOCROOT, wordPressSiteUrl } from './config';
import { isUploadedFilePath } from './is-uploaded-file-path';
import patchWordPress from './wordpress-patch';

type PlaygroundStartupOptions = {
  wpVersion?: string;
  phpVersion?: string;
};
const startupOptions = parseWorkerStartupOptions<PlaygroundStartupOptions>();

// Expect underscore, not a dot. Vite doesn't deal well with the dot in the
// parameters names passed to the worker via a query string.
const wpVersion = (startupOptions.wpVersion || '6_1').replace('_', '.');
const phpVersion = (startupOptions.phpVersion || '8_0').replace('_', '.');

const php = new PHP();

const scope = Math.random().toFixed(16);
const scopedSiteUrl = setURLScope(wordPressSiteUrl, scope).toString();
const server = new PHPServer(php, {
	documentRoot: DOCROOT,
	absoluteUrl: scopedSiteUrl,
	isStaticFilePath: isUploadedFilePath,
});

const browser = new PHPBrowser(server);
const monitor = new EmscriptenDownloadMonitor();

/** @inheritDoc PHPClient */
export class PlaygroundWorkerClientClass extends PHPClient {
	scope: Promise<string>;
	wordPressVersion: Promise<string>;
	phpVersion: Promise<string>;

	constructor(
		browser: PHPBrowser,
		monitor: EmscriptenDownloadMonitor,
		scope: string,
		wordPressVersion: string,
		phpVersion: string
	) {
		super(browser, monitor);
		this.scope = Promise.resolve(scope);
		this.wordPressVersion = Promise.resolve(wordPressVersion);
		this.phpVersion = Promise.resolve(phpVersion);
	}

	async getWordPressModuleDetails() {
		return {
			staticAssetsDirectory: `wp-${wpVersion.replace('_', '.')}`,
			defaultTheme: wpLoaderModule?.defaultThemeName,
		};
	}
}

/** @inheritDoc PlaygroundWorkerClientClass */
export interface PlaygroundWorkerClient
	extends PublicAPI<PlaygroundWorkerClientClass> {}

const [setApiReady]: [() => void, PlaygroundWorkerClient] = exposeAPI(
	new PlaygroundWorkerClientClass(
		browser,
		monitor,
		scope,
		wpVersion,
		phpVersion
	)
);

// Load PHP and WordPress modules:
const [phpLoaderModule, wpLoaderModule] = await Promise.all([
	getPHPLoaderModule(phpVersion),
	getWordPressModule(wpVersion),
]);
monitor.setModules([phpLoaderModule, wpLoaderModule]);
php.initializeRuntime(
  await loadPHPRuntime(phpLoaderModule, {
    ...monitor.getEmscriptenArgs(), 'print': function (text) {
      console.log('stdout: ' + text)
    },
    'printErr': function (text) {
      console.log('stderr: ' + text)
    }
  }, [
    wpLoaderModule,
  ])
);
patchWordPress(php, scopedSiteUrl);

php.writeFile(
  '/wordpress/wp-config.php',
  `<?php
/**
 * The base configuration for WordPress
 *
 * The wp-config.php creation script uses this file during the installation.
 * You don't have to use the web site, you can copy this file to "wp-config.php"
 * and fill in the values.
 *
 * This file contains the following configurations:
 *
 * * Database settings
 * * Secret keys
 * * Database table prefix
 * * ABSPATH
 *
 * @link https://wordpress.org/documentation/article/editing-wp-config-php/
 *
 * @package WordPress
 */

// ** Database settings - You can get this info from your web host ** //
/** The name of the database for WordPress */
define( 'DB_NAME', 'database_name_here' );

/** Database username */
define( 'DB_USER', 'username_here' );

/** Database password */
define( 'DB_PASSWORD', 'password_here' );

/** Database hostname */
define( 'DB_HOST', 'localhost' );

/** Database charset to use in creating database tables. */
define( 'DB_CHARSET', 'utf8' );

/** The database collate type. Don't change this if in doubt. */
define( 'DB_COLLATE', '' );

/**#@+
 * Authentication unique keys and salts.
 *
 * Change these to different unique phrases! You can generate these using
 * the {@link https://api.wordpress.org/secret-key/1.1/salt/ WordPress.org secret-key service}.
 *
 * You can change these at any point in time to invalidate all existing cookies.
 * This will force all users to have to log in again.
 *
 * @since 2.6.0
 */
define( 'AUTH_KEY',         'put your unique phrase here' );
define( 'SECURE_AUTH_KEY',  'put your unique phrase here' );
define( 'LOGGED_IN_KEY',    'put your unique phrase here' );
define( 'NONCE_KEY',        'put your unique phrase here' );
define( 'AUTH_SALT',        'put your unique phrase here' );
define( 'SECURE_AUTH_SALT', 'put your unique phrase here' );
define( 'LOGGED_IN_SALT',   'put your unique phrase here' );
define( 'NONCE_SALT',       'put your unique phrase here' );

/**#@-*/

/**
 * WordPress database table prefix.
 *
 * You can have multiple installations in one database if you give each
 * a unique prefix. Only numbers, letters, and underscores please!
 */
$table_prefix = 'wp_';

/**
 * For developers: WordPress debugging mode.
 *
 * Change this to true to enable the display of notices during development.
 * It is strongly recommended that plugin and theme developers use WP_DEBUG
 * in their development environments.
 *
 * For information on other constants that can be used for debugging,
 * visit the documentation.
 *
 * @link https://wordpress.org/documentation/article/debugging-in-wordpress/
 */
define( 'WP_DEBUG', false );

/* Add any custom values between this line and the "stop editing" line. */

define( 'CONCATENATE_SCRIPTS', false );

/* That's all, stop editing! Happy publishing. */

/** Absolute path to the WordPress directory. */
if ( ! defined( 'ABSPATH' ) ) {
\tdefine( 'ABSPATH', __DIR__ . '/' );
}

/** Sets up WordPress vars and included files. */
require_once ABSPATH . 'wp-settings.php';`);

setApiReady();

export function getWordPressModule(version: string) {
	switch (version) {
		case '5.9':
			/** @ts-ignore */
			return import('../wordpress/wp-5.9.js');
		case '6.0':
			/** @ts-ignore */
			return import('../wordpress/wp-6.0.js');
		case '6.1':
			/** @ts-ignore */
			return import('../wordpress/wp-6.1.js');
		case 'nightly':
			/** @ts-ignore */
			return import('../wordpress/wp-nightly.js');
    case 'develop':
      /** @ts-ignore */
      return import('../wordpress/wp-develop.js');
	}
	throw new Error(`Unsupported WordPress module: ${version}`);
}
